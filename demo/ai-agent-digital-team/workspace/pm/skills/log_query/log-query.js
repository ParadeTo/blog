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
