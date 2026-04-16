# xiaoquan (小圈) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port xiaopaw (Python) to JavaScript as xiaoquan (小圈), a Feishu-based AI Agent with Skill system, three-layer memory, and Podman sandbox execution.

**Architecture:** 1:1 module mapping from xiaopaw. Replace CrewAI with custom ReAct loop (from article series). Replace AliyunLLM with Vercel AI SDK + Anthropic Claude. All other modules (session, feishu, sandbox, memory) are direct ports.

**Tech Stack:** Node.js 20+, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`), `@larksuiteoapi/node-sdk`, PostgreSQL + pgvector, Podman, js-yaml

**Code location:** `/Users/youxingzhi/ayou/xiaoquan/`
**Article location:** `/Users/youxingzhi/ayou/blog/source/_posts/ai-agent-final.md`
**Reference project:** `/Users/youxingzhi/ayou/xiaopaw-with-memory/`

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `src/config.js`
- Create: `.gitignore`
- Create: `config.yaml.template`
- Create: `workspace-init/soul.md`
- Create: `workspace-init/user.md`
- Create: `workspace-init/agent.md`
- Create: `workspace-init/memory.md`
- Create: `schema.sql`

- [ ] **Step 1: Create project directory and initialize**

```bash
mkdir -p /Users/youxingzhi/ayou/xiaoquan
cd /Users/youxingzhi/ayou/xiaoquan
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "xiaoquan",
  "version": "1.0.0",
  "description": "小圈 — 飞书本地工作助手（JS 版）",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test tests/**/*.test.js"
  },
  "dependencies": {
    "ai": "^4.3.0",
    "@ai-sdk/anthropic": "^1.2.0",
    "@ai-sdk/openai": "^1.2.0",
    "@larksuiteoapi/node-sdk": "^1.0.0",
    "pg": "^8.13.0",
    "pgvector": "^0.2.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/youxingzhi/ayou/xiaoquan && npm install
```

Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 4: Create .gitignore**

```
node_modules/
data/
.env
config.yaml
```

- [ ] **Step 5: Create config.yaml.template**

Copy config structure from design spec (section 10). This is the template users copy to `config.yaml` and fill in:

```yaml
feishu:
  app_id: "${FEISHU_APP_ID}"
  app_secret: "${FEISHU_APP_SECRET}"
  allowed_chats: []

llm:
  model: "claude-sonnet-4-6"
  embedding_model: "text-embedding-3-small"
  max_iter: 10
  temperature: 0.3

memory:
  workspace_dir: "./workspace"
  ctx_dir: "./data/ctx"
  db_dsn: "postgresql://xiaoquan:xiaoquan123@localhost:5432/xiaoquan_memory"
  token_threshold: 80000
  prune_keep_turns: 10
  compress_threshold: 0.45
  fresh_keep_turns: 10

sandbox:
  image: "xiaoquan-sandbox:latest"
  timeout_ms: 30000
  mcp_port: 8022

session:
  data_dir: "./data/sessions"
  max_history_turns: 20

runner:
  idle_timeout_s: 300

sender:
  max_retries: 3
  retry_backoff: [1, 2, 4]

data_dir: "./data"

debug:
  enable_test_api: false
  test_api_port: 9090
  test_api_host: "127.0.0.1"
```

- [ ] **Step 6: Create src/config.js**

```javascript
import fs from 'fs'
import yaml from 'js-yaml'
import path from 'path'

let _config = null

export function loadConfig(configPath = 'config.yaml') {
  if (_config) return _config
  const raw = fs.readFileSync(configPath, 'utf-8')
  // Replace ${ENV_VAR} with env values
  const resolved = raw.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '')
  _config = yaml.load(resolved)
  return _config
}

export function getConfig() {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.')
  return _config
}
```

- [ ] **Step 7: Create workspace-init/ template files**

`workspace-init/soul.md`:
```markdown
你是小圈，一个飞书上的私人工作助手。
性格：务实、简洁、偶尔幽默。
原则：先确认再执行，不确定就问。
```

`workspace-init/user.md`:
```markdown
（请根据实际用户信息修改）
姓名：
职业：
偏好：
```

`workspace-init/agent.md`:
```markdown
工作流程：
1. 收到任务先拆解步骤
2. 每步完成后汇报进度
3. 遇到模糊需求主动澄清

工具使用规则：
- 优先用已有工具完成任务
- 文件操作前先确认路径
- 搜索结果只取前 3 条
```

`workspace-init/memory.md`:
```markdown
# 记忆索引
（Agent 会自动在此追加记忆条目）
```

- [ ] **Step 8: Create schema.sql**

Port from xiaopaw, adjust vector dimensions from 1024 to 1536 (text-embedding-3-small):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
    id              TEXT        PRIMARY KEY,
    session_id      TEXT        NOT NULL,
    routing_key     TEXT        NOT NULL,
    user_message    TEXT        NOT NULL,
    assistant_reply TEXT        NOT NULL,
    summary         TEXT        NOT NULL,
    tags            TEXT[]      NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    turn_ts         BIGINT      NOT NULL,
    summary_vec     vector(1536),
    message_vec     vector(1536),
    search_text     TEXT        NOT NULL DEFAULT '',
    search_tsv      TSVECTOR   GENERATED ALWAYS AS
                      (to_tsvector('simple', search_text)) STORED
);

CREATE INDEX IF NOT EXISTS memories_summary_vec_idx
    ON memories USING hnsw (summary_vec vector_cosine_ops);
CREATE INDEX IF NOT EXISTS memories_message_vec_idx
    ON memories USING hnsw (message_vec vector_cosine_ops);
CREATE INDEX IF NOT EXISTS memories_search_tsv_idx
    ON memories USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS memories_routing_key_idx
    ON memories (routing_key);
CREATE INDEX IF NOT EXISTS memories_created_at_idx
    ON memories (created_at DESC);
CREATE INDEX IF NOT EXISTS memories_tags_idx
    ON memories USING gin (tags);
```

- [ ] **Step 9: Create directory structure**

```bash
mkdir -p src/{llm,feishu,agent,tools,session,memory,sandbox,api}
mkdir -p skills workspace-init data tests
```

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffold with config, schema, workspace templates"
```

---

## Task 2: Models

**Files:**
- Create: `src/models.js`

- [ ] **Step 1: Create src/models.js**

Port from xiaopaw `models.py`. JS uses plain objects, no frozen dataclass needed:

```javascript
/**
 * @typedef {Object} Attachment
 * @property {string} msgType   - "image" | "file"
 * @property {string} fileKey   - Feishu file_key or image_key
 * @property {string} fileName  - "{image_key}.jpg" for images
 */

/**
 * @typedef {Object} InboundMessage
 * @property {string} routingKey  - "p2p:{open_id}" | "group:{chat_id}" | "thread:{chat_id}:{thread_id}"
 * @property {string} content     - plain text
 * @property {string} msgId       - Feishu message_id
 * @property {string} rootId      - thread root message ID
 * @property {string} senderId    - open_id
 * @property {number} ts          - millisecond timestamp
 * @property {boolean} isCron     - true if from CronService
 * @property {Attachment|null} attachment
 */

/**
 * @param {Object} opts
 * @returns {InboundMessage}
 */
export function createInboundMessage({
  routingKey,
  content = '',
  msgId,
  rootId,
  senderId,
  ts = Date.now(),
  isCron = false,
  attachment = null,
}) {
  return {routingKey, content, msgId, rootId: rootId || msgId, senderId, ts, isCron, attachment}
}

/**
 * @typedef {Object} MessageEntry
 * @property {string} role      - "user" | "assistant"
 * @property {string} content
 * @property {number} ts        - millisecond timestamp
 * @property {string|null} feishuMsgId
 */

/**
 * @typedef {Object} SessionEntry
 * @property {string} id          - "s-{12hex}"
 * @property {string} createdAt   - ISO 8601 UTC
 * @property {boolean} verbose
 * @property {number} messageCount
 */
```

- [ ] **Step 2: Commit**

```bash
git add src/models.js
git commit -m "feat: add data models (InboundMessage, MessageEntry, SessionEntry)"
```

---

## Task 3: Session Manager

**Files:**
- Create: `src/session/session-manager.js`
- Create: `tests/session-manager.test.js`

- [ ] **Step 1: Write tests for SessionManager**

```javascript
// tests/session-manager.test.js
import {describe, it, before, after, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {SessionManager} from '../src/session/session-manager.js'

describe('SessionManager', () => {
  let tmpDir
  let mgr

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-test-'))
    mgr = new SessionManager(tmpDir)
  })

  after(() => {
    // cleanup handled by OS
  })

  it('getOrCreate returns new session for unknown routing_key', async () => {
    const session = await mgr.getOrCreate('p2p:ou_test001')
    assert.ok(session.id.startsWith('s-'))
    assert.equal(session.id.length, 14) // "s-" + 12 hex
    assert.equal(session.verbose, false)
    assert.equal(session.messageCount, 0)
  })

  it('getOrCreate returns same session on second call', async () => {
    const s1 = await mgr.getOrCreate('p2p:ou_test001')
    const s2 = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(s1.id, s2.id)
  })

  it('different routing_keys get different sessions', async () => {
    const s1 = await mgr.getOrCreate('p2p:ou_a')
    const s2 = await mgr.getOrCreate('p2p:ou_b')
    assert.notEqual(s1.id, s2.id)
  })

  it('reset creates new session, preserves old JSONL', async () => {
    const s1 = await mgr.getOrCreate('p2p:ou_test001')
    await mgr.append(s1.id, {user: 'hello', feishuMsgId: 'm1', assistant: 'hi'})
    const s2 = await mgr.reset('p2p:ou_test001')
    assert.notEqual(s1.id, s2.id)
    // Old JSONL still exists
    assert.ok(fs.existsSync(path.join(tmpDir, 'sessions', `${s1.id}.jsonl`)))
  })

  it('append and loadHistory round-trip', async () => {
    const session = await mgr.getOrCreate('p2p:ou_test001')
    await mgr.append(session.id, {user: 'hello', feishuMsgId: 'm1', assistant: 'hi there'})
    await mgr.append(session.id, {user: 'bye', feishuMsgId: 'm2', assistant: 'goodbye'})
    const history = await mgr.loadHistory(session.id)
    assert.equal(history.length, 4) // 2 user + 2 assistant
    assert.equal(history[0].role, 'user')
    assert.equal(history[0].content, 'hello')
    assert.equal(history[1].role, 'assistant')
    assert.equal(history[1].content, 'hi there')
  })

  it('loadHistory respects maxTurns', async () => {
    const session = await mgr.getOrCreate('p2p:ou_test001')
    for (let i = 0; i < 30; i++) {
      await mgr.append(session.id, {user: `msg${i}`, feishuMsgId: `m${i}`, assistant: `reply${i}`})
    }
    const history = await mgr.loadHistory(session.id, 5)
    assert.equal(history.length, 5)
  })

  it('updateVerbose toggles verbose flag', async () => {
    await mgr.getOrCreate('p2p:ou_test001')
    await mgr.updateVerbose('p2p:ou_test001', true)
    const session = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(session.verbose, true)
  })

  it('append increments messageCount', async () => {
    const s = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(s.messageCount, 0)
    await mgr.append(s.id, {user: 'a', feishuMsgId: 'm1', assistant: 'b'})
    const s2 = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(s2.messageCount, 2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/youxingzhi/ayou/xiaoquan && node --test tests/session-manager.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SessionManager**

```javascript
// src/session/session-manager.js
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export class SessionManager {
  constructor(dataDir) {
    this._sessionsDir = path.join(dataDir, 'sessions')
    fs.mkdirSync(this._sessionsDir, {recursive: true})
    // Clean up leftover tmp file from prior crash
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

  async loadHistory(sessionId, maxTurns = 20) {
    const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
    if (!fs.existsSync(jsonlPath)) return []

    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').filter(Boolean)
    const messages = []
    for (const line of lines) {
      const record = JSON.parse(line)
      if (record.type !== 'message') continue
      messages.push({
        role: record.role,
        content: record.content,
        ts: record.ts,
        feishuMsgId: record.feishuMsgId || null,
      })
    }
    return messages.slice(-maxTurns)
  }

  async append(sessionId, {user, feishuMsgId, assistant}) {
    const now = Date.now()
    const userRecord = JSON.stringify({type: 'message', role: 'user', content: user, ts: now, feishuMsgId})
    const assistantRecord = JSON.stringify({type: 'message', role: 'assistant', content: assistant, ts: now})
    const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
    fs.appendFileSync(jsonlPath, userRecord + '\n' + assistantRecord + '\n')

    // Update message count in index
    const index = this._readIndex()
    for (const key of Object.keys(index)) {
      const entry = index[key]
      const session = entry.sessions.find(s => s.id === sessionId)
      if (session) {
        session.messageCount += 2
        this._writeIndex(index)
        break
      }
    }
  }

  async updateVerbose(routingKey, verbose) {
    const index = this._readIndex()
    const entry = index[routingKey]
    if (!entry) return
    const session = entry.sessions.find(s => s.id === entry.activeSessionId)
    if (session) {
      session.verbose = verbose
      this._writeIndex(index)
    }
  }

  _createNewSession(routingKey, index) {
    const sessionId = 's-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      verbose: false,
      messageCount: 0,
    }
    if (!index[routingKey]) {
      index[routingKey] = {activeSessionId: sessionId, sessions: [session]}
    } else {
      index[routingKey].sessions.push(session)
      index[routingKey].activeSessionId = sessionId
    }
    this._writeIndex(index)

    // Write JSONL meta line
    const jsonlPath = path.join(this._sessionsDir, `${sessionId}.jsonl`)
    const meta = JSON.stringify({type: 'meta', sessionId, routingKey, createdAt: session.createdAt})
    fs.writeFileSync(jsonlPath, meta + '\n')

    return session
  }

  _readIndex() {
    const indexPath = path.join(this._sessionsDir, 'index.json')
    if (!fs.existsSync(indexPath)) return {}
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  }

  _writeIndex(data) {
    const indexPath = path.join(this._sessionsDir, 'index.json')
    const tmpPath = indexPath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
    fs.renameSync(tmpPath, indexPath) // atomic
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/youxingzhi/ayou/xiaoquan && node --test tests/session-manager.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/session-manager.js tests/session-manager.test.js
git commit -m "feat: SessionManager with index.json + JSONL persistence"
```

---

## Task 4: LLM Adapter

**Files:**
- Create: `src/llm/anthropic-llm.js`

- [ ] **Step 1: Implement LLM adapter**

Wraps Vercel AI SDK. Much simpler than xiaopaw's raw HTTP adapter:

```javascript
// src/llm/anthropic-llm.js
import {generateText} from 'ai'
import {anthropic} from '@ai-sdk/anthropic'
import {createOpenAI} from '@ai-sdk/openai'
import {embed} from 'ai'

let _embeddingModel = null

export function getModel(modelId) {
  return anthropic(modelId || 'claude-sonnet-4-6')
}

export function getEmbeddingModel(modelId) {
  if (_embeddingModel) return _embeddingModel
  const openai = createOpenAI({apiKey: process.env.OPENAI_API_KEY})
  _embeddingModel = openai.embedding(modelId || 'text-embedding-3-small')
  return _embeddingModel
}

export async function chat({model, system, messages, tools, maxSteps = 1}) {
  return generateText({
    model: getModel(model),
    system,
    messages,
    tools,
    maxSteps,
  })
}

export async function embedText(text) {
  const {embedding} = await embed({
    model: getEmbeddingModel(),
    value: text,
  })
  return embedding
}

export async function embedMany(texts) {
  const {embedMany: embedManyFn} = await import('ai')
  const {embeddings} = await embedManyFn({
    model: getEmbeddingModel(),
    values: texts,
  })
  return embeddings
}
```

- [ ] **Step 2: Commit**

```bash
git add src/llm/anthropic-llm.js
git commit -m "feat: LLM adapter wrapping Vercel AI SDK + Anthropic"
```

---

## Task 5: Memory — Bootstrap, Pruning, Compression

**Files:**
- Create: `src/memory/bootstrap.js`
- Create: `src/memory/context-pruner.js`
- Create: `src/memory/context-compressor.js`

These are direct ports from the article demos (articles 3).

- [ ] **Step 1: Implement bootstrap.js**

```javascript
// src/memory/bootstrap.js
import fs from 'fs'
import path from 'path'

const MAX_CHARS_PER_FILE = 2000

const SECTIONS = [
  {file: 'soul.md', tag: 'soul'},
  {file: 'user.md', tag: 'user_profile'},
  {file: 'agent.md', tag: 'agent_rules'},
  {file: 'memory.md', tag: 'memory_index'},
]

function readWithLimit(filePath, limit) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (content.length <= limit) return content.trim()
    return content.slice(0, limit).trim() + '\n...(truncated)'
  } catch {
    return ''
  }
}

export function buildBootstrapPrompt(workspaceDir) {
  const parts = SECTIONS
    .map(({file, tag}) => {
      const filePath = path.join(workspaceDir, file)
      const content = readWithLimit(filePath, MAX_CHARS_PER_FILE)
      if (!content) return null
      return `<${tag}>\n${content}\n</${tag}>`
    })
    .filter(Boolean)
  return parts.join('\n\n')
}
```

- [ ] **Step 2: Implement context-pruner.js**

```javascript
// src/memory/context-pruner.js

const MAX_TOOL_RESULT_CHARS = 300
const KEEP_CHARS = 200

/**
 * In-place prune old tool results to save context space.
 * Keeps the most recent `keepTurns` user messages' tool results intact.
 */
export function pruneToolResults(messages, {keepTurns = 10} = {}) {
  // Find all user message indices
  const userIndices = messages
    .map((m, i) => (m.role === 'user' ? i : -1))
    .filter(i => i !== -1)

  if (userIndices.length <= keepTurns) return messages

  const cutoff = userIndices[userIndices.length - keepTurns]

  for (let i = 0; i < cutoff; i++) {
    const msg = messages[i]
    if (msg.role !== 'tool') continue
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    if (content.length <= MAX_TOOL_RESULT_CHARS) continue
    messages[i] = {
      ...msg,
      content: content.slice(0, KEEP_CHARS) + `\n...(truncated, original: ${content.length} chars)`,
    }
  }
  return messages
}
```

- [ ] **Step 3: Implement context-compressor.js**

```javascript
// src/memory/context-compressor.js
import {generateText} from 'ai'
import {getModel} from '../llm/anthropic-llm.js'
import fs from 'fs'
import path from 'path'

const COMPRESS_PROMPT = `你是一个对话压缩器。把下面的对话历史压缩成一段简洁的摘要。

规则：
- 保留所有关键事实（人名、数字、决策结论、文件路径）
- 保留用户表达过的偏好
- 丢弃寒暄、重复确认、中间推理过程
- 不超过 500 字
- 直接输出摘要文本，不要输出其他内容`

/**
 * Estimate token count from messages (conservative: 1 Chinese char ≈ 1 token)
 */
function estimateTokens(messages) {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return sum + Math.ceil(content.length / 2)
  }, 0)
}

/**
 * Compress old messages into a summary, keeping recent ones intact.
 * Returns new messages array (does not mutate input).
 */
export async function maybeCompress(messages, {
  threshold = 80000,
  freshKeepTurns = 10,
  ctxDir = null,
  sessionId = null,
  promptTokens = null,
} = {}) {
  const tokenCount = promptTokens || estimateTokens(messages)
  if (tokenCount < threshold) return messages

  // Separate system and non-system messages
  const systemMsgs = messages.filter(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  // Find cutoff: keep last freshKeepTurns user messages and everything after
  const userIndices = nonSystem.map((m, i) => m.role === 'user' ? i : -1).filter(i => i !== -1)
  if (userIndices.length <= freshKeepTurns) return messages
  const cutoff = userIndices[userIndices.length - freshKeepTurns]

  const oldMsgs = nonSystem.slice(0, cutoff)
  const freshMsgs = nonSystem.slice(cutoff)

  // Persist raw messages before compression
  if (ctxDir && sessionId) {
    const rawPath = path.join(ctxDir, `${sessionId}_raw.jsonl`)
    fs.mkdirSync(ctxDir, {recursive: true})
    for (const m of oldMsgs) {
      fs.appendFileSync(rawPath, JSON.stringify({...m, ts: Date.now()}) + '\n')
    }
  }

  // Generate summary
  const conversationText = oldMsgs
    .map(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return `[${m.role}] ${content}`
    })
    .join('\n')

  let summary
  try {
    const result = await generateText({
      model: getModel(),
      messages: [{role: 'user', content: `${COMPRESS_PROMPT}\n\n${conversationText}`}],
    })
    summary = result.text
  } catch {
    summary = '[压缩失败，内容省略]'
  }

  const summaryMsg = {
    role: 'user',
    content: `<context_summary>\n${summary}\n</context_summary>`,
  }

  const compressed = [...systemMsgs, summaryMsg, ...freshMsgs]

  // Save compressed snapshot
  if (ctxDir && sessionId) {
    const ctxPath = path.join(ctxDir, `${sessionId}_ctx.json`)
    fs.writeFileSync(ctxPath, JSON.stringify(compressed, null, 2))
  }

  return compressed
}

/**
 * Load session context from ctx.json (for session restore).
 */
export function loadSessionCtx(sessionId, ctxDir) {
  const ctxPath = path.join(ctxDir, `${sessionId}_ctx.json`)
  if (!fs.existsSync(ctxPath)) return []
  return JSON.parse(fs.readFileSync(ctxPath, 'utf-8'))
}

/**
 * Save session context to ctx.json.
 */
export function saveSessionCtx(sessionId, messages, ctxDir) {
  fs.mkdirSync(ctxDir, {recursive: true})
  const ctxPath = path.join(ctxDir, `${sessionId}_ctx.json`)
  fs.writeFileSync(ctxPath, JSON.stringify(messages, null, 2))
}
```

- [ ] **Step 4: Commit**

```bash
git add src/memory/
git commit -m "feat: memory modules — bootstrap, context pruning, compression"
```

---

## Task 6: RAG Memory (pgvector)

**Files:**
- Create: `src/memory/rag-memory.js`

- [ ] **Step 1: Implement rag-memory.js**

Port from xiaopaw `indexer.py`. Combines storage + search:

```javascript
// src/memory/rag-memory.js
import pg from 'pg'
import crypto from 'crypto'
import {embedText, embedMany} from '../llm/anthropic-llm.js'
import {generateText} from 'ai'
import {getModel} from '../llm/anthropic-llm.js'

let _pool = null

function getPool(dbDsn) {
  if (!_pool) _pool = new pg.Pool({connectionString: dbDsn})
  return _pool
}

function vecToSql(vec) {
  return '[' + vec.join(',') + ']'
}

/**
 * Extract summary and tags from a conversation turn using LLM.
 */
async function extractSummaryAndTags(userMessage, assistantReply) {
  const prompt = `从以下对话中提取一行摘要和标签。
用户：${userMessage.slice(0, 500)}
助手：${assistantReply.slice(0, 500)}

请用 JSON 格式回复，不要输出其他内容：
{"summary": "一句话摘要", "tags": ["tag1", "tag2"]}`

  try {
    const {text} = await generateText({
      model: getModel(),
      messages: [{role: 'user', content: prompt}],
      maxTokens: 200,
    })
    return JSON.parse(text)
  } catch {
    return {summary: userMessage.slice(0, 100), tags: []}
  }
}

/**
 * Store a conversation turn as a memory in pgvector.
 */
export async function storeMemory({sessionId, routingKey, userMessage, assistantReply, turnTs, dbDsn}) {
  if (!dbDsn) return

  const turnId = crypto.createHash('sha256')
    .update(`${sessionId}_${turnTs}_${userMessage.slice(0, 32)}`)
    .digest('hex')
    .slice(0, 16)

  const {summary, tags} = await extractSummaryAndTags(userMessage, assistantReply)
  const combined = `用户:${userMessage}\n助手:${assistantReply}`

  const [summaryVec, messageVec] = await embedMany([summary, combined])

  const searchText = [userMessage, summary, ...tags].join(' ')
  const pool = getPool(dbDsn)
  await pool.query(
    `INSERT INTO memories (id, session_id, routing_key, user_message, assistant_reply,
     summary, tags, turn_ts, summary_vec, message_vec, search_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10::vector,$11)
     ON CONFLICT (id) DO NOTHING`,
    [turnId, sessionId, routingKey, userMessage, assistantReply,
     summary, tags, turnTs, vecToSql(summaryVec), vecToSql(messageVec), searchText]
  )
}

/**
 * Search memories using hybrid retrieval (vector + BM25).
 */
export async function searchMemory({queryText, routingKey, topK = 5, dbDsn}) {
  if (!dbDsn) return []

  const queryVec = await embedText(queryText)
  const pool = getPool(dbDsn)

  const {rows} = await pool.query(
    `WITH scored AS (
      SELECT *,
        1 - (summary_vec <=> $1::vector) AS vec_score,
        ts_rank(search_tsv, plainto_tsquery('simple', $2)) AS text_score
      FROM memories
      WHERE routing_key = $3
    )
    SELECT *, (vec_score * 0.7 + text_score * 0.3) AS score
    FROM scored ORDER BY score DESC LIMIT $4`,
    [vecToSql(queryVec), queryText, routingKey, topK]
  )
  return rows
}

export async function closePool() {
  if (_pool) await _pool.end()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/memory/rag-memory.js
git commit -m "feat: RAG memory with pgvector hybrid retrieval"
```

---

## Task 7: Skill Tools + ReAct Loop

**Files:**
- Create: `src/agent/skill-tools.js`
- Create: `src/agent/react-loop.js`

- [ ] **Step 1: Implement skill-tools.js**

Port from xiaopaw `skill_loader.py`, simplified (no CrewAI):

```javascript
// src/agent/skill-tools.js
import {tool} from 'ai'
import {z} from 'zod'
import fs from 'fs'
import path from 'path'

const SKILLS_DIR = path.resolve('skills')

/**
 * Parse YAML frontmatter from a Markdown file.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return {data: {}, body: raw.trim()}
  const data = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    data[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim()
  }
  return {data, body: match[2].trim()}
}

/**
 * Load all skills from the skills directory.
 * Each skill directory must contain a SKILL.md file.
 */
export function loadSkillRegistry(skillsDir = SKILLS_DIR) {
  const registry = {}
  if (!fs.existsSync(skillsDir)) return registry

  const dirs = fs.readdirSync(skillsDir, {withFileTypes: true})
    .filter(d => d.isDirectory())
  for (const dir of dirs) {
    const skillFile = path.join(skillsDir, dir.name, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue
    const raw = fs.readFileSync(skillFile, 'utf-8')
    const {data, body} = parseFrontmatter(raw)
    registry[data.name || dir.name] = {
      name: data.name || dir.name,
      type: data.type || 'reference',
      description: (data.description || '').slice(0, 200),
      prompt: body,
      dir: path.join(skillsDir, dir.name),
    }
  }
  return registry
}

/**
 * Build skill-related tools for the Agent.
 */
export function createSkillTools(registry, {sessionId, historyAll = []} = {}) {
  return {
    list_skills: tool({
      description: '列出所有可用的 Skill（专项能力）及其简要描述',
      parameters: z.object({}),
      execute: async () => {
        const list = Object.values(registry).map(s => ({
          name: s.name,
          type: s.type,
          description: s.description,
        }))
        return JSON.stringify(list, null, 2)
      },
    }),

    get_skill: tool({
      description: '获取指定 Skill 的详细行为指令。在执行相关任务前应先调用此工具。',
      parameters: z.object({
        name: z.string().describe('Skill 名称'),
      }),
      execute: async ({name}) => {
        const skill = registry[name]
        if (!skill) return `未找到名为 "${name}" 的 Skill`
        // Replace placeholders
        let prompt = skill.prompt
        if (sessionId) {
          prompt = prompt.replace(/\{session_id\}/g, sessionId)
          prompt = prompt.replace(/\{session_dir\}/g, `data/workspace/sessions/${sessionId}`)
        }
        return prompt
      },
    }),
  }
}
```

- [ ] **Step 2: Implement react-loop.js**

Port from article 2, enhanced with memory hooks from xiaopaw's `MemoryAwareCrew`:

```javascript
// src/agent/react-loop.js
import {generateText, tool} from 'ai'
import {z} from 'zod'
import fs from 'fs'
import path from 'path'
import {getModel} from '../llm/anthropic-llm.js'
import {buildBootstrapPrompt} from '../memory/bootstrap.js'
import {pruneToolResults} from '../memory/context-pruner.js'
import {maybeCompress, loadSessionCtx, saveSessionCtx} from '../memory/context-compressor.js'
import {loadSkillRegistry, createSkillTools} from './skill-tools.js'

const MAX_ITERATIONS = 10

/**
 * Build the complete tool set for the agent.
 * Combines skill tools + utility tools (read_file, write_file, etc.)
 */
function buildTools(skillRegistry, {sessionId, historyAll, sandbox} = {}) {
  const skillTools = createSkillTools(skillRegistry, {sessionId, historyAll})

  // Utility tools — to be extended with sandbox tools in Task 9
  const utilityTools = {}

  return {...skillTools, ...utilityTools}
}

/**
 * Run a single conversation turn through the ReAct loop.
 *
 * @param {Object} opts
 * @param {string} opts.userMessage
 * @param {Array} opts.history        - MessageEntry[] from SessionManager
 * @param {string} opts.sessionId
 * @param {string} opts.routingKey
 * @param {Object} opts.config        - from loadConfig()
 * @param {Function} opts.onStep      - callback for verbose mode: ({step, toolName, args, result}) => void
 * @returns {Promise<string>}         - agent's final text reply
 */
export async function runAgent({
  userMessage,
  history = [],
  sessionId,
  routingKey,
  config,
  onStep = null,
}) {
  const workspaceDir = config.memory?.workspace_dir || './workspace'
  const ctxDir = config.memory?.ctx_dir || './data/ctx'
  const modelId = config.llm?.model
  const maxIter = config.llm?.max_iter || MAX_ITERATIONS
  const pruneKeepTurns = config.memory?.prune_keep_turns || 10
  const compressThreshold = config.memory?.token_threshold || 80000

  // 1. Build system prompt via bootstrap
  const bootstrapPrompt = buildBootstrapPrompt(workspaceDir)
  const systemPrompt = `${bootstrapPrompt}

你是小圈，一个飞书上的私人工作助手。
你拥有一组 Skill（专项能力），需要时用 list_skills 查看可用列表，用 get_skill 获取详细指令。
根据用户需求，自主决定每一步该做什么。`

  // 2. Restore session context (ctx.json) or build from history
  let messages = loadSessionCtx(sessionId, ctxDir)
  if (messages.length === 0) {
    // Convert MessageEntry[] to messages format
    messages = history.map(m => ({role: m.role, content: m.content}))
  }
  // Append current user message
  messages.push({role: 'user', content: userMessage})

  // 3. Build tools
  const skillRegistry = loadSkillRegistry()
  const tools = buildTools(skillRegistry, {sessionId, historyAll: history})

  // 4. ReAct loop
  let lastPromptTokens = 0

  for (let i = 1; i <= maxIter; i++) {
    // Pre-loop: prune and compress
    pruneToolResults(messages, {keepTurns: pruneKeepTurns})
    if (lastPromptTokens > compressThreshold) {
      messages = await maybeCompress(messages, {
        threshold: compressThreshold,
        ctxDir,
        sessionId,
      })
    }

    const {steps, text, usage, response} = await generateText({
      model: getModel(modelId),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 1,
    })

    lastPromptTokens = usage?.promptTokens || 0
    const step = steps[0]
    if (!step) {
      saveSessionCtx(sessionId, messages, ctxDir)
      return text || ''
    }

    // No tool calls → final answer
    if (step.toolCalls.length === 0) {
      saveSessionCtx(sessionId, messages, ctxDir)
      return step.text || ''
    }

    // Log tool calls for verbose mode
    for (const tc of step.toolCalls) {
      const result = step.toolResults.find(r => r.toolCallId === tc.toolCallId)
      if (onStep) {
        onStep({
          step: i,
          toolName: tc.toolName,
          args: tc.args,
          result: result ? String(result.result).slice(0, 120) : '',
        })
      }
    }

    // Append assistant + tool results to messages for next iteration
    messages.push(...response.messages)
  }

  saveSessionCtx(sessionId, messages, ctxDir)
  return '（达到最大迭代次数）'
}
```

- [ ] **Step 3: Commit**

```bash
git add src/agent/
git commit -m "feat: ReAct loop + skill tools (list_skills, get_skill)"
```

---

## Task 8: Feishu Integration

**Files:**
- Create: `src/feishu/session-key.js`
- Create: `src/feishu/sender.js`
- Create: `src/feishu/listener.js`
- Create: `src/feishu/downloader.js`

- [ ] **Step 1: Implement session-key.js**

```javascript
// src/feishu/session-key.js

/**
 * Resolve routing_key from Feishu message context.
 * @returns {string} "p2p:{open_id}" | "group:{chat_id}" | "thread:{chat_id}:{thread_id}"
 */
export function resolveRoutingKey(chatType, senderId, chatId, threadId) {
  if (chatType === 'p2p') return `p2p:${senderId}`
  if (threadId) return `thread:${chatId}:${threadId}`
  return `group:${chatId}`
}
```

- [ ] **Step 2: Implement sender.js**

Port from xiaopaw `sender.py`:

```javascript
// src/feishu/sender.js

export class FeishuSender {
  constructor(client, {maxRetries = 3, retryBackoff = [1, 2, 4]} = {}) {
    this._client = client
    this._maxRetries = maxRetries
    this._retryBackoff = retryBackoff
  }

  _buildCard(content) {
    return JSON.stringify({
      config: {wide_screen_mode: true},
      elements: [{
        tag: 'div',
        text: {content, tag: 'lark_md'},
      }],
    })
  }

  async send(routingKey, content, rootId = null) {
    const card = this._buildCard(content)
    const [type, id] = routingKey.split(':')

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        if (type === 'p2p') {
          await this._client.im.message.create({
            data: {
              receive_id: id,
              msg_type: 'interactive',
              content: card,
            },
            params: {receive_id_type: 'open_id'},
          })
        } else if (type === 'thread') {
          const [chatId, threadRootId] = [routingKey.split(':')[1], routingKey.split(':')[2]]
          await this._client.im.message.reply({
            path: {message_id: threadRootId},
            data: {msg_type: 'interactive', content: card},
          })
        } else {
          // group
          await this._client.im.message.create({
            data: {
              receive_id: id,
              msg_type: 'interactive',
              content: card,
            },
            params: {receive_id_type: 'chat_id'},
          })
        }
        return
      } catch (e) {
        if (attempt < this._maxRetries) {
          await new Promise(r => setTimeout(r, this._retryBackoff[attempt] * 1000))
        } else {
          console.error(`[FeishuSender] send failed after ${this._maxRetries} retries:`, e.message)
        }
      }
    }
  }

  async sendThinking(routingKey, rootId = null) {
    try {
      const card = this._buildCard('⏳ 思考中，请稍候...')
      const [type, id] = routingKey.split(':')

      let resp
      if (type === 'p2p') {
        resp = await this._client.im.message.create({
          data: {receive_id: id, msg_type: 'interactive', content: card},
          params: {receive_id_type: 'open_id'},
        })
      } else if (type === 'thread') {
        const threadRootId = routingKey.split(':')[2]
        resp = await this._client.im.message.reply({
          path: {message_id: threadRootId},
          data: {msg_type: 'interactive', content: card},
        })
      } else {
        resp = await this._client.im.message.create({
          data: {receive_id: id, msg_type: 'interactive', content: card},
          params: {receive_id_type: 'chat_id'},
        })
      }
      return resp?.data?.message_id || null
    } catch (e) {
      console.error('[FeishuSender] sendThinking failed:', e.message)
      return null
    }
  }

  async updateCard(cardMsgId, content) {
    try {
      const card = this._buildCard(content)
      await this._client.im.message.patch({
        path: {message_id: cardMsgId},
        data: {content: card},
      })
    } catch (e) {
      console.error('[FeishuSender] updateCard failed:', e.message)
    }
  }

  async sendText(routingKey, content, rootId = null) {
    const [type, id] = routingKey.split(':')
    const data = {
      msg_type: 'text',
      content: JSON.stringify({text: content}),
    }
    try {
      if (type === 'p2p') {
        await this._client.im.message.create({
          data: {...data, receive_id: id},
          params: {receive_id_type: 'open_id'},
        })
      } else {
        await this._client.im.message.create({
          data: {...data, receive_id: id},
          params: {receive_id_type: 'chat_id'},
        })
      }
    } catch (e) {
      console.error('[FeishuSender] sendText failed:', e.message)
    }
  }
}
```

- [ ] **Step 3: Implement listener.js**

Port from xiaopaw `listener.py`:

```javascript
// src/feishu/listener.js
import * as lark from '@larksuiteoapi/node-sdk'
import {resolveRoutingKey} from './session-key.js'
import {createInboundMessage} from '../models.js'

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

  async start() {
    await this._wsClient.start()
  }

  _isChatAllowed(chatId, chatType) {
    if (chatType === 'p2p') return true
    if (this._allowedChats.size === 0) return true
    return this._allowedChats.has(chatId)
  }

  async _handleMessage(data) {
    try {
      const {message, sender} = data
      const chatType = message.chat_type
      const chatId = message.chat_id
      const senderId = sender.sender_id?.open_id
      const msgId = message.message_id
      const threadId = message.thread_id || null

      if (!this._isChatAllowed(chatId, chatType)) return

      const routingKey = resolveRoutingKey(chatType, senderId, chatId, threadId)
      const {content, attachment} = this._extractContent(message.message_type, message.content)

      const inbound = createInboundMessage({
        routingKey,
        content,
        msgId,
        rootId: message.root_id || msgId,
        senderId,
        ts: parseInt(message.create_time) || Date.now(),
        attachment,
      })

      await this._onMessage(inbound)
    } catch (e) {
      console.error('[FeishuListener] handleMessage error:', e.message)
    }
  }

  _extractContent(msgType, contentJson) {
    let parsed
    try {
      parsed = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson
    } catch {
      return {content: '', attachment: null}
    }

    let content = ''
    let attachment = null

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
}

/**
 * Keep reconnecting on failure.
 */
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

- [ ] **Step 4: Implement downloader.js**

```javascript
// src/feishu/downloader.js
import fs from 'fs'
import path from 'path'

export class FeishuDownloader {
  constructor(client, dataDir) {
    this._client = client
    this._dataDir = dataDir
  }

  async download(msgId, attachment, sessionId) {
    const destDir = path.join(this._dataDir, 'workspace', 'sessions', sessionId, 'uploads')
    fs.mkdirSync(destDir, {recursive: true})
    const destPath = path.join(destDir, attachment.fileName)

    try {
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
    } catch (e) {
      console.error('[FeishuDownloader] download failed:', e.message)
      return null
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/feishu/
git commit -m "feat: Feishu integration — listener, sender, downloader"
```

---

## Task 9: Podman Sandbox

**Files:**
- Create: `src/sandbox/podman-sandbox.js`

- [ ] **Step 1: Implement podman-sandbox.js**

```javascript
// src/sandbox/podman-sandbox.js
import {execFile} from 'child_process'
import {promisify} from 'util'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)

export class PodmanSandbox {
  constructor({image = 'xiaoquan-sandbox:latest', timeoutMs = 30000, dataDir = './data'} = {}) {
    this._image = image
    this._timeoutMs = timeoutMs
    this._dataDir = path.resolve(dataDir)
    this._credentialsDir = path.join(this._dataDir, '.sandbox-credentials')
  }

  /**
   * Write credentials to a temp directory, mounted into the container.
   * LLM never sees these values.
   */
  writeCredentials(credentials) {
    fs.mkdirSync(this._credentialsDir, {recursive: true})
    for (const [name, data] of Object.entries(credentials)) {
      fs.writeFileSync(
        path.join(this._credentialsDir, `${name}.json`),
        JSON.stringify(data, null, 2)
      )
    }
  }

  /**
   * Execute a script inside a Podman container.
   */
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

  /**
   * Execute arbitrary code in the sandbox.
   */
  async executeCode(code, language = 'python', {sessionDir = null} = {}) {
    const mounts = this._buildMounts(sessionDir)
    const cmd = [
      'run', '--rm', '-i',
      `--timeout=${Math.ceil(this._timeoutMs / 1000)}`,
      '--network=host',
      ...mounts,
      this._image,
      language === 'python' ? 'python3' : 'node',
      '-c', code,
    ]

    try {
      const {stdout, stderr} = await execFileAsync('podman', cmd, {
        timeout: this._timeoutMs,
      })
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (e) {
      if (e.killed) return `执行超时（${this._timeoutMs / 1000}s）`
      return `执行失败: ${e.message}`
    }
  }

  _buildMounts(sessionDir) {
    const mounts = [
      '-v', `${path.resolve('skills')}:/mnt/skills:ro`,
    ]
    if (fs.existsSync(this._credentialsDir)) {
      mounts.push('-v', `${this._credentialsDir}:/workspace/.config:ro`)
    }
    if (sessionDir) {
      const absSessionDir = path.resolve(sessionDir)
      fs.mkdirSync(absSessionDir, {recursive: true})
      mounts.push('-v', `${absSessionDir}:/workspace/session:rw`)
    }
    return mounts
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sandbox/
git commit -m "feat: Podman sandbox for isolated code execution"
```

---

## Task 10: Runner

**Files:**
- Create: `src/runner.js`
- Create: `tests/runner.test.js`

- [ ] **Step 1: Write Runner tests**

```javascript
// tests/runner.test.js
import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {Runner} from '../src/runner.js'
import {SessionManager} from '../src/session/session-manager.js'
import {createInboundMessage} from '../src/models.js'

// Capture sender for testing
class CaptureSender {
  constructor() { this.messages = [] }
  async send(routingKey, content) { this.messages.push({routingKey, content}) }
  async sendThinking() { return 'card_123' }
  async updateCard(cardMsgId, content) { this.messages.push({cardMsgId, content}) }
  async sendText(routingKey, content) { this.messages.push({routingKey, content, type: 'text'}) }
}

describe('Runner', () => {
  let tmpDir, mgr, sender, runner

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-runner-'))
    mgr = new SessionManager(tmpDir)
    sender = new CaptureSender()
  })

  it('/help returns help text', async () => {
    const agentFn = async () => 'should not be called'
    runner = new Runner(mgr, sender, agentFn)
    const msg = createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: '/help',
      msgId: 'm1',
      senderId: 'ou_test',
    })
    await runner.dispatch(msg)
    // Wait for worker to process
    await new Promise(r => setTimeout(r, 100))
    const helpMsg = sender.messages.find(m => m.type === 'text')
    assert.ok(helpMsg)
    assert.ok(helpMsg.content.includes('/new'))
  })

  it('/new creates new session', async () => {
    const agentFn = async () => 'reply'
    runner = new Runner(mgr, sender, agentFn)

    // First message creates session
    const msg1 = createInboundMessage({routingKey: 'p2p:ou_test', content: 'hi', msgId: 'm1', senderId: 'ou_test'})
    await runner.dispatch(msg1)
    await new Promise(r => setTimeout(r, 200))
    const s1 = await mgr.getOrCreate('p2p:ou_test')

    // /new creates different session
    const msg2 = createInboundMessage({routingKey: 'p2p:ou_test', content: '/new', msgId: 'm2', senderId: 'ou_test'})
    await runner.dispatch(msg2)
    await new Promise(r => setTimeout(r, 200))
    const s2 = await mgr.getOrCreate('p2p:ou_test')
    assert.notEqual(s1.id, s2.id)
  })

  it('dispatches to agent_fn and sends reply', async () => {
    const agentFn = async (userMessage) => `echo: ${userMessage}`
    runner = new Runner(mgr, sender, agentFn)
    const msg = createInboundMessage({routingKey: 'p2p:ou_test', content: 'hello', msgId: 'm1', senderId: 'ou_test'})
    await runner.dispatch(msg)
    await new Promise(r => setTimeout(r, 200))
    const reply = sender.messages.find(m => m.cardMsgId)
    assert.ok(reply)
    assert.equal(reply.content, 'echo: hello')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/youxingzhi/ayou/xiaoquan && node --test tests/runner.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Runner**

```javascript
// src/runner.js

const HELP_TEXT = `小圈 可用命令：
/new       — 创建新对话，之前历史不带入
/verbose on|off — 开启/关闭推理过程推送
/status    — 查看当前会话信息
/help      — 显示此帮助`

const SLASH_COMMANDS = new Set(['/new', '/verbose', '/help', '/status'])

export class Runner {
  /**
   * @param {SessionManager} sessionMgr
   * @param {SenderProtocol} sender
   * @param {Function} agentFn - (userMessage, history, sessionId, routingKey, rootId, verbose) => string
   * @param {Object} opts
   */
  constructor(sessionMgr, sender, agentFn, {idleTimeoutS = 300, downloader = null} = {}) {
    this._sessionMgr = sessionMgr
    this._sender = sender
    this._agentFn = agentFn
    this._idleTimeoutS = idleTimeoutS
    this._downloader = downloader
    /** @type {Map<string, Array>} */
    this._queues = new Map()
    /** @type {Map<string, Promise>} */
    this._workers = new Map()
  }

  async dispatch(inbound) {
    const {routingKey} = inbound
    if (!this._queues.has(routingKey)) {
      this._queues.set(routingKey, [])
      this._startWorker(routingKey)
    }
    this._queues.get(routingKey).push(inbound)
    // Wake the worker if it's waiting
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
        // Wait for new message or timeout
        const gotMessage = await new Promise(resolve => {
          this._wakers.set(routingKey, () => resolve(true))
          setTimeout(() => resolve(false), this._idleTimeoutS * 1000)
        })
        if (!gotMessage) {
          // Idle timeout — clean up
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

    // 1. Check slash commands
    const slashReply = await this._handleSlash(inbound)
    if (slashReply !== null) {
      await this._sender.sendText(routingKey, slashReply, rootId)
      return
    }

    // 2. Get or create session
    const session = await this._sessionMgr.getOrCreate(routingKey)

    // 3. Handle attachment download
    let userContent = inbound.content
    if (inbound.attachment && this._downloader) {
      const localPath = await this._downloader.download(inbound.msgId, inbound.attachment, session.id)
      if (localPath) {
        const sandboxPath = `/workspace/sessions/${session.id}/uploads/${inbound.attachment.fileName}`
        userContent = _buildAttachmentMessage(sandboxPath, userContent)
      }
    }

    // 4. Load history
    const history = await this._sessionMgr.loadHistory(session.id)

    // 5. Send thinking card
    const cardMsgId = await this._sender.sendThinking(routingKey, rootId)

    // 6. Run agent
    const reply = await this._agentFn(userContent, history, session.id, routingKey, rootId, session.verbose)

    // 7. Save to session
    await this._sessionMgr.append(session.id, {
      user: userContent,
      feishuMsgId: inbound.msgId,
      assistant: reply,
    })

    // 8. Send reply
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
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/youxingzhi/ayou/xiaoquan && node --test tests/runner.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runner.js tests/runner.test.js
git commit -m "feat: Runner with per-routing_key queue, slash commands, message pipeline"
```

---

## Task 11: Entry Point + TestAPI

**Files:**
- Create: `src/index.js`
- Create: `src/api/test-api.js`

- [ ] **Step 1: Implement test-api.js**

```javascript
// src/api/test-api.js
import http from 'http'

/**
 * Lightweight HTTP test API for local debugging without Feishu.
 */
export function startTestApi(runner, {host = '127.0.0.1', port = 9090} = {}) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/test/message') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const {routing_key, content} = JSON.parse(body)
          const {createInboundMessage} = await import('../models.js')
          const inbound = createInboundMessage({
            routingKey: routing_key || 'p2p:ou_test',
            content: content || '',
            msgId: `test_${Date.now()}`,
            senderId: 'ou_test',
          })
          await runner.dispatch(inbound)
          // Wait a moment for processing
          await new Promise(r => setTimeout(r, 100))
          res.writeHead(200, {'Content-Type': 'application/json'})
          res.end(JSON.stringify({ok: true, msg_id: inbound.msgId}))
        } catch (e) {
          res.writeHead(500, {'Content-Type': 'application/json'})
          res.end(JSON.stringify({error: e.message}))
        }
      })
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  server.listen(port, host, () => {
    console.log(`[TestAPI] http://${host}:${port}/api/test/message`)
  })
  return server
}
```

- [ ] **Step 2: Implement index.js (main entry point)**

```javascript
// src/index.js
import {loadConfig} from './config.js'
import {SessionManager} from './session/session-manager.js'
import {FeishuSender} from './feishu/sender.js'
import {FeishuListener, runForever} from './feishu/listener.js'
import {FeishuDownloader} from './feishu/downloader.js'
import {PodmanSandbox} from './sandbox/podman-sandbox.js'
import {Runner} from './runner.js'
import {runAgent} from './agent/react-loop.js'
import {startTestApi} from './api/test-api.js'
import * as lark from '@larksuiteoapi/node-sdk'

async function main() {
  const config = loadConfig()
  const dataDir = config.data_dir || './data'

  console.log('=== 小圈 · 飞书工作助手 ===')

  // 1. Initialize session manager
  const sessionMgr = new SessionManager(dataDir)
  console.log('[Session] initialized')

  // 2. Initialize Feishu client
  const feishuClient = new lark.Client({
    appId: config.feishu.app_id,
    appSecret: config.feishu.app_secret,
  })

  // 3. Initialize sender & downloader
  const sender = new FeishuSender(feishuClient, config.sender)
  const downloader = new FeishuDownloader(feishuClient, dataDir)

  // 4. Initialize sandbox
  const sandbox = new PodmanSandbox({
    image: config.sandbox?.image,
    timeoutMs: config.sandbox?.timeout_ms,
    dataDir,
  })
  // Write credentials to sandbox mount
  sandbox.writeCredentials({
    feishu: {app_id: config.feishu.app_id, app_secret: config.feishu.app_secret},
  })
  console.log('[Sandbox] credentials injected')

  // 5. Build agent function
  const agentFn = async (userMessage, history, sessionId, routingKey, rootId, verbose) => {
    const onStep = verbose
      ? ({step, toolName, args, result}) => {
          sender.send(routingKey, `💭 [Step ${step}] ${toolName}(${JSON.stringify(args)})\n${result}`, rootId)
            .catch(() => {})
        }
      : null

    return runAgent({
      userMessage,
      history,
      sessionId,
      routingKey,
      config,
      onStep,
    })
  }

  // 6. Build runner
  const runner = new Runner(sessionMgr, sender, agentFn, {
    idleTimeoutS: config.runner?.idle_timeout_s,
    downloader,
  })

  // 7. Start Feishu listener
  const listener = new FeishuListener({
    appId: config.feishu.app_id,
    appSecret: config.feishu.app_secret,
    onMessage: (inbound) => runner.dispatch(inbound),
    allowedChats: config.feishu.allowed_chats || [],
  })

  console.log('[Feishu] WebSocket connecting...')

  // 8. Start test API if enabled
  if (config.debug?.enable_test_api) {
    startTestApi(runner, {
      host: config.debug.test_api_host,
      port: config.debug.test_api_port,
    })
  }

  // 9. Run forever
  await runForever(listener)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
```

- [ ] **Step 3: Commit**

```bash
git add src/index.js src/api/test-api.js
git commit -m "feat: entry point + TestAPI for local debugging"
```

---

## Task 12: Skills

**Files:**
- Create: `skills/memory-save/SKILL.md`
- Create: `skills/memory-governance/SKILL.md`
- Create: `skills/skill-creator/SKILL.md`
- Create: `skills/history-reader/SKILL.md`
- Create: `skills/pdf/SKILL.md` + `skills/pdf/parse.py`
- Create: `skills/docx/SKILL.md` + `skills/docx/parse.py`
- Create: `skills/pptx/SKILL.md` + `skills/pptx/parse.py`
- Create: `skills/xlsx/SKILL.md` + `skills/xlsx/parse.py`
- Create: `skills/feishu-ops/SKILL.md` + scripts
- Create: `skills/baidu-search/SKILL.md` + scripts
- Create: `skills/web-browse/SKILL.md` + scripts
- Create: `skills/scheduler-mgr/SKILL.md` + scripts

- [ ] **Step 1: Copy reference-type Skills from article demos**

These are pure Markdown instructions, no code execution. Copy content from the corresponding xiaopaw skills, adjusted for xiaoquan:

`skills/memory-save/SKILL.md` — copy from article 4 (ai-mem-file) memory-save Skill content.

`skills/skill-creator/SKILL.md` — copy from article 4 skill-creator Skill content.

`skills/memory-governance/SKILL.md` — copy from article 4 memory-governance Skill content.

`skills/history-reader/SKILL.md`:
```markdown
---
name: history-reader
type: reference
description: 当用户说"查看历史记录"、"之前聊了什么"、"翻看对话记录"时，分页读取历史对话记录。
---

你是一个历史记录查看器。使用 read_history 工具分页读取对话历史。

参数：
- page: 页码（从 1 开始）
- page_size: 每页条数（默认 10）

显示时按时间倒序排列，每条显示角色和内容。
```

- [ ] **Step 2: Copy task-type Skills from xiaopaw**

For each task-type Skill (pdf, docx, pptx, xlsx, feishu-ops, baidu-search, web-browse, scheduler-mgr):

1. Copy `SKILL.md` from `/Users/youxingzhi/ayou/xiaopaw-with-memory/xiaopaw/skills/{name}/SKILL.md`
2. Copy Python execution scripts from the same directory
3. Adjust path placeholders: `{skill_base}` → skill directory path, `{session_dir}` → session workspace

```bash
for skill in pdf docx pptx xlsx feishu-ops baidu-search web-browse scheduler-mgr; do
  mkdir -p skills/$skill
done
```

The SKILL.md and Python scripts are the same as xiaopaw since they run inside the same Podman/sandbox environment.

- [ ] **Step 3: Add utility tools for reference skills**

Add `read_file` and `write_file` tools to `src/agent/react-loop.js`'s `buildTools` function so reference skills (memory-save, skill-creator) can read/write workspace files:

In `src/agent/react-loop.js`, update `buildTools`:

```javascript
import {tool} from 'ai'
import {z} from 'zod'
import fs from 'fs'

function buildTools(skillRegistry, {sessionId, historyAll, sandbox} = {}) {
  const skillTools = createSkillTools(skillRegistry, {sessionId, historyAll})

  const utilityTools = {
    read_file: tool({
      description: '读取指定路径的文件内容',
      parameters: z.object({path: z.string().describe('文件路径')}),
      execute: async ({path: filePath}) => {
        try {
          return fs.readFileSync(filePath, 'utf-8')
        } catch (e) {
          return `读取失败: ${e.message}`
        }
      },
    }),
    write_file: tool({
      description: '将内容写入指定路径的文件',
      parameters: z.object({
        path: z.string().describe('文件路径'),
        content: z.string().describe('文件内容'),
      }),
      execute: async ({path: filePath, content}) => {
        try {
          fs.mkdirSync(path.dirname(filePath), {recursive: true})
          fs.writeFileSync(filePath, content)
          return `已写入 ${filePath}`
        } catch (e) {
          return `写入失败: ${e.message}`
        }
      },
    }),
    memory_search: tool({
      description: '搜索长期记忆库，按语义相似度返回相关的历史对话',
      parameters: z.object({
        query: z.string().describe('搜索关键词或自然语言描述'),
      }),
      execute: async ({query}) => {
        const {searchMemory} = await import('../memory/rag-memory.js')
        const {getConfig} = await import('../config.js')
        const config = getConfig()
        const results = await searchMemory({
          queryText: query,
          routingKey: '', // will be set from context
          topK: 5,
          dbDsn: config.memory?.db_dsn,
        })
        if (results.length === 0) return '未找到相关记忆'
        return results.map(r => `[${r.created_at}] ${r.summary}\n用户: ${r.user_message}\n助手: ${r.assistant_reply}`).join('\n---\n')
      },
    }),
  }

  return {...skillTools, ...utilityTools}
}
```

- [ ] **Step 4: Commit**

```bash
git add skills/ src/agent/react-loop.js
git commit -m "feat: all 12 Skills — reference + task types"
```

---

## Task 13: Article

**Files:**
- Create: `/Users/youxingzhi/ayou/blog/source/_posts/ai-agent-final.md`
- Create: `/Users/youxingzhi/ayou/blog/source/_posts/ai-agent-final/` (asset folder for images)

- [ ] **Step 1: Create article skeleton**

Use the `write-tech-article` skill to write the article following the structure from the design spec (section 9):

Article structure:
- **前言**: 回顾前 5 篇系列，引出本篇定位
- **一、整体架构**: 架构图 + 模块职责 + 技术栈
- **二、Session 系统** (重点): routing_key、会话生命周期、JSONL 持久化、队列串行
- **三、沙箱执行** (重点): Podman 容器化、凭证注入、文件交换
- **四、飞书接入** (重点): WebSocket 长连接、消息解析、卡片消息
- **五、已有模块整合** (简述): Skill、上下文管理、文件记忆、RAG，引导"详见第 X 篇"
- **六、完整 Demo 演示**: 展示所有模块协作
- **总结**: 系列回顾

Each "重点" section should include:
- Problem statement (why this module is needed)
- Design decisions (tradeoffs, alternatives)
- Complete code implementation with comments
- Sequence diagram or flow diagram
- Running demo output

Each "简述" section: one paragraph + key code diff from demo version + link to original article.

Front matter:
```yaml
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
```

- [ ] **Step 2: Write full article content using write-tech-article skill**

Invoke the `write-tech-article` skill with the article structure, referencing:
- Design spec at `docs/superpowers/specs/2026-04-16-xiaoquan-agent-design.md`
- Code at `/Users/youxingzhi/ayou/xiaoquan/`
- Previous articles for linking

- [ ] **Step 3: Create diagrams**

Create architecture diagram and sequence diagrams for the asset folder `source/_posts/ai-agent-final/`:
- `arch.png` — overall system architecture
- `session-flow.png` — session lifecycle
- `sandbox-flow.png` — sandbox execution flow
- `feishu-flow.png` — Feishu message processing sequence

- [ ] **Step 4: Commit article**

```bash
cd /Users/youxingzhi/ayou/blog
git add source/_posts/ai-agent-final.md source/_posts/ai-agent-final/
git commit -m "feat: add final AI Agent article — complete system integration"
```

---

## Dependency Graph

```
Task 1 (scaffold)
  └─ Task 2 (models)
      ├─ Task 3 (session manager)
      ├─ Task 4 (LLM adapter)
      │   ├─ Task 5 (memory: bootstrap, pruning, compression)
      │   ├─ Task 6 (RAG memory)
      │   └─ Task 7 (skill tools + ReAct loop)
      ├─ Task 8 (feishu integration)
      └─ Task 9 (sandbox)

Task 3 + Task 7 + Task 8 + Task 9
  └─ Task 10 (runner)
      └─ Task 11 (entry point + TestAPI)

Task 7
  └─ Task 12 (skills)

Task 1-12
  └─ Task 13 (article)
```

Tasks 4-9 can be worked on in parallel after Tasks 1-2 are complete. Task 10 depends on 3, 7, 8, 9. Task 11 depends on 10. Task 12 depends on 7. Task 13 depends on all code tasks.
