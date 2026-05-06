# AI Agent Digital Team (三) — 自我进化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为博客第三篇文章构建"自我进化"JS demo，在现有 `demo/ai-agent-digital-team/` 基础上新增三层日志、自我复盘、团队复盘和三档 HITL 审批机制，然后用 write-tech-article skill 写文章。

**Architecture:** 旁路系统——只加新文件，改动现有文件仅两处（mailbox_cli.js 加 L1 写入 hook，run-manager.js 加 phase 6）。`log-ops.js` 是 host 端日志库，`log-query.js` 是 container 内 CLI，Agent 通过 `run_script` 调用。数据流：seed → scheduler 发邮件 → PM 跑复盘 → Manager 审批 → PM 执行改动。

**Tech Stack:** Node.js ESM，ai-sdk/anthropic，现有 mailbox 三态状态机，JSON 文件存储

---

## File Map

**新建：**
- `demo/ai-agent-digital-team/log-ops.js` — host 端 L1/L2/L3 读写库（供 seed-logs.js、run-scheduler.js 使用）
- `demo/ai-agent-digital-team/workspace/pm/skills/log_query/log-query.js` — container 内独立 CLI（所有读取逻辑内联，无外部 import）
- `demo/ai-agent-digital-team/seed-logs.js` — 生成 7 天历史演示数据
- `demo/ai-agent-digital-team/run-scheduler.js` — 调度触发
- `demo/ai-agent-digital-team/workspace/pm/skills/product_design/SKILL.md` — 产品设计规范（baseline，故意缺少多端检查步骤）
- `demo/ai-agent-digital-team/workspace/pm/baselines/product_design_skill.md` — 同上（seed 时重置用）
- `demo/ai-agent-digital-team/workspace/pm/skills/self_retrospective/SKILL.md` — PM 自我复盘框架
- `demo/ai-agent-digital-team/workspace/manager/skills/team_retrospective/SKILL.md` — Manager 团队复盘框架
- `demo/ai-agent-digital-team/workspace/manager/skills/review_proposal/SKILL.md` — Manager 提案审批框架

**修改：**
- `demo/ai-agent-digital-team/workspace/pm/skills/mailbox/scripts/mailbox_cli.js` — 加 L1 写入 hook
- `demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js` — 加 L1 写入 hook
- `demo/ai-agent-digital-team/run-manager.js` — 加 phase 6（处理 retro_report）
- `demo/ai-agent-digital-team/package.json` — 加 seed 和 scheduler scripts

**最终产出：**
- `source/_posts/ai-agent-digital-team-3.md` — 博客文章（由 write-tech-article skill 写）

---

## 关键路径约定（贯穿全部任务）

container 内路径映射（sandbox.js 挂载规则，PM 角色）：
- `/mnt/skills/` = `workspace/pm/skills/`（只读）
- `/workspace/` = `workspace/pm/`（读写）
- `/mnt/shared/` = `workspace/shared/`（读写）

所以 container 内：
- 日志读取：`/mnt/shared/logs/`
- session 文件：`/workspace/sessions/`
- 提案写入：`/mnt/shared/proposals/`
- 邮箱：`/mnt/shared/mailboxes/`

Agent 调用 log-query.js 的方式：
```js
run_script("log_query/log-query.js", ["stats", "--agent-id", "pm", "--days", "7"])
```

---

## Task 1: 创建 log-ops.js（host 端日志库）

**Files:**
- Create: `demo/ai-agent-digital-team/log-ops.js`

- [ ] **Step 1: 创建 log-ops.js**

```js
// demo/ai-agent-digital-team/log-ops.js
import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'

// ── L2：任务-Agent 层 ────────────────────────────────────────────────────────

export function writeL2(logsDir, {agentId, taskId, taskDesc, resultQuality, durationSec, errorType, timestamp}) {
  const dir = path.join(logsDir, 'l2_task')
  fs.mkdirSync(dir, {recursive: true})
  const record = {agent_id: agentId, task_id: taskId, task_desc: taskDesc,
    result_quality: resultQuality, duration_sec: durationSec,
    error_type: errorType ?? null, timestamp}
  fs.writeFileSync(path.join(dir, `${agentId}_${taskId}.json`), JSON.stringify(record, null, 2))
}

export function readL2(logsDir, agentId, days = 7) {
  const dir = path.join(logsDir, 'l2_task')
  if (!fs.existsSync(dir)) return []
  const cutoff = Date.now() - days * 86400_000
  const results = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`${agentId}_`) || !f.endsWith('.json')) continue
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      if (new Date(r.timestamp).getTime() >= cutoff) results.push(r)
    } catch {}
  }
  return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

export function countL2Since(logsDir, agentId, hours = 24) {
  const dir = path.join(logsDir, 'l2_task')
  if (!fs.existsSync(dir)) return 0
  const cutoff = Date.now() - hours * 3_600_000
  let count = 0
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`${agentId}_`) || !f.endsWith('.json')) continue
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      if (new Date(r.timestamp).getTime() >= cutoff) count++
    } catch {}
  }
  return count
}

// ── L3 旧格式：l3_react/{agent}/{task}/step_{n}.json ─────────────────────────

export function writeL3Step(logsDir, {agentId, taskId, stepIdx, thought, action, observation, converged, timestamp}) {
  const dir = path.join(logsDir, 'l3_react', agentId, taskId)
  fs.mkdirSync(dir, {recursive: true})
  const record = {agent_id: agentId, task_id: taskId, step_idx: stepIdx,
    thought, action, observation, converged, timestamp}
  fs.writeFileSync(path.join(dir, `step_${stepIdx}.json`), JSON.stringify(record, null, 2))
}

// ── L3 v6 格式：sessions/*_raw.jsonl + index.jsonl ───────────────────────────

export function appendSessionMessages(sessionsDir, sessionId, agentId, taskId, messages, baseTime) {
  fs.mkdirSync(sessionsDir, {recursive: true})
  const rawFile = path.join(sessionsDir, `${sessionId}_raw.jsonl`)
  const idxFile = path.join(sessionsDir, 'index.jsonl')

  const existingLines = fs.existsSync(rawFile)
    ? fs.readFileSync(rawFile, 'utf-8').split('\n').filter(Boolean).length : 0

  const lines = messages.map((msg, i) => {
    const ts = new Date(baseTime.getTime() + i * 2 * 60_000).toISOString()
    return JSON.stringify({...msg, ts})
  })
  fs.appendFileSync(rawFile, lines.join('\n') + '\n')

  const entry = {
    session_id: sessionId, task_id: taskId, agent_id: agentId,
    start_ts: baseTime.toISOString(),
    end_ts: new Date(baseTime.getTime() + messages.length * 2 * 60_000).toISOString(),
    start_line: existingLines,
    end_line: existingLines + messages.length,
  }
  fs.appendFileSync(idxFile, JSON.stringify(entry) + '\n')
}

// ── L1：人类交互层 ────────────────────────────────────────────────────────────

export function writeL1(logsDir, {msgId, from_, to, type_, subject, content, timestamp}) {
  const dir = path.join(logsDir, 'l1_human')
  fs.mkdirSync(dir, {recursive: true})
  const record = {id: msgId, from: from_, to, type: type_,
    subject, content, timestamp, read: true}
  fs.writeFileSync(path.join(dir, `${msgId}.json`), JSON.stringify(record, null, 2))
}

export function readL1(logsDir, days = 7) {
  const dir = path.join(logsDir, 'l1_human')
  if (!fs.existsSync(dir)) return []
  const cutoff = Date.now() - days * 86400_000
  const results = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      if (new Date(r.timestamp).getTime() >= cutoff) results.push(r)
    } catch {}
  }
  return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

// ── 邮箱工具（供 scheduler 直接写入，不走 container）────────────────────────

export function sendMail(mailboxesDir, {from, to, type, subject, content}) {
  const filePath = path.join(mailboxesDir, `${to}.json`)
  const msgs = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : []
  msgs.push({
    id: `msg-${randomBytes(4).toString('hex')}`,
    from, to, type, subject, content,
    timestamp: new Date().toISOString(),
    status: 'unread',
    processingSince: null,
  })
  fs.mkdirSync(path.dirname(filePath), {recursive: true})
  fs.writeFileSync(filePath, JSON.stringify(msgs, null, 2))
}
```

- [ ] **Step 2: 验证文件语法正确**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
node --input-type=module <<'EOF'
import {writeL2, readL2, countL2Since, writeL3Step, writeL1, readL1, sendMail} from './log-ops.js'
console.log('log-ops.js OK — exports:', Object.keys({writeL2, readL2, countL2Since, writeL3Step, writeL1, readL1, sendMail}).join(', '))
EOF
```

期望输出：`log-ops.js OK — exports: writeL2, readL2, ...`

- [ ] **Step 3: Commit**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
git add log-ops.js
git commit -m "feat(demo3): add log-ops.js host-side log library"
```

---

## Task 2: 创建 log-query.js（container 内 CLI）

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/pm/skills/log_query/log-query.js`

这个脚本跑在 Podman container 里，所有读取逻辑内联，不 import 任何外部模块，只用 Node.js 内置 `fs` 和 `path`。默认路径使用 container 内路径。

- [ ] **Step 1: 创建 log-query.js**

```js
#!/usr/bin/env node
// workspace/pm/skills/log_query/log-query.js
// 统一日志查询 CLI — Agent 通过 run_script("log_query/log-query.js", [...]) 调用
// 运行于 container 内，默认路径为 container 挂载路径

import fs from 'fs'
import path from 'path'

const DEFAULT_LOGS_DIR = '/mnt/shared/logs'
const DEFAULT_SESSIONS_DIR = '/workspace/sessions'
const AGENT_IDS = ['pm', 'manager']

function parseArgs(argv) {
  const args = {_: []}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1] ?? true
      i++
    } else {
      args._.push(argv[i])
    }
  }
  return args
}

// ── 读取工具函数 ──────────────────────────────────────────────────────────────

function readL2(logsDir, agentId, days) {
  const dir = path.join(logsDir, 'l2_task')
  if (!fs.existsSync(dir)) return []
  const cutoff = Date.now() - Number(days) * 86400_000
  const results = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`${agentId}_`) || !f.endsWith('.json')) continue
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      if (new Date(r.timestamp).getTime() >= cutoff) results.push(r)
    } catch {}
  }
  return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

function readL1(logsDir, days) {
  const dir = path.join(logsDir, 'l1_human')
  if (!fs.existsSync(dir)) return []
  const cutoff = Date.now() - Number(days) * 86400_000
  const results = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      if (new Date(r.timestamp).getTime() >= cutoff) results.push(r)
    } catch {}
  }
  return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

function readL3Steps(logsDir, agentId, taskId) {
  const dir = path.join(logsDir, 'l3_react', agentId, taskId)
  if (!fs.existsSync(dir)) return []
  const steps = []
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.startsWith('step_')) continue
    try { steps.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))) } catch {}
  }
  return steps
}

function readSessionSteps(sessionsDir, taskId) {
  const idxFile = path.join(sessionsDir, 'index.jsonl')
  if (!fs.existsSync(idxFile)) return []
  const entries = fs.readFileSync(idxFile, 'utf-8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l) } catch { return null } })
    .filter(e => e && e.task_id === taskId)
  const results = []
  for (const entry of entries) {
    const rawFile = path.join(sessionsDir, `${entry.session_id}_raw.jsonl`)
    if (!fs.existsSync(rawFile)) continue
    const lines = fs.readFileSync(rawFile, 'utf-8').split('\n').filter(Boolean)
    for (let i = entry.start_line; i < Math.min(entry.end_line, lines.length); i++) {
      try { results.push(JSON.parse(lines[i])) } catch {}
    }
  }
  return results
}

// ── 子命令 ───────────────────────────────────────────────────────────────────

function cmdStats(args) {
  const logsDir = args['logs-dir'] || DEFAULT_LOGS_DIR
  const agentId = args['agent-id']
  const days = args.days || 7
  const records = readL2(logsDir, agentId, days)
  if (records.length === 0) {
    return {agent_id: agentId, days, task_count: 0, avg_quality: 0, failure_count: 0, human_correction_count: 0}
  }
  const qualities = records.map(r => r.result_quality ?? 0)
  const avgQuality = qualities.reduce((a, b) => a + b, 0) / qualities.length
  const l1 = readL1(logsDir, days)
  const humanCorrections = l1.filter(r => ['checkpoint_rejected', 'retro_decision'].includes(r.type)).length
  return {agent_id: agentId, days, task_count: records.length,
    avg_quality: Math.round(avgQuality * 1000) / 1000,
    failure_count: qualities.filter(q => q < 0.5).length,
    human_correction_count: humanCorrections}
}

function cmdTasks(args) {
  const logsDir = args['logs-dir'] || DEFAULT_LOGS_DIR
  const agentId = args['agent-id']
  const days = args.days || 7
  let records = readL2(logsDir, agentId, days)
  if (args.sort === 'quality_asc') records.sort((a, b) => (a.result_quality ?? 1) - (b.result_quality ?? 1))
  else if (args.sort === 'quality_desc') records.sort((a, b) => (b.result_quality ?? 0) - (a.result_quality ?? 0))
  else if (args.sort === 'time_desc') records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  if (args.limit) records = records.slice(0, Number(args.limit))
  const tasks = records.map(r => ({
    task_id: r.task_id, task_desc: (r.task_desc || '').slice(0, 120),
    result_quality: r.result_quality, duration_sec: r.duration_sec,
    error_type: r.error_type, timestamp: r.timestamp,
  }))
  return {agent_id: agentId, count: tasks.length, tasks}
}

function cmdSteps(args) {
  const logsDir = args['logs-dir'] || DEFAULT_LOGS_DIR
  const sessionsDir = args['sessions-dir'] || DEFAULT_SESSIONS_DIR
  const taskId = args['task-id']
  const agentId = args['agent-id'] || 'pm'
  let steps = readSessionSteps(sessionsDir, taskId)
  if (steps.length === 0) steps = readL3Steps(logsDir, agentId, taskId)
  return {task_id: taskId, step_count: steps.length, steps}
}

function cmdL1(args) {
  const logsDir = args['logs-dir'] || DEFAULT_LOGS_DIR
  const days = args.days || 7
  let records = readL1(logsDir, days)
  if (args.keyword) {
    const kw = String(args.keyword).toLowerCase()
    records = records.filter(r =>
      (r.content || '').toLowerCase().includes(kw) ||
      (r.subject || '').toLowerCase().includes(kw))
  }
  const results = records.map(r => ({
    id: r.id, type: r.type, subject: r.subject,
    content: (r.content || '').slice(0, 200), timestamp: r.timestamp,
  }))
  return {count: results.length, records: results}
}

function cmdAllAgents(args) {
  const logsDir = args['logs-dir'] || DEFAULT_LOGS_DIR
  const days = args.days || 7
  const result = {}
  for (const agentId of AGENT_IDS) {
    const records = readL2(logsDir, agentId, days)
    const qualities = records.map(r => r.result_quality ?? 0)
    result[agentId] = {
      task_count: records.length,
      avg_quality: qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length * 1000) / 1000 : 0,
      failure_count: qualities.filter(q => q < 0.5).length,
    }
  }
  return result
}

// ── 入口 ─────────────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv
const args = parseArgs(rest)

const handlers = {stats: cmdStats, tasks: cmdTasks, steps: cmdSteps, l1: cmdL1, 'all-agents': cmdAllAgents}
if (!handlers[command]) {
  console.error(JSON.stringify({error: `Unknown command: ${command}. Use: ${Object.keys(handlers).join(', ')}`}))
  process.exit(1)
}

console.log(JSON.stringify(handlers[command](args), null, 2))
```

- [ ] **Step 2: 验证语法（在 host 上跑，用 host 路径参数）**

先创建一个临时测试目录：
```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
mkdir -p /tmp/test-logs/l2_task /tmp/test-logs/l1_human
echo '{"agent_id":"pm","task_id":"t001","task_desc":"test","result_quality":0.8,"duration_sec":100,"error_type":null,"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > /tmp/test-logs/l2_task/pm_t001.json
node workspace/pm/skills/log_query/log-query.js stats --agent-id pm --days 7 --logs-dir /tmp/test-logs
```

期望输出（JSON，task_count: 1）：
```json
{
  "agent_id": "pm",
  "days": 7,
  "task_count": 1,
  "avg_quality": 0.8,
  "failure_count": 0,
  "human_correction_count": 0
}
```

- [ ] **Step 3: Commit**

```bash
git add workspace/pm/skills/log_query/log-query.js
git commit -m "feat(demo3): add log-query.js container CLI"
```

---

## Task 3: 修改 mailbox_cli.js 添加 L1 写入 hook

**Files:**
- Modify: `workspace/pm/skills/mailbox/scripts/mailbox_cli.js`
- Modify: `workspace/manager/skills/mailbox/scripts/mailbox_cli.js`

当 `send --to human` 时，在 `/mnt/shared/logs/l1_human/` 写入一条 L1 记录。注意：container 内没有 `crypto` 模块的 `randomBytes`，改用 `Math.random().toString(36)` 生成 ID。

- [ ] **Step 1: 修改 PM 的 mailbox_cli.js**

在 `workspace/pm/skills/mailbox/scripts/mailbox_cli.js` 的 `send()` 函数内，在 `saveMailbox(...)` 调用之后、`console.log(...)` 之前，加入：

```js
// L1 AOP：to=human 时自动写 L1 日志（调用方零感知）
if (to === 'human') {
  _writeL1Log(mailboxesDir, msg)
}
```

并在文件顶部（现有 `import` 之后）加入这个函数（注意：container 内 `/mnt/shared` 是 sharedDir，logs 在 `/mnt/shared/logs/`）：

```js
function _writeL1Log(mailboxesDir, msg) {
  try {
    const logsDir = path.join(path.dirname(mailboxesDir), 'logs', 'l1_human')
    fs.mkdirSync(logsDir, {recursive: true})
    const record = {
      id: msg.id, from: msg.from, to: msg.to,
      type: msg.type, subject: msg.subject, content: msg.content,
      timestamp: msg.timestamp, read: false,
    }
    fs.writeFileSync(path.join(logsDir, `${msg.id}.json`), JSON.stringify(record, null, 2))
  } catch {}
}
```

完整修改后的 `send()` 函数应如下：

```js
function send({mailboxesDir, from, to, type, subject, content}) {
  const filePath = path.join(mailboxesDir, `${to}.json`)
  const messages = loadMailbox(filePath)
  const msg = {
    id: `msg-${randomBytes(4).toString('hex')}`,
    from, to, type, subject, content,
    timestamp: new Date().toISOString(),
    status: STATUS_UNREAD,
    processingSince: null,
  }
  messages.push(msg)
  saveMailbox(filePath, messages)
  // L1 AOP：to=human 时自动写 L1 日志（调用方零感知）
  if (to === 'human') {
    _writeL1Log(mailboxesDir, msg)
  }
  console.log(JSON.stringify({ok: true, id: msg.id}))
}
```

- [ ] **Step 2: 对 Manager 的 mailbox_cli.js 做完全相同的修改**

`workspace/manager/skills/mailbox/scripts/mailbox_cli.js` 做相同改动（加 `_writeL1Log` 函数，在 `send()` 里调用）。

- [ ] **Step 3: Commit**

```bash
git add workspace/pm/skills/mailbox/scripts/mailbox_cli.js
git add workspace/manager/skills/mailbox/scripts/mailbox_cli.js
git commit -m "feat(demo3): add L1 log AOP hook to mailbox_cli send-to-human"
```

---

## Task 4: 创建 product_design skill 和 baseline

**Files:**
- Create: `workspace/pm/skills/product_design/SKILL.md`
- Create: `workspace/pm/baselines/product_design_skill.md`

这个 baseline 版本故意缺少"多端检查"步骤，这样复盘才能发现 `sop_gap` 并提案修复。

- [ ] **Step 1: 创建 SKILL.md（baseline 版，无多端检查）**

```markdown
---
name: product_design
type: reference
description: 产品文档设计规范，包含产品文档结构、写作要求和验收标准。
---

# 产品文档设计规范

本规范指导你如何撰写高质量的产品规格文档（product_spec.md）。

## 文档结构

产品规格文档（`/mnt/shared/design/product_spec.md`）必须包含以下章节：

```markdown
# 产品规格文档

## 项目背景
简要描述项目来源和业务价值（3-5句话）

## 目标用户
- 主要用户画像（1-2个）
- 核心使用场景

## 核心功能
| 功能模块 | 功能描述 | 优先级 |
|---------|---------|--------|
| 模块1   | ...     | P0/P1  |

## 用户故事
- 作为 [用户]，我希望 [功能]，以便 [价值]

## 验收标准
明确列出每个功能的验收条件（可验证的）

## 范围外（Out of Scope）
本期不做的内容，避免需求蔓延
```

## 写作流程

1. **需求来源**：从 `/mnt/shared/needs/requirements.md` 读取原始需求
2. **结构化优先**：表格 > 列表 > 段落
3. **可验证**：每个功能点必须有明确的验收标准
4. **简洁**：总长度控制在 500-1000 字

## 输出路径

产品文档写入：`/mnt/shared/design/product_spec.md`

完成后，通过 `mailbox` Skill 向 Manager 发送 `task_done` 邮件，邮件内容只写文档路径：
> 产品文档已写入 /mnt/shared/design/product_spec.md，请验收
```

- [ ] **Step 2: 将同样内容写入 baselines/product_design_skill.md**

`workspace/pm/baselines/product_design_skill.md` 内容与 `workspace/pm/skills/product_design/SKILL.md` 完全相同。

- [ ] **Step 3: Commit**

```bash
git add workspace/pm/skills/product_design/SKILL.md workspace/pm/baselines/product_design_skill.md
git commit -m "feat(demo3): add product_design skill (baseline, no multi-platform check)"
```

---

## Task 5: 创建 seed-logs.js

**Files:**
- Create: `demo/ai-agent-digital-team/seed-logs.js`

生成 7 天历史演示数据，模拟 PM 运行一周（8 条 L2 任务，3 条低质量，3 条 L1 纠正），重置 product_design SKILL.md 到 baseline。

- [ ] **Step 1: 创建 seed-logs.js**

```js
// demo/ai-agent-digital-team/seed-logs.js
import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {writeL2, writeL3Step, writeL1, appendSessionMessages} from './log-ops.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.join(__dirname, 'workspace')
const LOGS_DIR = path.join(WORKSPACE, 'shared', 'logs')
const PM_SESSIONS_DIR = path.join(WORKSPACE, 'pm', 'sessions')

function daysAgo(n) {
  return new Date(Date.now() - n * 86400_000)
}

// 清空旧数据
;[LOGS_DIR, PM_SESSIONS_DIR].forEach(dir => {
  if (fs.existsSync(dir)) fs.rmSync(dir, {recursive: true})
  fs.mkdirSync(dir, {recursive: true})
})

// ── L2 日志：PM 8 条任务（3 条低质量）───────────────────────────────────────
const pmTasks = [
  ['t001', '用户登录功能产品设计文档',    0.40, 180, 'checkpoint_rejected', 6],
  ['t002', '用户注册流程产品设计文档',    0.85, 120, null,                  5],
  ['t003', '产品设计文档v2（用户登录）',  0.42, 200, 'checkpoint_rejected', 5],
  ['t004', '支付流程产品规格说明',        0.90, 150, null,                  4],
  ['t005', '数据看板产品设计文档',        0.88, 130, null,                  3],
  ['t006', '用户注册设计迭代（移动端）',  0.38, 220, 'checkpoint_rejected', 2],
  ['t007', '搜索功能产品需求文档',        0.82, 110, null,                  2],
  ['t008', '消息通知产品设计文档',        0.79, 140, null,                  1],
]
for (const [taskId, taskDesc, resultQuality, durationSec, errorType, n] of pmTasks) {
  writeL2(LOGS_DIR, {agentId: 'pm', taskId, taskDesc, resultQuality, durationSec, errorType,
    timestamp: daysAgo(n).toISOString()})
}
console.log(`[SEED] PM L2 日志已写入：${pmTasks.length} 条`)

// ── L2 日志：Manager 3 条（质量正常）────────────────────────────────────────
const managerTasks = [
  ['m001', '需求澄清：用户注册功能', 0.92, 90,  null, 6],
  ['m002', '任务分配：产品设计文档', 0.88, 60,  null, 5],
  ['m003', '验收：用户注册产品文档', 0.85, 75,  null, 4],
]
for (const [taskId, taskDesc, resultQuality, durationSec, errorType, n] of managerTasks) {
  writeL2(LOGS_DIR, {agentId: 'manager', taskId, taskDesc, resultQuality, durationSec, errorType,
    timestamp: daysAgo(n).toISOString()})
}
console.log(`[SEED] Manager L2 日志已写入：${managerTasks.length} 条`)

// ── L3 旧格式：3 个失败任务的步骤日志 ──────────────────────────────────────
const l3Data = [
  {taskId: 't001', daysBack: 6, steps: [
    [0, '读取需求文档，了解登录功能要求', 'read_requirements', '已读取，要求：邮箱登录+密码', true],
    [1, '开始撰写产品规格文档',          'write_document',    '已写入基本结构',              true],
    [2, '文档完成，发送完成通知',        'send_mail',         '已发送 task_done 给 manager', true],
  ]},
  {taskId: 't003', daysBack: 5, steps: [
    [0, '读取需求文档和前一版设计文档',    'read_requirements', '已读取',                true],
    [1, '撰写v2文档，修改登录页面描述',    'write_document',    '已更新产品文档',          true],
    [2, '检查是否覆盖所有需求点',         'read_document',     'Error: 发现缺少错误状态处理', false],
    [3, '补充错误处理，但未完整覆盖',      'write_document',    '部分补充',               true],
    [4, '发送完成通知',                   'send_mail',         '已发送 task_done',        true],
  ]},
  {taskId: 't006', daysBack: 2, steps: [
    [0, '读取需求文档',                   'read_requirements', '需求：注册流程+移动端优先', true],
    [1, '撰写产品设计文档（桌面端视角）',  'write_document',    '已完成桌面端设计',         true],
    [2, 'Fail: 未考虑移动端适配，直接提交', 'send_mail',        '已发送',                  true],
  ]},
]
for (const {taskId, daysBack, steps} of l3Data) {
  const base = daysAgo(daysBack)
  for (const [stepIdx, thought, action, observation, converged] of steps) {
    const ts = new Date(base.getTime() + stepIdx * 5 * 60_000).toISOString()
    writeL3Step(LOGS_DIR, {agentId: 'pm', taskId, stepIdx, thought, action, observation, converged, timestamp: ts})
  }
}
console.log('[SEED] PM L3 步骤日志已写入：3 个失败任务')

// ── L3 v6 格式：sessions/*_raw.jsonl + index.jsonl ────────────────────────
const sessionData = [
  {taskId: 't001', daysBack: 6, messages: [
    {role: 'assistant', content: '读取需求文档，了解登录功能要求'},
    {role: 'tool',      content: '已读取，要求：邮箱登录+密码'},
    {role: 'assistant', content: '开始撰写产品规格文档'},
    {role: 'tool',      content: '已写入基本结构'},
    {role: 'assistant', content: '文档完成，发送完成通知'},
    {role: 'tool',      content: '已发送 task_done 给 manager'},
  ]},
  {taskId: 't003', daysBack: 5, messages: [
    {role: 'assistant', content: '读取需求文档和前一版设计文档'},
    {role: 'tool',      content: '已读取'},
    {role: 'assistant', content: '撰写v2文档，修改登录页面描述'},
    {role: 'tool',      content: '已更新产品文档'},
    {role: 'assistant', content: '检查是否覆盖所有需求点'},
    {role: 'tool',      content: 'Error: 发现缺少错误状态处理，表单验证逻辑缺失'},
    {role: 'assistant', content: '补充错误处理，但未完整覆盖'},
    {role: 'tool',      content: '部分补充'},
  ]},
  {taskId: 't006', daysBack: 2, messages: [
    {role: 'assistant', content: '读取需求文档'},
    {role: 'tool',      content: '需求：注册流程+移动端优先'},
    {role: 'assistant', content: '撰写产品设计文档（桌面端视角）'},
    {role: 'tool',      content: '已完成桌面端设计'},
    {role: 'assistant', content: 'Fail: 未考虑移动端适配，直接提交'},
    {role: 'tool',      content: '已发送'},
  ]},
]
for (const {taskId, daysBack, messages} of sessionData) {
  appendSessionMessages(PM_SESSIONS_DIR, 'demo_article3', 'pm', taskId, messages, daysAgo(daysBack))
}
console.log('[SEED] PM session L3 日志已写入（v6 格式）')

// ── L1 日志：3 条人类纠正记录 ────────────────────────────────────────────────
const l1Data = [
  ['l1_001', 'checkpoint_rejected', '设计文档退回：t001', '缺少移动端适配方案，请重新设计',         5],
  ['l1_002', 'checkpoint_rejected', '设计文档退回：t003', '交互细节不足，表单验证逻辑缺失',         4],
  ['l1_003', 'checkpoint_rejected', '设计文档退回：t006', '未考虑桌面端/移动端差异，需补充多端设计', 1],
]
for (const [msgId, type_, subject, content, n] of l1Data) {
  writeL1(LOGS_DIR, {msgId, from_: 'manager', to: 'human', type_,
    subject, content, timestamp: daysAgo(n).toISOString()})
}
console.log(`[SEED] L1 人类纠正日志已写入：${l1Data.length} 条`)

// ── 重置 PM product_design SKILL.md 到 baseline ──────────────────────────
const baseline = path.join(WORKSPACE, 'pm', 'baselines', 'product_design_skill.md')
const target   = path.join(WORKSPACE, 'pm', 'skills', 'product_design', 'SKILL.md')
if (fs.existsSync(baseline)) {
  fs.copyFileSync(baseline, target)
  console.log('[SEED] product_design SKILL.md 已重置到 baseline')
} else {
  console.warn('[SEED] baseline 文件不存在，跳过重置')
}

console.log('[SEED] 完成！')
```

- [ ] **Step 2: 运行并验证**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
node seed-logs.js
```

期望输出：
```
[SEED] PM L2 日志已写入：8 条
[SEED] Manager L2 日志已写入：3 条
[SEED] PM L3 步骤日志已写入：3 个失败任务
[SEED] PM session L3 日志已写入（v6 格式）
[SEED] L1 人类纠正日志已写入：3 条
[SEED] product_design SKILL.md 已重置到 baseline
[SEED] 完成！
```

然后验证文件存在：
```bash
ls workspace/shared/logs/l2_task/ | head -5
ls workspace/shared/logs/l1_human/
ls workspace/pm/sessions/
```

- [ ] **Step 3: 用 log-query.js 验证数据可读**

```bash
node workspace/pm/skills/log_query/log-query.js stats \
  --agent-id pm --days 7 \
  --logs-dir $(pwd)/workspace/shared/logs
```

期望：`task_count: 8, avg_quality: ~0.68, failure_count: 3`

- [ ] **Step 4: Commit**

```bash
git add seed-logs.js
git commit -m "feat(demo3): add seed-logs.js demo data generator"
```

---

## Task 6: 创建 run-scheduler.js

**Files:**
- Create: `demo/ai-agent-digital-team/run-scheduler.js`

检查双条件（距上次复盘 >24h，且最近 24h 的 L2 任务 ≥5），满足则发邮件。对于 demo，因为 seed 数据在历史时间点，调度器基于"seed 了多少条"判断而非"最近 24h"。

- [ ] **Step 1: 创建 run-scheduler.js**

```js
// demo/ai-agent-digital-team/run-scheduler.js
import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {countL2Since, sendMail} from './log-ops.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')
const LOGS_DIR = path.join(SHARED_DIR, 'logs')
const MAILBOXES_DIR = path.join(SHARED_DIR, 'mailboxes')
const STATE_FILE = path.join(SHARED_DIR, '.last_retro.json')

const MIN_GAP_HOURS = 24
const MIN_TASK_COUNT = 5

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {}
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), {recursive: true})
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function shouldTrigger(agentId, now) {
  const state = readState()
  const last = state[agentId]
  if (last) {
    const gapHours = (now - new Date(last)) / 3_600_000
    if (gapHours < MIN_GAP_HOURS) return [false, `时间未到（距上次复盘 ${Math.round(gapHours)}h < ${MIN_GAP_HOURS}h）`]
  }
  // Demo: 用 48h 窗口覆盖 seed 的历史数据（seed 任务跨多天，用更长窗口）
  const count = countL2Since(LOGS_DIR, agentId, 48)
  if (count < MIN_TASK_COUNT) return [false, `任务量不足（${count} < ${MIN_TASK_COUNT}）`]
  return [true, '条件满足']
}

const now = new Date()
const triggered = []

for (const agentId of ['pm', 'manager']) {
  const [ok, reason] = shouldTrigger(agentId, now)
  console.log(`[Scheduler] ${agentId}: ${reason}`)
  if (!ok) continue

  const type = agentId === 'manager' ? 'team_retro_trigger' : 'retro_trigger'
  sendMail(MAILBOXES_DIR, {
    from: 'manager',
    to: agentId,
    type,
    subject: `请执行复盘（${reason}）`,
    content: JSON.stringify({reason: 'threshold_met', at: now.toISOString()}),
  })

  const state = readState()
  state[agentId] = now.toISOString()
  writeState(state)

  console.log(`[Scheduler] 已发送 ${type} 给 ${agentId}`)
  triggered.push(agentId)
}

if (triggered.length === 0) {
  console.log('[Scheduler] 无需触发复盘')
} else {
  console.log(`[Scheduler] 触发完成：${triggered.join(', ')}`)
}
```

- [ ] **Step 2: 运行验证（先 seed 数据）**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
node seed-logs.js   # 确保有数据
node run-scheduler.js
```

期望输出（PM 有 8 条 48h 内任务，满足条件；Manager 有 3 条，不满足 ≥5）：
```
[Scheduler] pm: 条件满足
[Scheduler] 已发送 retro_trigger 给 pm
[Scheduler] manager: 任务量不足（3 < 5）
[Scheduler] 触发完成：pm
```

验证 PM 邮箱有新消息：
```bash
node -e "import('./log-ops.js').then(m => console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('workspace/shared/mailboxes/pm.json','utf-8')).filter(x=>x.type==='retro_trigger'), null, 2)))"
```
或直接：
```bash
cat workspace/shared/mailboxes/pm.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.filter(m=>m.type==='retro_trigger').length + ' retro_trigger message(s)')"
```

- [ ] **Step 3: Commit**

```bash
git add run-scheduler.js
git commit -m "feat(demo3): add run-scheduler.js double-condition trigger"
```

---

## Task 7: 创建 PM self_retrospective/SKILL.md

**Files:**
- Create: `workspace/pm/skills/self_retrospective/SKILL.md`

JS demo 版本：将 Python 版的 `python3 tools/log_query.py` 替换为 `run_script("log_query/log-query.js", [...])` 调用，proposals 路径改为 container 内的 `/mnt/shared/proposals/`。

- [ ] **Step 1: 创建 SKILL.md**

```markdown
---
name: self_retrospective
type: task
description: 自我复盘思考框架。当你收到 type=retro_trigger 的邮件、或被要求"反思本周工作"/"自我复盘"时加载此 Skill。用 log_query CLI 查数据，用 LLM 推理做分析，产出结构化复盘报告和改进提案。
---

# 自我复盘

## 你的任务

分析过去 7 天的工作记录，找出系统性问题，产出改进方案。

## 可用工具

通过 `run_script` 调用 `log_query/log-query.js`，支持以下查询（按需使用，不限顺序）：

```
run_script("log_query/log-query.js", ["stats", "--agent-id", "pm", "--days", "7"])
run_script("log_query/log-query.js", ["tasks", "--agent-id", "pm", "--days", "7", "--sort", "quality_asc", "--limit", "5"])
run_script("log_query/log-query.js", ["steps", "--task-id", "<TASK_ID>", "--agent-id", "pm"])
run_script("log_query/log-query.js", ["l1", "--days", "7", "--keyword", "关键词"])
```

## 思考框架（非强制顺序，按需使用）

你的分析目标是回答五个递进问题：

1. **哪些任务做得差？** — 从统计和任务列表中发现模式
2. **差在哪一步？** — 下钻具体任务的执行步骤
3. **人类怎么看？** — L1 纠正记录提供独立视角
4. **根因是什么类型？** — 必须从枚举中选择（见下方）
5. **应该改哪个文件的哪一段？** — 精确到可执行的 before/after 改动

## root_cause 枚举（必选其一，禁止自由文本）

| 枚举值 | 含义 | 对应改动对象 |
|--------|------|-------------|
| `sop_gap` | 流程/SOP 缺步骤 | agent.md 或 skills/*.md |
| `prompt_ambiguity` | 提示词/soul 指令模糊 | soul.md |
| `ability_gap` | 知识/经验不足 | memory.md |
| `integration_issue` | 与其他 Agent 协作问题 | agent.md 协作部分 |

## 输出格式（必须严格遵守）

产出一份 JSON，使用 writeFile 工具写入 `/mnt/shared/proposals/pm_retro_<YYYYMMDD>.json`（日期用今天）：

```json
{
  "retrospective_report": {
    "agent_id": "pm",
    "period": "2026-04-28 ~ 2026-05-04",
    "summary": "一句话总结本周主要问题",
    "findings": [
      {
        "pattern": "描述发现的模式",
        "evidence_task_ids": ["t001", "t003", "t006"],
        "l1_corroboration": "人类纠正记录是否验证了这个发现"
      }
    ]
  },
  "improvement_proposals": [
    {
      "root_cause": "sop_gap",
      "target_file": "skills/product_design/SKILL.md",
      "current_behavior": "当前行为描述",
      "proposed_change": "具体改动描述（自然语言）",
      "before_text": "定位锚点：要改的那段原文（必须是文件里真实存在的文本）",
      "after_text": "改后的完整文本",
      "expected_improvement": "预期指标变化",
      "evidence": ["t001", "t003"]
    }
  ]
}
```

## 约束

- **evidence 不允许为空** — 每条提案必须有日志 ID 支撑
- **一次复盘最多 3 条提案** — 聚焦最重要的改进
- **target_file 只允许改自己的文件**：agent.md / soul.md / memory.md / skills/*.md
- **不要自己执行改动** — 你只产出方案，由 Manager 审批后你再执行
- **样本不足时跳过** — task_count < 5 直接报告"样本不足，跳过复盘"
- **禁止复述式反思** — "下次要注意 XX"不是根因分析，必须指向具体文件改动
- **before_text 必须是文件里真实存在的文本** — 先用 readFile 读文件，再写 before_text

## 完成后

发邮件给 Manager（通过 mailbox Skill）：
- type: `retro_report`
- subject: "自我复盘完成，{N}条提案待审阅"
- content: proposals 文件的宿主机路径

⚠️ **不直接发 Human**。所有对外通信必须经过 Manager。
```

- [ ] **Step 2: Commit**

```bash
git add workspace/pm/skills/self_retrospective/SKILL.md
git commit -m "feat(demo3): add PM self_retrospective skill"
```

---

## Task 8: 创建 Manager 复盘相关 Skill

**Files:**
- Create: `workspace/manager/skills/team_retrospective/SKILL.md`
- Create: `workspace/manager/skills/review_proposal/SKILL.md`

- [ ] **Step 1: 创建 team_retrospective/SKILL.md**

```markdown
---
name: team_retrospective
type: task
description: 团队复盘思考框架（Manager 专用）。当你收到 type=team_retro_trigger 的邮件时加载此 Skill。从聚合视角分析全员数据，发现跨 Agent 问题，级联触发瓶颈 Agent 的自我复盘，发周报给 Human。
---

# 团队复盘

## 你的任务

从全局视角分析所有 Agent 的运行状况，发现自我复盘看不到的跨 Agent 问题。

## 可用工具

通过 `run_script` 调用 `log_query/log-query.js`（注意：Manager 的 log_query 路径也是 `log_query/log-query.js`，需确认 Manager 的 skills 目录下有此文件）：

```
run_script("log_query/log-query.js", ["all-agents", "--days", "7"])
run_script("log_query/log-query.js", ["tasks", "--agent-id", "pm", "--days", "7", "--sort", "quality_asc"])
run_script("log_query/log-query.js", ["l1", "--days", "7"])
```

## 思考框架（非强制顺序）

1. **谁是瓶颈？** — 对比各 Agent 质量分布
2. **有没有跨 Agent 模式？** — 多个 Agent 犯同类错误 → 可能是共享规范问题
3. **协作接口健康吗？** — 邮件往返次数、交接失败率

## 完成后

1. 如发现瓶颈 Agent → 发 `retro_trigger` 邮件给该 Agent（通过 mailbox Skill）
2. 发周报给 Human：type=`weekly_report`，包含本周恶化指标 + 瓶颈 Agent + 改进方向

## 约束

- **不读 L3** — L3 是各 Agent 自己的工作域
- **不替 Agent 做复盘** — 级联触发后由 Agent 自己完成
```

- [ ] **Step 2: 创建 review_proposal/SKILL.md**

```markdown
---
name: review_proposal
type: task
description: 审批复盘提案（Manager 专用）。收到 type=retro_report 邮件时加载此 Skill。按改动深度分档，memory 自动批准（加闸门），skill/agent 转 Human 确认，soul 标记高风险转 Human。
---

# 审批复盘提案

## 触发条件

收到 type=`retro_report` 的邮件（来自某 Agent 的自我复盘产出）

## 流程

1. **读取 proposals JSON 文件**（路径在邮件 content 中，是宿主机路径，用 readFile 读取）
2. **对每条提案做预审**：
   - evidence 是否充分？（至少 1 条日志 ID）
   - proposed_change 是否合理？（指向具体文件改动，不是"下次注意"）
3. **按改动深度分档处理**：

| 档位 | target_file 包含 | 处理方式 |
|------|-----------------|---------|
| 档 1 | `memory.md` | 自动批准（硬闸门：3条/天，超过转档2） |
| 档 2 | `skills/*.md` / `agent.md` | 发给 Human 确认（type=retro_review） |
| 档 3 | `soul.md` | 发给 Human 确认 + 标记⚠️高风险 |

4. **Human 批准（human.json 中 retro_review 消息被标记 read=true 且无 rejected）** → 发 `retro_approved` 邮件给提案 Agent
5. **Human 拒绝（retro_review 消息 rejected=true）** → 发 `retro_rejected` 邮件

## retro_approved 邮件的 content（JSON 字符串）

```json
{
  "proposal_file": "/宿主机绝对路径/proposals/pm_retro_20260506.json",
  "approved_indices": [0],
  "changes": [
    {
      "target_file": "宿主机绝对路径/workspace/pm/skills/product_design/SKILL.md",
      "before_text": "...",
      "after_text": "..."
    }
  ]
}
```

## 约束

- **不自己执行改动** — 只做审批决策，执行由提案 Agent 完成
- **档 1 自动批准有上限** — 同一 Agent 同一天最多 3 条 memory 改动
- **soul.md 改动必须转 Human** — soul 改错会导致 Agent 所有后续判断偏移
```

- [ ] **Step 3: 注意：Manager 没有 log_query skill**

Manager 的 `workspaceDir` 是 `workspace/manager/`，所以 `run_script("log_query/log-query.js", ...)` 会去找 `workspace/manager/skills/log_query/log-query.js`。需要在 Manager skills 目录下也创建 log_query CLI（与 PM 版完全相同）：

```bash
mkdir -p workspace/manager/skills/log_query
cp workspace/pm/skills/log_query/log-query.js workspace/manager/skills/log_query/log-query.js
```

- [ ] **Step 4: Commit**

```bash
git add workspace/manager/skills/team_retrospective/SKILL.md
git add workspace/manager/skills/review_proposal/SKILL.md
git add workspace/manager/skills/log_query/log-query.js
git commit -m "feat(demo3): add Manager team_retrospective, review_proposal skills and log_query"
```

---

## Task 9: 修改 run-manager.js 添加 phase 6

**Files:**
- Modify: `demo/ai-agent-digital-team/run-manager.js`

在 `detectPhase()` 函数中，在 phase 5 检查之后加 phase 6 检查（retro_report in manager inbox）。在 switch 里加 case 6。

- [ ] **Step 1: 在 detectPhase() 里加 phase 6 检测**

在现有 `detectPhase()` 函数的 `if (taskDone) return 5` 之后，加：

```js
const retroReport = managerInbox.find(m => m.type === 'retro_report' && m.status !== 'done')
if (retroReport) return 6
```

- [ ] **Step 2: 在 switch 里加 case 6**

在 `case 5:` 块之后加：

```js
case 6:
  userRequest =
    `你收到了一份复盘报告（type=retro_report 邮件）。请加载 review_proposal Skill，` +
    `读取提案文件，按档位分类后处理审批流程。` +
    `档 1（memory）自动批准并发 retro_approved 给 PM；` +
    `档 2（skills/agent）和档 3（soul）发给 Human 确认（type=retro_review），` +
    `等 Human 确认后再发 retro_approved 或 retro_rejected 给 PM。` +
    `全部处理完后标记 retro_report 邮件为 done。`
  break
```

- [ ] **Step 3: 验证修改后语法正确**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
node --input-type=module <<'EOF'
import {readFileSync} from 'fs'
const src = readFileSync('./run-manager.js', 'utf-8')
console.log('phase 6 in detectPhase:', src.includes('retro_report'))
console.log('case 6 in switch:', src.includes('case 6:'))
EOF
```

期望：两行都输出 `true`

- [ ] **Step 4: Commit**

```bash
git add run-manager.js
git commit -m "feat(demo3): add phase 6 to run-manager for retro_report handling"
```

---

## Task 10: 更新 package.json

**Files:**
- Modify: `demo/ai-agent-digital-team/package.json`

- [ ] **Step 1: 在 scripts 里加 seed 和 scheduler**

在 `package.json` 的 `"scripts"` 里加两行：

```json
"seed": "node seed-logs.js",
"scheduler": "node run-scheduler.js"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(demo3): add seed and scheduler npm scripts"
```

---

## Task 11: 端到端验证

验证完整流程可以跑通。

- [ ] **Step 1: 重置并 seed 数据**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
node seed-logs.js
```

期望：全部输出无报错

- [ ] **Step 2: 触发复盘调度**

```bash
node run-scheduler.js
```

期望：`[Scheduler] pm: 条件满足` + PM 邮箱有 retro_trigger 消息

验证：
```bash
cat workspace/shared/mailboxes/pm.json | grep -c retro_trigger
```
期望输出：`1`

- [ ] **Step 3: 验证 log-query 子命令全部工作**

```bash
LOGS=$(pwd)/workspace/shared/logs
node workspace/pm/skills/log_query/log-query.js stats --agent-id pm --days 7 --logs-dir $LOGS | grep task_count
node workspace/pm/skills/log_query/log-query.js tasks --agent-id pm --days 7 --sort quality_asc --limit 3 --logs-dir $LOGS | grep count
node workspace/pm/skills/log_query/log-query.js steps --task-id t001 --agent-id pm --logs-dir $LOGS | grep step_count
node workspace/pm/skills/log_query/log-query.js l1 --days 7 --keyword 移动端 --logs-dir $LOGS | grep count
node workspace/pm/skills/log_query/log-query.js all-agents --days 7 --logs-dir $LOGS
```

期望：每条命令输出合理 JSON，无 error

- [ ] **Step 4: 记录输出（供文章使用）**

将以上命令的典型输出截图或记录，供文章第六节使用。

- [ ] **Step 5: 验证 mailbox_cli.js 的 L1 AOP hook（手动测试）**

模拟 Agent 发邮件给 human，检查 L1 目录是否新增记录：
```bash
MAILBOXES=$(pwd)/workspace/shared/mailboxes
L1=$(pwd)/workspace/shared/logs/l1_human
L1_BEFORE=$(ls $L1 | wc -l)
node workspace/manager/skills/mailbox/scripts/mailbox_cli.js send \
  --mailboxes-dir $MAILBOXES \
  --from manager --to human --type test_l1 \
  --subject "L1 hook 测试" --content "验证 AOP"
L1_AFTER=$(ls $L1 | wc -l)
echo "L1 新增：$((L1_AFTER - L1_BEFORE)) 条（期望：1）"
```

- [ ] **Step 6: Commit 验证结果**

```bash
git add -A
git commit -m "chore(demo3): end-to-end verification passed"
```

---

## Task 12: 写博客文章

**Files:**
- Create: `source/_posts/ai-agent-digital-team-3.md`

- [ ] **Step 1: 调用 write-tech-article skill**

调用：
```
Skill("write-tech-article")
```

向 skill 提供以下上下文：
- 文章标题：`简单实战一下 Multi-Agent 数字员工（三）：自我进化`
- 参考材料：`/Users/youxingzhi/ayou/blog/idea/multi-agent-digital-team-3/28-数字员工的自我进化.md`
- 系列前两篇：`source/_posts/ai-agent-digital-team-1.md`、`source/_posts/ai-agent-digital-team-2.md`
- Demo 路径：`demo/ai-agent-digital-team/`（参考 `log-ops.js`、`seed-logs.js`、`run-scheduler.js`、skill 文件）
- 文章结构（见设计文档 `docs/superpowers/specs/2026-05-06-ai-agent-digital-team-3-design.md` 第三节）
- 要求：不照抄参考材料，用 JS 代码举例，约 4000-5000 字

---

## 自检（Spec Coverage）

| 设计文档需求 | 对应 Task |
|------------|---------|
| log-ops.js 三层日志库 | Task 1 |
| log-query.js CLI（5 个子命令） | Task 2 |
| mailbox L1 AOP hook | Task 3 |
| product_design baseline | Task 4 |
| seed-logs.js（L1/L2/L3/sessions） | Task 5 |
| run-scheduler.js 双条件触发 | Task 6 |
| PM self_retrospective SKILL.md | Task 7 |
| Manager team_retrospective SKILL.md | Task 8 |
| Manager review_proposal SKILL.md | Task 8 |
| run-manager.js phase 6 | Task 9 |
| package.json seed/scheduler scripts | Task 10 |
| 端到端验证 | Task 11 |
| 博客文章 | Task 12 |
| Manager 也有 log_query CLI | Task 8 Step 3 |
| proposals/ 目录约定 | 在 seed-logs.js 运行后 scheduler 发邮件，PM Agent 自己创建 |

所有设计需求均有对应 Task。✓
