import path from 'path'
import fs from 'fs'
// import {storeMemory} from './memory/rag-memory.js'
import {classify} from './tools/feishu-bridge.js'

const HELP_TEXT = `小圈 可用命令：
/new       — 创建新对话，之前历史不带入
/verbose on|off — 开启/关闭推理过程推送
/status    — 查看当前会话信息
/help      — 显示此帮助`

const SLASH_COMMANDS = new Set(['/new', '/verbose', '/help', '/status'])

// 29 课：routing_key 前缀
const TEAM_PREFIX = 'team:'
const P2P_PREFIX = 'p2p:'

function _pickAgentFn(routingKey, agentFnMap, defaultFn) {
  if (agentFnMap) {
    if (routingKey.startsWith(TEAM_PREFIX)) {
      const role = routingKey.slice(TEAM_PREFIX.length)
      if (role in agentFnMap) return agentFnMap[role]
      throw new Error(`no agent_fn for team role: ${role}`)
    }
    if ('manager' in agentFnMap) return agentFnMap['manager']
  }
  if (defaultFn) return defaultFn
  throw new Error(`no agent_fn available for routingKey: ${routingKey}`)
}

function _isWakeMessage(inbound) {
  return !!(inbound.meta && inbound.meta.wakeReason)
}

export class Runner {
  constructor(sessionMgr, sender, agentFn, {
    idleTimeoutS = 300, downloader = null, dbDsn = null, agentFnMap = null, checkpointStore = null,
  } = {}) {
    this._sessionMgr = sessionMgr
    this._sender = sender
    this._agentFn = agentFn       // 22 课兼容：单 agentFn
    this._agentFnMap = agentFnMap // 29 课：多角色
    this._idleTimeoutS = idleTimeoutS
    this._downloader = downloader
    this._dbDsn = dbDsn
    this._checkpointStore = checkpointStore
    this._queues = new Map()
    this._workers = new Map()
    this._wakers = new Map()
  }

  async dispatch(inbound) {
    const {routingKey} = inbound

    // 29 课：wake_reason 去重（相同 routingKey 已有 pending wake 则丢弃）
    if (_isWakeMessage(inbound) && this._hasPendingWake(routingKey, inbound)) {
      console.log(`[Runner] dedup wake: routingKey=${routingKey}`)
      return
    }

    if (!this._queues.has(routingKey)) {
      this._queues.set(routingKey, [])
      this._startWorker(routingKey)
    }
    this._queues.get(routingKey).push(inbound)
    const waker = this._wakers?.get(routingKey)
    if (waker) waker()
  }

  _hasPendingWake(routingKey, inbound) {
    const queue = this._queues.get(routingKey)
    if (!queue) return false
    const wakeKey = `${inbound.meta?.wakeReason || ''}:${inbound.content || ''}`
    return queue.some(msg =>
      msg.meta &&
      msg.meta.wakeReason &&
      `${msg.meta?.wakeReason || ''}:${msg.content || ''}` === wakeKey)
  }

  _startWorker(routingKey) {
    const workerPromise = this._workerLoop(routingKey)
    this._workers.set(routingKey, workerPromise)
  }

  async _workerLoop(routingKey) {
    while (true) {
      const queue = this._queues.get(routingKey)
      if (!queue || queue.length === 0) {
        const gotMessage = await new Promise(resolve => {
          this._wakers.set(routingKey, () => resolve(true))
          setTimeout(() => resolve(false), this._idleTimeoutS * 1000)
        })
        if (!gotMessage) {
          this._queues.delete(routingKey)
          this._workers.delete(routingKey)
          this._wakers.delete(routingKey)
          return
        }
        continue
      }

      const inbound = queue.shift()
      try {
        await this._handle(inbound)
      } catch (e) {
        console.error(`[Runner] error handling message:`, e)
        if (!routingKey.startsWith(TEAM_PREFIX)) {
          try {
            await this._sender.send(inbound.routingKey, `处理出错：${e.message}`, inbound.rootId)
          } catch {}
        }
      }
    }
  }

  async _handle(inbound) {
    const {routingKey, rootId} = inbound

    const slashReply = await this._handleSlash(inbound)
    if (slashReply !== null) {
      await this._sender.sendText(routingKey, slashReply, rootId)
      return
    }

    const session = await this._sessionMgr.getOrCreate(routingKey)

    let userContent = inbound.content
    if (inbound.attachment && this._downloader) {
      const localPath = await this._downloader.download(inbound.msgId, inbound.attachment, session.id)
      console.log(`[Runner] attachment download: ${localPath ? 'ok' : 'failed'} file=${inbound.attachment.fileName}`)
      if (localPath) {
        const absPath = path.resolve(localPath)
        const ext = path.extname(absPath).toLowerCase()
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
          const buf = fs.readFileSync(absPath)
          const b64 = buf.toString('base64')
          const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
          userContent = [
            {type: 'image', image: `data:${mime};base64,${b64}`},
            {type: 'text', text: userContent || '请描述这张图片的内容'},
          ]
        } else {
          userContent = _buildAttachmentMessage(absPath, userContent)
        }
      }
    }

    if (!userContent || (typeof userContent === 'string' && !userContent.trim())) {
      console.log(`[Runner] empty content after processing, skipping`)
      return
    }

    const checkpointResponse = await this._maybeTransformCheckpointResponse(inbound, userContent)
    if (checkpointResponse) userContent = checkpointResponse.content

    // 29 课：按 routing_key 选对应角色的 agentFn
    const agentFn = _pickAgentFn(routingKey, this._agentFnMap, this._agentFn)

    console.log(`[Runner] session=${session.id} routingKey=${routingKey} userContent=${JSON.stringify(userContent).slice(0, 200)}`)

    const history = await this._sessionMgr.loadHistory(session.id)
    console.log(`[Runner] history turns=${history.length}`)

    // team:* 唤醒消息不发思考中 card，也不回消息
    const isTeamWake = routingKey.startsWith(TEAM_PREFIX)

    if (!isTeamWake) await this._sender.sendThinking(routingKey, rootId)

    const result = await agentFn(userContent, history, session.id, routingKey, rootId, session.verbose)
    const reply = typeof result === 'object' ? result.text : result
    console.log(`[Runner] reply length=${reply.length}`)

    if (checkpointResponse?.checkpointId && this._checkpointStore) {
      await this._checkpointStore.resolve(checkpointResponse.checkpointId).catch(e =>
        console.warn('[Runner] checkpoint resolve error:', e.message))
    }

    const userTextForLog = Array.isArray(userContent) ? '[图片消息]' : userContent
    await this._sessionMgr.append(session.id, {
      user: userTextForLog,
      feishuMsgId: inbound.msgId,
      assistant: reply,
    })

    // storeMemory({
    //   sessionId: session.id,
    //   routingKey,
    //   userMessage: userTextForLog,
    //   assistantReply: reply,
    //   turnTs: Date.now(),
    //   dbDsn: this._dbDsn,
    // }).catch(e => console.error('[Runner] storeMemory error:', e.message))

    // team:* wake 消息不回飞书（Agent 通过 send_to_human 主动发）
    // send_to_human 调用 sender.send() 时会自动消费 pending card（updateCard）
    // 若 agentFn 结束后 pending card 仍存在（未调用 send_to_human），则用 reply 兜底更新
    if (!isTeamWake) {
      if (this._sender.hasPendingCard(routingKey)) {
        await this._sender.consumePendingCard(routingKey, reply)
      }
    }
  }

  async _handleSlash(inbound) {
    const text = inbound.content.trim()
    if (!text.startsWith('/')) return null
    const [cmd, ...args] = text.split(/\s+/)
    if (!SLASH_COMMANDS.has(cmd)) return null

    const {routingKey} = inbound
    switch (cmd) {
      case '/help':
        return HELP_TEXT
      case '/new': {
        const session = await this._sessionMgr.reset(routingKey)
        return `已创建新对话 (${session.id})，之前的历史不会带入。`
      }
      case '/verbose': {
        const arg = args[0]?.toLowerCase()
        if (arg === 'on' || arg === 'off') {
          const verbose = arg === 'on'
          await this._sessionMgr.updateVerbose(routingKey, verbose)
          return `详细模式已${verbose ? '开启' : '关闭'}`
        }
        const session = await this._sessionMgr.getOrCreate(routingKey)
        return `详细模式当前：${session.verbose ? '开启' : '关闭'}`
      }
      case '/status': {
        const session = await this._sessionMgr.getOrCreate(routingKey)
        return `会话 ID: ${session.id}\n消息数: ${session.messageCount}\n详细模式: ${session.verbose ? '开启' : '关闭'}`
      }
      default:
        return null
    }
  }

  async _maybeTransformCheckpointResponse(inbound, userContent) {
    if (!this._checkpointStore) return null
    if (inbound.routingKey.startsWith(TEAM_PREFIX)) return null
    if (_isWakeMessage(inbound)) return null
    if (Array.isArray(userContent) || typeof userContent !== 'string') return null

    let pendingForRk = []
    try {
      pendingForRk = await this._checkpointStore.pendingForRoutingKey(inbound.routingKey)
    } catch (e) {
      console.warn('[Runner] checkpoint pending lookup error:', e.message)
      return null
    }
    if (pendingForRk.length === 0) return null

    const [category, checkpointId] = classify(userContent, {pendingForRk})
    if (category !== 'checkpoint_response' || !checkpointId) return null

    const checkpoint = pendingForRk.find(c => c.checkpointId === checkpointId) || {}
    const payload = {
      type: 'checkpoint_response',
      checkpointId,
      projectId: checkpoint.projectId || '',
      kind: checkpoint.kind || 'checkpoint_request',
      routingKey: inbound.routingKey,
      reply: userContent.trim(),
      question: checkpoint.question || '',
    }

    return {
      checkpointId,
      content: `收到人类 checkpoint 回复，请按 handle_checkpoint_reply / 当前 SOP 继续推进，并在需要时记录 checkpoint_reply_classified 事件。\n\n${JSON.stringify(payload, null, 2)}`,
    }
  }

  async shutdown() {
    this._queues.clear()
    for (const waker of (this._wakers?.values() || [])) waker()
    this._wakers?.clear()
    this._workers.clear()
  }
}

function _buildAttachmentMessage(sandboxPath, originalText) {
  let msg = `用户发来了文件，已自动保存至沙盒路径：\n\`${sandboxPath}\`\n请根据文件内容完成用户的需求。`
  if (originalText) msg += `\n\n用户附言：${originalText}`
  return msg
}
