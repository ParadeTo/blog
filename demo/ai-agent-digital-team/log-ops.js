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
