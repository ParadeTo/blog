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
  // Demo: 用 168h（7天）窗口覆盖 seed 的历史数据（seed 任务跨多天，用更长窗口）
  const count = countL2Since(LOGS_DIR, agentId, 168)
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
