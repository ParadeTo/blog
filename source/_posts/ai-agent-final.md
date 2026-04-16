---
title: 简单实战一下，从零搭建一个完整的 AI Agent
date: 2026-04-16 10:00:00
tags:
  - ai
  - agent
categories:
  - ai
description: 把前五篇的所有概念整合成一个完整的飞书 Agent 产品：Session 会话管理、Podman 沙箱执行、飞书接入，附完整可运行代码。
---

## 前言

这个系列写到现在，前五篇分别聊了 Skill 系统、ReAct 循环、Context Engineering、文件系统记忆和 RAG 长期记忆。每一篇都是一个相对独立的概念，配合一些能跑起来的代码片段。但如果你把这些代码攒到一起，会发现它们之间还缺很多胶水——消息从哪来、会话怎么隔离、代码在哪执行、附件怎么处理。

本篇就是补齐这些胶水的。我们会把前面所有的概念整合进一个真实可运行的产品：**小圈**，一个跑在飞书上的私人工作助手。

整合的方式不是把代码堆在一起，而是围绕几个核心问题展开：
- 多个人同时发消息，Agent 怎么保证各自的会话不串？
- Skill 里有数据库操作、API 调用，怎么安全地执行？
- 飞书消息的长连接怎么接？附件怎么下载？
- Loading 效果怎么做？

这四个问题对应了本篇最重要的四个模块：Session 系统、沙箱执行、飞书接入、以及把前面所有东西串起来的 Runner。

---

## 一、整体架构

先把整体的数据流说清楚，再拆开讲每个模块。

![整体架构](./ai-agent-final/arch.png)

---

## 二、Session 系统

### 为什么需要 Session

最开始做的时候，我直接把 `routingKey`（用户或群组标识）当 key 存一个 Map，对话历史往里加就完了。这在单人测试时没问题，但一旦多人同时使用，或者同一个人在不同设备上发消息，就会出现各种问题：

1. 对话历史全局共享，A 问的问题 B 看得到（如果 group 没隔离）
2. 没有"开始新对话"的机制
3. 重启进程历史全没了

Session 系统解决的就是这三个问题：**隔离、重置、持久化**。

![Session 生命周期](./ai-agent-final/session.png)

### routingKey 是什么

routingKey 是会话路由的基础单位，由 `session-key.js` 生成：

```js
export function resolveRoutingKey(chatType, senderId, chatId, threadId) {
  if (chatType === 'p2p') return `p2p:${senderId}`
  if (threadId) return `thread:${chatId}:${threadId}`
  return `group:${chatId}`
}
```

三种情况：
- `p2p:{open_id}`：私聊，每个用户独立会话
- `thread:{chat_id}:{thread_id}`：群里的话题，以话题为单位
- `group:{chat_id}`：普通群消息，整个群共用一个会话

这个设计很关键。私聊的 key 是用户维度的，同一个人从不同端发消息都路由到同一个 Session；群聊默认群级别，如果有话题则精确到话题。

### 会话生命周期

核心是 `SessionManager`，完整代码在 `src/session/session-manager.js`：

```js
export class SessionManager {
  constructor(dataDir) {
    this._sessionsDir = path.join(dataDir, 'sessions')
    fs.mkdirSync(this._sessionsDir, {recursive: true})
    // 清理上次未完成的原子写
    const tmpPath = path.join(this._sessionsDir, 'index.json.tmp')
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
  }

  async getOrCreate(routingKey) {
    const index = this._readIndex()
    if (index[routingKey]) {
      const entry = index[routingKey]
      const session = entry.sessions.find(s => s.id === entry.activeSessionId)
      return session || this._createNewSession(routingKey, index)
    }
    return this._createNewSession(routingKey, index)
  }

  async reset(routingKey) {
    const index = this._readIndex()
    return this._createNewSession(routingKey, index)
  }
```

`getOrCreate` 的逻辑：先查 index，找到当前活跃的 session 返回；没有就新建。`reset` 直接新建，旧历史留着但不再激活。

### JSONL 持久化

每个 Session 对应一个 `.jsonl` 文件，每行一条记录：

```js
async append(sessionId, {user, feishuMsgId, assistant}) {
  const now = Date.now()
  const userRecord = JSON.stringify({type: 'message', role: 'user', content: user, ts: now, feishuMsgId})
  const assistantRecord = JSON.stringify({type: 'message', role: 'assistant', content: assistant, ts: now})
  const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
  fs.appendFileSync(jsonlPath, userRecord + '\n' + assistantRecord + '\n')
  // ... 同步更新 index 中的 messageCount
}
```

JSONL 格式的好处是 append-only，不需要读整个文件再写回，对高频写入很友好。读历史时：

```js
async loadHistory(sessionId, maxTurns = 20) {
  const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').filter(Boolean)
  const messages = []
  for (const line of lines) {
    const record = JSON.parse(line)
    if (record.type !== 'message') continue
    messages.push({role: record.role, content: record.content, ...})
  }
  return messages.slice(-maxTurns)
}
```

只取最近 `maxTurns` 条，防止历史过长撑爆上下文窗口。

### index.json 原子写

所有 Session 的元数据（id、创建时间、消息数）都存在 `index.json`，这个文件会被频繁读写。为了防止写到一半进程崩了导致文件损坏：

```js
_writeIndex(data) {
  const indexPath = path.join(this._sessionsDir, 'index.json')
  const tmpPath = indexPath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
  fs.renameSync(tmpPath, indexPath)  // 原子操作
}
```

先写临时文件，再 rename。`rename` 在同一文件系统内是原子操作，要么成功要么失败，不会出现中间状态。构造函数里启动时也会清理上次遗留的 `.tmp` 文件。

### per-routingKey 队列串行

这个逻辑在 Runner 里实现，但和 Session 强相关，所以一起说。

同一个 routingKey 的消息必须串行处理——如果 A 问了个问题还没回答，B 又来一条（同一个群里），两个 `runAgent()` 并发执行会造成 Session 写入竞争。

Runner 的解决方式是每个 routingKey 维护一个队列和一个 Worker 协程：

```js
async dispatch(inbound) {
  const {routingKey} = inbound
  if (!this._queues.has(routingKey)) {
    this._queues.set(routingKey, [])
    this._startWorker(routingKey)
  }
  this._queues.get(routingKey).push(inbound)
  const waker = this._wakers?.get(routingKey)
  if (waker) waker()  // 唤醒等待的 Worker
}
```

Worker 用 Promise + resolve 实现等待/唤醒，空闲超过 `idleTimeoutS`（默认 5 分钟）自动销毁：

```js
async _workerLoop(routingKey) {
  while (true) {
    const queue = this._queues.get(routingKey)
    if (!queue || queue.length === 0) {
      const gotMessage = await new Promise(resolve => {
        this._wakers.set(routingKey, () => resolve(true))
        setTimeout(() => resolve(false), this._idleTimeoutS * 1000)
      })
      if (!gotMessage) {
        // 超时，清理资源
        this._queues.delete(routingKey)
        this._workers.delete(routingKey)
        this._wakers.delete(routingKey)
        return
      }
      continue
    }
    const inbound = queue.shift()
    await this._handle(inbound)  // 串行，一条处理完再取下一条
  }
}
```

这个模式保证了同一会话的消息严格按顺序处理，同时不同 routingKey 之间完全并行，互不影响。

---

## 三、沙箱执行

### 为什么需要沙箱

Skill 脚本里有很多"危险"操作：查数据库、调第三方 API、写文件、有时候还要执行用户给的代码片段。如果直接在主进程里跑，有几个问题：

1. **凭证暴露**：数据库密码、API Key 都在环境变量里，Skill 脚本能直接读到，而 LLM 生成的代码也能读到
2. **资源失控**：一个死循环或者内存泄漏会把主进程拖垮
3. **文件系统污染**：乱写文件没有隔离

解决方案是用 Podman 容器做沙箱。每次执行 Skill 脚本，起一个新容器，跑完自动销毁（`--rm`）。

![沙箱执行流程](./ai-agent-final/sandbox.png)

### PodmanSandbox 实现

```js
export class PodmanSandbox {
  constructor({image = 'xiaoquan-sandbox:latest', timeoutMs = 30000, dataDir = './data'} = {}) {
    this._image = image
    this._timeoutMs = timeoutMs
    this._dataDir = path.resolve(dataDir)
    this._credentialsDir = path.join(this._dataDir, '.sandbox-credentials')
  }
```

构造时接受三个参数：容器镜像名、超时时间（毫秒）、数据目录。凭证目录 `.sandbox-credentials` 放在 `dataDir` 下，注意这个目录要加入 `.gitignore`。

### 凭证注入

凭证以 JSON 文件形式写入 `credentialsDir`，挂载进容器的 `/workspace/.config`：

```js
writeCredentials(credentials) {
  fs.mkdirSync(this._credentialsDir, {recursive: true})
  for (const [name, data] of Object.entries(credentials)) {
    fs.writeFileSync(
      path.join(this._credentialsDir, `${name}.json`),
      JSON.stringify(data, null, 2)
    )
  }
}
```

在 `index.js` 里启动时注入：

```js
const sandbox = new PodmanSandbox({...})
sandbox.writeCredentials({
  feishu: {app_id: config.feishu.app_id, app_secret: config.feishu.app_secret},
})
```

Skill 脚本通过读取 `/workspace/.config/feishu.json` 获取凭证，**而不是从环境变量读**。这样 LLM 生成的代码即使尝试 `os.environ.get('FEISHU_APP_SECRET')`，也拿不到任何东西。凭证只存在于文件挂载，且是只读的（`:ro`）。

### 文件挂载与执行

```js
_buildMounts(sessionDir) {
  const mounts = [
    '-v', `${path.resolve('skills')}:/mnt/skills:ro`,  // Skill 脚本只读
  ]
  if (fs.existsSync(this._credentialsDir)) {
    mounts.push('-v', `${this._credentialsDir}:/workspace/.config:ro`)  // 凭证只读
  }
  if (sessionDir) {
    const absSessionDir = path.resolve(sessionDir)
    fs.mkdirSync(absSessionDir, {recursive: true})
    mounts.push('-v', `${absSessionDir}:/workspace/session:rw`)  // 会话目录可读写
  }
  return mounts
}
```

三个挂载点的权限设计很清楚：
- `skills/`：只读，脚本本身不能被修改
- `.sandbox-credentials/`：只读，凭证不能被覆盖
- `session/{sessionId}/`：读写，供附件上传（`uploads/`）和结果输出（`outputs/`）

执行时：

```js
async execute(scriptPath, args = '', {sessionDir = null} = {}) {
  const mounts = this._buildMounts(sessionDir)
  const containerScriptPath = `/mnt/skills/${path.relative(path.resolve('skills'), scriptPath)}`

  const cmd = [
    'run', '--rm',
    `--timeout=${Math.ceil(this._timeoutMs / 1000)}`,
    '--network=host',
    ...mounts,
    this._image,
    'python3', containerScriptPath, ...args.split(' ').filter(Boolean),
  ]

  try {
    const {stdout, stderr} = await execFileAsync('podman', cmd, {timeout: this._timeoutMs})
    if (stderr) console.error('[Sandbox stderr]', stderr)
    return stdout.trim()
  } catch (e) {
    if (e.killed) return `执行超时（${this._timeoutMs / 1000}s）`
    return `执行失败: ${e.message}`
  }
}
```

注意 `--network=host` 是因为 Skill 脚本需要访问本机的数据库和内部 API。如果你的场景是完全隔离网络，可以去掉这个选项。超时控制有两层：Podman 自己的 `--timeout` 和 Node 的 `execFileAsync` timeout，双保险。

用户上传的文件被 Runner 放到 `data/workspace/sessions/{sessionId}/uploads/`，挂载后在容器内是 `/workspace/session/uploads/`，Skill 脚本可以直接读。Skill 生成的文件写到 `/workspace/session/outputs/`，宿主机上对应的路径就可以下载或返回给用户。

---

## 四、飞书接入

![飞书消息处理流程](./ai-agent-final/feishu.png)

### WebSocket 长连接

飞书 Bot 接收消息有两种方式：webhook（HTTP 回调）和 WebSocket 长连接。小圈选 WebSocket，原因很简单——本地开发时不需要公网地址，部署时也不需要配置 Nginx 反向代理，直连飞书服务器就行。

`FeishuListener` 封装了飞书官方 SDK 的 WSClient：

```js
export class FeishuListener {
  constructor({appId, appSecret, onMessage, allowedChats = []}) {
    this._onMessage = onMessage
    this._allowedChats = new Set(allowedChats)
    this._client = new lark.Client({appId, appSecret})

    this._wsClient = new lark.WSClient({
      appId,
      appSecret,
      eventDispatcher: new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data) => {
          await this._handleMessage(data)
        },
      }),
      loggerLevel: lark.LoggerLevel.WARN,
    })
  }
```

`allowedChats` 是群组白名单，留空则允许所有群。私聊始终放行（`chatType === 'p2p'` 直接返回 true）。

为什么要有白名单？Bot 加入群后，群里所有消息它都能收到（开了消息权限的话），但不是每个群的消息都应该触发 Agent。白名单让你精确控制哪些群接入。

### 消息类型解析

飞书消息有多种类型，`_extractContent` 统一处理：

```js
_extractContent(msgType, contentJson) {
  // ...
  if (msgType === 'text') {
    content = parsed.text || ''
  } else if (msgType === 'post') {
    content = this._extractPostText(parsed)
  } else if (msgType === 'image') {
    attachment = {msgType: 'image', fileKey: parsed.image_key, fileName: `${parsed.image_key}.jpg`}
  } else if (msgType === 'file') {
    attachment = {msgType: 'file', fileKey: parsed.file_key, fileName: parsed.file_name || parsed.file_key}
  }
  return {content, attachment}
}
```

`post` 类型是富文本，结构比较复杂，需要递归提取文本段落：

```js
_extractPostText(data) {
  const parts = []
  const zhContent = data?.zh_cn || data?.en_us
  if (!zhContent) return ''
  if (zhContent.title) parts.push(zhContent.title)
  for (const paragraph of (zhContent.content || [])) {
    for (const element of paragraph) {
      if (element.tag === 'text') parts.push(element.text)
    }
  }
  return parts.join(' ')
}
```

图片和文件不直接传内容，只拿到 `fileKey`，实际下载发生在 Runner 处理消息的时候。

### 附件下载

`FeishuDownloader` 负责把附件从飞书服务器拉到本地：

```js
async download(msgId, attachment, sessionId) {
  const destDir = path.join(this._dataDir, 'workspace', 'sessions', sessionId, 'uploads')
  fs.mkdirSync(destDir, {recursive: true})
  const destPath = path.join(destDir, attachment.fileName)

  const resp = await this._client.im.messageResource.get({
    path: {message_id: msgId, file_key: attachment.fileKey},
    params: {type: attachment.msgType},
  })

  if (resp?.data) {
    const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data)
    fs.writeFileSync(destPath, buffer)
    return destPath
  }
  return null
}
```

下载到 `data/workspace/sessions/{sessionId}/uploads/`，这个路径正好是沙箱挂载 `/workspace/session/` 的宿主机对应路径，所以 Skill 脚本不需要任何额外处理就能读到用户上传的文件。

Runner 处理附件时会构造一条特殊的用户消息告诉 Agent：

```js
function _buildAttachmentMessage(sandboxPath, originalText) {
  let msg = `用户发来了文件，已自动保存至沙盒路径：\n\`${sandboxPath}\`\n请根据文件内容完成用户的需求。`
  if (originalText) msg += `\n\n用户附言：${originalText}`
  return msg
}
```

这样 Agent 知道文件在哪，可以直接告诉 Skill 脚本去读。

### 卡片消息与 Loading 效果

纯文本消息体验很差，飞书支持"卡片消息"（interactive），可以在收到回复后动态更新内容。这正好用来做 Loading 效果。

流程是：
1. 用户发消息，立刻发一张"思考中"卡片，拿到这张卡片的 `message_id`
2. 调用 `runAgent()`，期间用户看到"思考中"
3. Agent 返回结果，用结果更新那张卡片

```js
async sendThinking(routingKey, rootId = null) {
  const card = this._buildCard('⏳ 思考中，请稍候...')
  // 按 routingKey 类型选择发送方式...
  return resp?.data?.message_id || null
}

async updateCard(cardMsgId, content) {
  const card = this._buildCard(content)
  await this._client.im.message.patch({
    path: {message_id: cardMsgId},
    data: {content: card},
  })
}
```

卡片内容用 `lark_md` 格式，支持 Markdown 渲染，粗体、代码块、列表都能用。

Runner 里的调用顺序：

```js
const cardMsgId = await this._sender.sendThinking(routingKey, rootId)
const reply = await this._agentFn(userContent, history, ...)
if (cardMsgId) {
  await this._sender.updateCard(cardMsgId, reply)
} else {
  await this._sender.send(routingKey, reply, rootId)
}
```

`sendThinking` 可能失败（网络问题），这时候 `cardMsgId` 为 null，降级为普通发送。

### Slash 命令

对话型 Bot 经常需要一些控制命令，比如重置会话、查看状态。小圈用斜杠命令实现：

```js
const SLASH_COMMANDS = new Set(['/new', '/verbose', '/help', '/status'])

async _handleSlash(inbound) {
  const text = inbound.content.trim()
  if (!text.startsWith('/')) return null
  const [cmd, ...args] = text.split(/\s+/)
  if (!SLASH_COMMANDS.has(cmd)) return null

  switch (cmd) {
    case '/new': {
      const session = await this._sessionMgr.reset(routingKey)
      return `已创建新对话 (${session.id})，之前的历史不会带入。`
    }
    case '/verbose': {
      const arg = args[0]?.toLowerCase()
      if (arg === 'on' || arg === 'off') {
        await this._sessionMgr.updateVerbose(routingKey, arg === 'on')
        return `详细模式已${arg === 'on' ? '开启' : '关闭'}`
      }
      // 无参数则返回当前状态
    }
    case '/status': {
      const session = await this._sessionMgr.getOrCreate(routingKey)
      return `会话 ID: ${session.id}\n消息数: ${session.messageCount}\n详细模式: ${session.verbose ? '开启' : '关闭'}`
    }
  }
}
```

`/verbose on` 开启后，Agent 每跑一个工具就会实时推送中间步骤，方便调试或者让用户看到 Agent 在干什么。这是通过 `runAgent()` 的 `onStep` 回调实现的，在 `index.js` 里组装：

```js
const agentFn = async (userMessage, history, sessionId, routingKey, rootId, verbose) => {
  const onStep = verbose
    ? ({step, toolName, args, result}) => {
        sender.send(routingKey, `💭 [Step ${step}] ${toolName}(${JSON.stringify(args)})\n${result}`, rootId)
          .catch(() => {})
      }
    : null

  return runAgent({userMessage, history, sessionId, routingKey, config, onStep})
}
```

Slash 命令在 `_handle()` 里优先处理，命中则直接返回文本消息，不经过 Agent：

```js
async _handle(inbound) {
  const slashReply = await this._handleSlash(inbound)
  if (slashReply !== null) {
    await this._sender.sendText(routingKey, slashReply, rootId)
    return
  }
  // ... 正常 Agent 处理流程
}
```

### 断线重连

WebSocket 连接不稳定是常态，`runForever` 做了无限重试：

```js
export async function runForever(listener) {
  while (true) {
    try {
      await listener.start()
    } catch (e) {
      console.error('[FeishuListener] connection error, retrying in 5s:', e.message)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}
```

`listener.start()` 是一个长期阻塞的 promise，正常情况下不会 resolve。如果连接断开抛异常，5 秒后重试。

---

## 五、已有模块整合

前四篇讲的内容在小圈里是这样整合的：

**Skill 系统**（[第一篇](/2026/04/07/ai-agent-skill/)、[第二篇](/2026/04/09/ai-agent-skill-2/)）

Skill 脚本放在 `skills/` 目录，每个 Skill 一个子目录，包含 `SKILL.md`（行为指令）和 Python 执行脚本。`loadSkillRegistry()` 在 Agent 启动时扫描这个目录，注册成 `list_skills` 和 `get_skill` 两个工具。Agent 看到用户需求后，先调 `list_skills` 了解有哪些能力，再调 `get_skill` 获取详细指令，最后按指令调用沙箱执行。整个过程是标准的 ReAct 循环，详见[第二篇](/2026/04/09/ai-agent-skill-2/)。

**上下文管理**（[第三篇](/2026/04/11/ai-context-engineering/)）

`react-loop.js` 里集成了三个上下文管理策略：

- `pruneToolResults()`：在每次 LLM 调用前，把旧的 Tool Result 截断，只保留最近 N 轮，防止工具调用结果堆积撑爆窗口
- `maybeCompress()`：当 prompt token 数超过阈值（默认 80000），把历史对话压缩为摘要
- `loadSessionCtx()` / `saveSessionCtx()`：把压缩后的对话上下文持久化到磁盘，进程重启后可以恢复

这些机制对用户完全透明，详见[第三篇](/2026/04/11/ai-context-engineering/)。

**文件系统记忆**（[第四篇](/2026/04/14/ai-mem-file/)）

`buildBootstrapPrompt()` 在系统提示里注入 `workspace/` 目录下的四个文件：`soul.md`（Agent 人格）、`user.md`（用户画像）、`agent.md`（行为规则）、`memory.md`（记忆索引）。这些文件由 `memory-governance` Skill 负责维护，Agent 在对话中自动更新。详见[第四篇](/2026/04/14/ai-mem-file/)。

```js
const bootstrapPrompt = buildBootstrapPrompt(workspaceDir)
const systemPrompt = `${bootstrapPrompt}

你是小圈，一个飞书上的私人工作助手。
你拥有一组 Skill（专项能力），需要时用 list_skills 查看可用列表，用 get_skill 获取详细指令。
根据用户需求，自主决定每一步该做什么。`
```

**RAG 长期记忆**（[第五篇](/2026/04/15/ai-mem-rag/)）

Agent 有一个 `memory_search` 工具，通过 pgvector 做混合检索（向量 + BM25），在需要回忆历史的时候调用。记忆的写入由 `memory-save` Skill 负责，在重要对话结束后触发。详见[第五篇](/2026/04/15/ai-mem-rag/)。

---

## 六、把它跑起来

配置文件 `config.yaml` 从模板复制并填入你的飞书应用凭证：

```yaml
feishu:
  app_id: "${FEISHU_APP_ID}"
  app_secret: "${FEISHU_APP_SECRET}"
  allowed_chats: []   # 留空则允许所有群，填群 ID 则只接入指定群

llm:
  model: "claude-sonnet-4-6"
  max_iter: 10

memory:
  workspace_dir: "./workspace"
  db_dsn: "postgresql://xiaoquan:xiaoquan123@localhost:5432/xiaoquan_memory"
  token_threshold: 80000

sandbox:
  image: "xiaoquan-sandbox:latest"
  timeout_ms: 30000

data_dir: "./data"
```

环境变量注入（`${FEISHU_APP_ID}` 这种语法在 `config.js` 里处理）：

```bash
export FEISHU_APP_ID=cli_xxxxxxxxx
export FEISHU_APP_SECRET=xxxxxxxxx
node src/index.js
```

启动后输出：

```
=== 小圈 · 飞书工作助手 ===
[Session] initialized
[Sandbox] credentials injected
[Feishu] WebSocket connecting...
```

调试时可以开 `debug.enable_test_api: true`，会在本地起一个 HTTP 接口，不需要真实飞书消息就能测试 Agent 响应。

---

## 总结

这个系列写了六篇，走了一条从概念到产品的路：

- 第一、二篇：如何让 Agent 有专项能力（Skill + ReAct）
- 第三篇：如何在长对话中管理有限的上下文窗口
- 第四、五篇：如何让 Agent 有记忆（文件记忆 + RAG）
- 本篇：如何把这些能力整合成一个真实可用的产品

小圈的定位是一个**私人工作助手**，不是通用的大模型应用。它的核心价值在于：能用飞书里积累的数据（通讯录、日历、文件）做事，而不只是聊天。这也是 Skill 系统存在的意义——每个 Skill 都是对一类飞书能力的封装，Agent 按需调用。

整个项目的代码量不大（核心模块不到 600 行），但每一块都有清晰的职责边界。Session 管会话，沙箱管执行，飞书模块管 IO，Runner 管调度，Agent 管推理。这种模块化让你可以按需替换——比如把飞书换成微信，只需要重写 `feishu/` 目录下的几个文件，其他模块不用动。

如果你跟着这个系列一路看下来，应该能把小圈跑起来，也能根据自己的需求改造它。代码在 `/Users/youxingzhi/ayou/blog/demo/xiaoquan/`，祝玩得开心。
