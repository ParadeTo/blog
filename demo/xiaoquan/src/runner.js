import path from 'path'

const HELP_TEXT = `小圈 可用命令：
/new       — 创建新对话，之前历史不带入
/verbose on|off — 开启/关闭推理过程推送
/status    — 查看当前会话信息
/help      — 显示此帮助`

const SLASH_COMMANDS = new Set(['/new', '/verbose', '/help', '/status'])

export class Runner {
  constructor(sessionMgr, sender, agentFn, {idleTimeoutS = 300, downloader = null} = {}) {
    this._sessionMgr = sessionMgr
    this._sender = sender
    this._agentFn = agentFn
    this._idleTimeoutS = idleTimeoutS
    this._downloader = downloader
    this._queues = new Map()
    this._workers = new Map()
  }

  async dispatch(inbound) {
    const {routingKey} = inbound
    if (!this._queues.has(routingKey)) {
      this._queues.set(routingKey, [])
      this._startWorker(routingKey)
    }
    this._queues.get(routingKey).push(inbound)
    const waker = this._wakers?.get(routingKey)
    if (waker) waker()
  }

  _startWorker(routingKey) {
    if (!this._wakers) this._wakers = new Map()
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
        try {
          await this._sender.send(inbound.routingKey, `处理出错：${e.message}`, inbound.rootId)
        } catch {}
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
        userContent = _buildAttachmentMessage(absPath, userContent)
      }
    }

    if (!userContent || !userContent.trim()) {
      console.log(`[Runner] empty content after processing, skipping`)
      return
    }

    console.log(`[Runner] session=${session.id} userContent=${JSON.stringify(userContent).slice(0, 200)}`)

    const history = await this._sessionMgr.loadHistory(session.id)
    console.log(`[Runner] history turns=${history.length}`)

    const cardMsgId = await this._sender.sendThinking(routingKey, rootId)

    const reply = await this._agentFn(userContent, history, session.id, routingKey, rootId, session.verbose)
    console.log(`[Runner] reply length=${reply.length}`)

    await this._sessionMgr.append(session.id, {
      user: userContent,
      feishuMsgId: inbound.msgId,
      assistant: reply,
    })

    if (cardMsgId) {
      await this._sender.updateCard(cardMsgId, reply)
    } else {
      await this._sender.send(routingKey, reply, rootId)
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
