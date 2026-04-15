# Agent Memory Phase 3: RAG-Based Long-Term Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `demo/agent-memory/` demo with pgvector-based hybrid retrieval (vector + fulltext + scalar), then write the companion blog article (Part 3 of the series).

**Architecture:** Add PostgreSQL + pgvector as the storage backend for long-term memories. The Agent gets two new tools: `memory_store` (embed + write) and `memory_search` (hybrid query). A `memory-search` Skill defines the degradation strategy. The existing file-system memory (Phase 2) remains untouched — this is an additive layer.

**Tech Stack:** Node.js (ESM), Vercel AI SDK (`ai` + `@ai-sdk/openai` for embeddings, `@ai-sdk/anthropic` for chat), PostgreSQL + pgvector (Docker), `text-embedding-3-small` (1536 dims)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `demo/agent-memory/schema.sql` | pgvector extension + memories table + all indexes |
| Create | `demo/agent-memory/db.js` | PostgreSQL connection pool + pgvector type registration + schema init |
| Create | `demo/agent-memory/memory-store.js` | Embedding generation + idempotent INSERT |
| Create | `demo/agent-memory/memory-search.js` | Hybrid retrieval: vector + fulltext + scalar |
| Create | `demo/agent-memory/skills/memory-search.md` | Search degradation strategy Skill |
| Modify | `demo/agent-memory/tools.js` | Add `memory_store` and `memory_search` tools |
| Modify | `demo/agent-memory/index.js` | Add DB initialization at startup |
| Modify | `demo/agent-memory/package.json` | Add `pg`, `pgvector`, `@ai-sdk/openai` dependencies |
| Create | `source/_posts/ai-mem-rag.md` | Phase 3 blog article |

Files NOT modified: `bootstrap.js`, `prune.js`, `compress.js`, `skill-loader.js`, `server.js`, `workspace/*`

---

### Task 1: Schema and Environment Setup

**Files:**
- Create: `demo/agent-memory/schema.sql`
- Modify: `demo/agent-memory/package.json`

- [ ] **Step 1: Create schema.sql**

```sql
-- schema.sql
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
    search_tsv      TSVECTOR    GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED
);

CREATE INDEX IF NOT EXISTS memories_summary_vec_idx
    ON memories USING hnsw (summary_vec vector_cosine_ops);

CREATE INDEX IF NOT EXISTS memories_search_tsv_idx
    ON memories USING gin (search_tsv);

CREATE INDEX IF NOT EXISTS memories_routing_key_idx ON memories (routing_key);
CREATE INDEX IF NOT EXISTS memories_created_at_idx  ON memories (created_at DESC);
CREATE INDEX IF NOT EXISTS memories_tags_idx        ON memories USING gin (tags);
```

- [ ] **Step 2: Update package.json**

Add three new dependencies to the existing `dependencies` block:

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "pg": "^8.13.0",
    "pgvector": "^0.2.0",
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd demo/agent-memory && pnpm install`
Expected: lockfile updated, three new packages installed.

- [ ] **Step 4: Start PostgreSQL with pgvector via Docker**

Run:
```bash
docker run -d --name pgvector-demo \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=agent_memory \
  -p 5432:5432 \
  pgvector/pgvector:pg17
```

- [ ] **Step 5: Initialize the schema**

Run: `PGPASSWORD=postgres psql -h localhost -U postgres -d agent_memory -f demo/agent-memory/schema.sql`
Expected: CREATE EXTENSION, CREATE TABLE, CREATE INDEX (×5) all succeed.

- [ ] **Step 6: Commit**

```bash
git add demo/agent-memory/schema.sql demo/agent-memory/package.json demo/agent-memory/pnpm-lock.yaml
git commit -m "feat: add pgvector schema and database dependencies for Phase 3"
```

---

### Task 2: db.js — Database Connection Module

**Files:**
- Create: `demo/agent-memory/db.js`

- [ ] **Step 1: Write a verification script**

```bash
node -e "
import('./db.js').then(async (m) => {
  await m.initDB()
  const res = await m.query('SELECT 1 AS ok')
  console.log('connection:', res.rows[0].ok === 1 ? 'PASS' : 'FAIL')
  await m.close()
}).catch(e => { console.error('FAIL:', e.message); process.exit(1) })
"
```

Run this from `demo/agent-memory/`. Expected: FAIL — `db.js` doesn't exist yet.

- [ ] **Step 2: Create db.js**

```js
import pg from 'pg'
import pgvector from 'pgvector/pg'
import fs from 'fs'

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/agent_memory',
})

export async function initDB() {
  const client = await pool.connect()
  try {
    await pgvector.registerTypes(client)
    const schema = fs.readFileSync(
      new URL('./schema.sql', import.meta.url),
      'utf-8'
    )
    await client.query(schema)
    console.log('[DB] schema initialized')
  } finally {
    client.release()
  }
}

export async function query(text, params) {
  const client = await pool.connect()
  try {
    await pgvector.registerTypes(client)
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

export async function close() {
  await pool.end()
}
```

- [ ] **Step 3: Run verification**

Run the same script from Step 1 again from `demo/agent-memory/`.
Expected: `connection: PASS`

- [ ] **Step 4: Commit**

```bash
git add demo/agent-memory/db.js
git commit -m "feat: add db.js — PostgreSQL connection with pgvector support"
```

---

### Task 3: memory-store.js — Write Pipeline

**Files:**
- Create: `demo/agent-memory/memory-store.js`

- [ ] **Step 1: Write a verification script**

Create `demo/agent-memory/test-store.js`:

```js
import { initDB, query, close } from './db.js'
import { storeMemory } from './memory-store.js'

await initDB()

const id = await storeMemory({
  sessionId: 'test-session-001',
  routingKey: 'p2p:test_user',
  userMessage: '帮我查一下明天北京到上海的航班',
  assistantReply: '已查到3个航班：MU5101 08:00、CA1501 10:30、CZ3901 14:00。建议选早班。',
  summary: '用户查询北京到上海的航班信息',
  tags: ['travel', 'flight'],
  turnTs: Date.now(),
})

console.log('stored id:', id)

const res = await query('SELECT id, summary, tags FROM memories WHERE id = $1', [id])
console.log('verify:', res.rows.length === 1 ? 'PASS' : 'FAIL')
console.log('row:', res.rows[0])

await close()
```

Run: `cd demo/agent-memory && node test-store.js`
Expected: FAIL — `memory-store.js` doesn't exist.

- [ ] **Step 2: Create memory-store.js**

```js
import { createHash } from 'crypto'
import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { query } from './db.js'

const openai = createOpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
})

const embeddingModel = openai.embedding('text-embedding-3-small')

function makeId(sessionId, turnTs) {
  return createHash('sha256')
    .update(`${sessionId}:${turnTs}`)
    .digest('hex')
    .slice(0, 16)
}

export async function storeMemory({
  sessionId,
  routingKey,
  userMessage,
  assistantReply,
  summary,
  tags,
  turnTs,
}) {
  const id = makeId(sessionId, turnTs)

  const [{ embedding: summaryVec }, { embedding: messageVec }] =
    await Promise.all([
      embed({ model: embeddingModel, value: summary }),
      embed({ model: embeddingModel, value: userMessage }),
    ])

  const searchText = [userMessage, summary, ...tags].join(' ')

  await query(
    `INSERT INTO memories
       (id, session_id, routing_key, user_message, assistant_reply,
        summary, tags, turn_ts, summary_vec, message_vec, search_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      id, sessionId, routingKey, userMessage, assistantReply,
      summary, tags, turnTs, JSON.stringify(summaryVec), JSON.stringify(messageVec), searchText,
    ]
  )

  return id
}
```

Note: `pgvector` registered in `db.js` allows passing vectors as JSON-stringified arrays. If the driver version supports raw arrays, switch to passing arrays directly.

- [ ] **Step 3: Run verification**

Run: `cd demo/agent-memory && node test-store.js`
Expected:
```
stored id: <16-char hex>
verify: PASS
row: { id: '...', summary: '用户查询北京到上海的航班信息', tags: ['travel', 'flight'] }
```

- [ ] **Step 4: Verify idempotency — run the same script again**

Run: `cd demo/agent-memory && node test-store.js`
Expected: same id, no duplicate rows. Run:
```bash
node -e "
import { initDB, query, close } from './db.js'
await initDB()
const res = await query('SELECT count(*) FROM memories')
console.log('total rows:', res.rows[0].count)
await close()
"
```
Expected: `total rows: 1` (not 2).

- [ ] **Step 5: Clean up test file and commit**

```bash
rm demo/agent-memory/test-store.js
git add demo/agent-memory/memory-store.js
git commit -m "feat: add memory-store.js — embedding + idempotent write pipeline"
```

---

### Task 4: memory-search.js — Hybrid Retrieval

**Files:**
- Create: `demo/agent-memory/memory-search.js`

- [ ] **Step 1: Seed test data**

Create `demo/agent-memory/test-search.js`:

```js
import { initDB, query, close } from './db.js'
import { storeMemory } from './memory-store.js'
import { searchMemory } from './memory-search.js'

await initDB()

// Clear previous test data
await query('DELETE FROM memories')

// Seed 3 diverse memories
const memories = [
  {
    sessionId: 's1', routingKey: 'p2p:test',
    userMessage: '帮我对比一下 Pinecone 和 pgvector 这两个向量数据库',
    assistantReply: 'Pinecone 是全托管服务，pgvector 是 PostgreSQL 扩展，自托管。性能相近，pgvector 运维成本低。',
    summary: '向量数据库对比：Pinecone vs pgvector',
    tags: ['database', 'vector'],
    turnTs: 1000,
  },
  {
    sessionId: 's1', routingKey: 'p2p:test',
    userMessage: '明天早上帮我订一杯美式咖啡',
    assistantReply: '好的，已帮你预约明早 9 点的美式咖啡。',
    summary: '用户订咖啡',
    tags: ['coffee', 'order'],
    turnTs: 2000,
  },
  {
    sessionId: 's2', routingKey: 'p2p:test',
    userMessage: '上次聊的那个数据库方案，最后选了哪个？',
    assistantReply: '上次对比后你选了 pgvector，因为不需要额外运维向量数据库。',
    summary: '用户确认选择 pgvector 方案',
    tags: ['database', 'decision'],
    turnTs: 3000,
  },
]

for (const m of memories) {
  await storeMemory(m)
}
console.log('seeded 3 memories')

// Test 1: Semantic search — should find the vector DB comparison
const results1 = await searchMemory({
  queryText: '之前讨论的向量数据库对比',
  routingKey: 'p2p:test',
  topK: 2,
})
console.log('\n--- Test 1: semantic search ---')
console.log('top result summary:', results1[0]?.summary)
console.log('matches vector DB topic:', results1[0]?.summary.includes('向量数据库') ? 'PASS' : 'FAIL')

// Test 2: Keyword search — "pgvector" exact match
const results2 = await searchMemory({
  queryText: 'pgvector',
  routingKey: 'p2p:test',
  topK: 2,
})
console.log('\n--- Test 2: keyword search ---')
console.log('result count:', results2.length)
console.log('has pgvector mention:', results2.some(r => r.summary.includes('pgvector')) ? 'PASS' : 'FAIL')

await close()
```

Run: `cd demo/agent-memory && node test-search.js`
Expected: FAIL — `memory-search.js` doesn't exist.

- [ ] **Step 2: Create memory-search.js**

```js
import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { query } from './db.js'

const openai = createOpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
})

const embeddingModel = openai.embedding('text-embedding-3-small')

export async function searchMemory({
  queryText,
  routingKey,
  topK = 5,
  tags = null,
  afterDate = null,
  vectorWeight = 0.7,
  textWeight = 0.3,
}) {
  const { embedding: queryVec } = await embed({
    model: embeddingModel,
    value: queryText,
  })

  const conditions = ['routing_key = $2']
  const params = [JSON.stringify(queryVec), routingKey]
  let paramIdx = 3

  if (tags && tags.length > 0) {
    conditions.push(`tags @> $${paramIdx}`)
    params.push(tags)
    paramIdx++
  }

  if (afterDate) {
    conditions.push(`created_at > $${paramIdx}`)
    params.push(afterDate)
    paramIdx++
  }

  const whereClause = conditions.join(' AND ')

  const sql = `
    WITH scored AS (
      SELECT *,
        1 - (summary_vec <=> $1::vector) AS vec_score,
        ts_rank(search_tsv, plainto_tsquery('simple', $${paramIdx})) AS text_score
      FROM memories
      WHERE ${whereClause}
    )
    SELECT *,
      (vec_score * ${vectorWeight} + text_score * ${textWeight}) AS score
    FROM scored
    ORDER BY score DESC
    LIMIT ${topK}
  `

  params.push(queryText)

  const result = await query(sql, params)
  return result.rows
}
```

- [ ] **Step 3: Run verification**

Run: `cd demo/agent-memory && node test-search.js`
Expected:
```
seeded 3 memories

--- Test 1: semantic search ---
top result summary: 向量数据库对比：Pinecone vs pgvector
matches vector DB topic: PASS

--- Test 2: keyword search ---
result count: 2
has pgvector mention: PASS
```

- [ ] **Step 4: Clean up test file and commit**

```bash
rm demo/agent-memory/test-search.js
git add demo/agent-memory/memory-search.js
git commit -m "feat: add memory-search.js — hybrid retrieval (vector + fulltext + scalar)"
```

---

### Task 5: memory-search.md — Search Degradation Skill

**Files:**
- Create: `demo/agent-memory/skills/memory-search.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
name: memory-search
description: 搜索历史记忆。当用户提到"上次"、"之前"、"以前聊过"或需要历史上下文时加载此 Skill
---

## 执行流程

用户需要历史上下文时，使用 memory_search 工具检索。

### 第一步：构建查询

从用户消息中提取搜索意图：
- 提取关键词和语义主题
- 识别时间线索（"上周"、"上个月"）
- 识别领域标签（技术、生活、工作）

### 第二步：执行搜索

调用 memory_search 工具，参数：
- query：用户意图的一句话描述
- routing_key：当前用户标识
- top_k：默认 5
- tags：如果能识别领域，加上标签过滤
- after_date：如果有时间线索，加上时间过滤

### 第三步：降级策略

如果搜索结果为空或相关度太低（score < 0.3），按顺序降级重试：

1. **去掉时间限制** → 重新搜索
2. **去掉标签限制** → 只保留 query 和 routing_key
3. **换更宽泛的 query** → 用更抽象的描述重写查询

最多重试 2 次。如果仍然无结果，如实告知用户"没有找到相关的历史记录"。

### 第四步：组织回复

将召回的记忆自然地融入回答：
- 不要说"根据记忆记录显示"这种机械表达
- 像正常人回忆一样表述："上次你问过……"、"之前我们讨论过……"
- 如果召回多条记忆，按时间顺序组织
```

- [ ] **Step 2: Verify skill loads**

Run:
```bash
cd demo/agent-memory && node -e "
import { loadSkills } from './skill-loader.js'
const skills = loadSkills('./skills')
const ms = skills.find(s => s.name === 'memory-search')
console.log(ms ? 'PASS: ' + ms.description : 'FAIL: skill not found')
"
```
Expected: `PASS: 搜索历史记忆。当用户提到"上次"、"之前"、"以前聊过"或需要历史上下文时加载此 Skill`

- [ ] **Step 3: Commit**

```bash
git add demo/agent-memory/skills/memory-search.md
git commit -m "feat: add memory-search skill with degradation strategy"
```

---

### Task 6: Integration — Wire into tools.js and index.js

**Files:**
- Modify: `demo/agent-memory/tools.js`
- Modify: `demo/agent-memory/index.js`

- [ ] **Step 1: Read current tools.js and index.js**

Read both files to confirm the latest state before modifying.

- [ ] **Step 2: Add two new tools to tools.js**

Import the new modules at the top of `tools.js`:

```js
import { storeMemory } from './memory-store.js'
import { searchMemory } from './memory-search.js'
```

Add two new tools to the `tools` object, after `load_skill`:

```js
  memory_store: tool({
    description: '将一轮对话存入长期记忆。在对话包含值得记住的信息时调用。',
    parameters: z.object({
      session_id: z.string().describe('当前会话 ID'),
      routing_key: z.string().describe('用户标识，如 p2p:user_name'),
      user_message: z.string().describe('用户的原始消息'),
      assistant_reply: z.string().describe('助手的回复'),
      summary: z.string().describe('这轮对话的一句话摘要'),
      tags: z.array(z.string()).describe('领域标签，如 ["travel","flight"]'),
    }),
    execute: async ({ session_id, routing_key, user_message, assistant_reply, summary, tags }) => {
      try {
        const id = await storeMemory({
          sessionId: session_id,
          routingKey: routing_key,
          userMessage: user_message,
          assistantReply: assistant_reply,
          summary,
          tags,
          turnTs: Date.now(),
        })
        return `已存入长期记忆，id: ${id}`
      } catch (e) {
        return `存储失败: ${e.message}`
      }
    },
  }),

  memory_search: tool({
    description: '从长期记忆中检索历史对话。当用户提到"上次"、"之前"或需要历史上下文时使用。',
    parameters: z.object({
      query: z.string().describe('搜索查询，描述要找什么'),
      routing_key: z.string().describe('用户标识'),
      top_k: z.number().optional().default(5).describe('返回条数，默认 5'),
      tags: z.array(z.string()).optional().describe('按标签过滤'),
      after_date: z.string().optional().describe('只搜索此日期之后的记忆，ISO 格式'),
    }),
    execute: async ({ query: queryText, routing_key, top_k, tags, after_date }) => {
      try {
        const results = await searchMemory({
          queryText,
          routingKey: routing_key,
          topK: top_k || 5,
          tags: tags?.length ? tags : null,
          afterDate: after_date || null,
        })
        if (results.length === 0) return '未找到相关记忆'
        return JSON.stringify(
          results.map(r => ({
            summary: r.summary,
            user_message: r.user_message,
            assistant_reply: r.assistant_reply,
            tags: r.tags,
            score: Math.round(r.score * 1000) / 1000,
            created_at: r.created_at,
          })),
          null,
          2
        )
      } catch (e) {
        return `检索失败: ${e.message}`
      }
    },
  }),
```

- [ ] **Step 3: Add DB initialization to index.js**

Import `initDB` at the top of `index.js`:

```js
import { initDB } from './db.js'
```

In the `main()` function, add `await initDB()` before the existing `loadSkills()` call:

```js
async function main() {
  await initDB()           // ← add this line
  const skills = loadSkills(SKILLS_PATH)
  // ... rest unchanged
}
```

- [ ] **Step 4: Verify the agent starts without errors**

Run: `cd demo/agent-memory && node index.js`
Expected: Agent starts with `[DB] schema initialized` in the output, followed by the normal `[Tokens: ...] You:` prompt. Type `exit` to quit.

- [ ] **Step 5: Commit**

```bash
git add demo/agent-memory/tools.js demo/agent-memory/index.js
git commit -m "feat: integrate memory_store and memory_search tools into agent"
```

---

### Task 7: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Start the agent and test memory storage**

Run: `cd demo/agent-memory && node index.js`

Input: `帮我查一下明天北京到上海的航班`

Observe: The agent responds with flight info. Then input: `记住这个`

Observe: The agent should invoke `memory_store` tool (via the memory-save skill) to persist this conversation to the database.

- [ ] **Step 2: Test memory retrieval**

In the same session, input: `上次我问过什么航班信息？`

Observe: The agent should invoke `memory_search` tool and recall the flight query from the database.

- [ ] **Step 3: Verify data in database**

In a separate terminal:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d agent_memory -c "SELECT id, summary, tags, score FROM memories LIMIT 5;"
```

Expected: At least one row with the flight-related summary.

- [ ] **Step 4: Commit any fixes if needed**

If Steps 1-3 revealed issues that needed fixing, commit those fixes now.

---

### Task 8: Write the Blog Article

**Files:**
- Create: `source/_posts/ai-mem-rag.md`

Use the `write-tech-article` skill to write the article. The spec is at `docs/superpowers/specs/2026-04-15-agent-memory-phase3-design.md`.

Key references for writing:
- **Spec**: `docs/superpowers/specs/2026-04-15-agent-memory-phase3-design.md` — full structure with 6 chapters
- **Previous article (Part 2)**: `source/_posts/ai-mem-file.md` — for style, voice, and format conventions
- **Previous article (Part 1)**: `source/_posts/ai-context-engineering.md` — for series consistency
- **Idea file**: `idea/agent-memory-rag.md` — raw content and draft material
- **Demo code**: `demo/agent-memory/` — the working code to reference in the article

Article requirements:
- Frontmatter: title, date (2026-04-15), tags [ai, agent, context-engineering], categories [ai], description
- Open with a link back to Part 2: `[上一篇](/2026/04/14/ai-mem-file/)`
- Six chapters as defined in the spec
- Code blocks are simplified excerpts from the actual demo code (consistent with previous articles)
- Chinese prose, English variable/function names
- Close with Claude Code production comparison (consistent with previous articles)

- [ ] **Step 1: Write chapters 1-2** (RAG 本质 + 为什么需要它)
- [ ] **Step 2: Write chapter 3** (四种搜索方式 — grep, BM25, 向量, 知识图谱)
- [ ] **Step 3: Write chapter 4** (混合检索实战 — schema, write, search, integration)
- [ ] **Step 4: Write chapter 5** (底层运行机制 — 五步流程拆解)
- [ ] **Step 5: Write chapter 6 + 收尾** (最佳实践与反模式 + 系列回顾)
- [ ] **Step 6: Review full article** — check for consistency, code accuracy, flow
- [ ] **Step 7: Commit**

```bash
git add source/_posts/ai-mem-rag.md
git commit -m "feat: add Phase 3 article — RAG-based long-term memory"
```
