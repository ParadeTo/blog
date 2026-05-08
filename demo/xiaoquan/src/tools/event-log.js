/**
 * event-log.js — append-only 事件流（JSONL），单 writer（manager）
 *
 * 对齐 Python xiaopaw-team 的 tools/event_log.py：
 * - 字段：ts / seq / actor / action / payload
 * - FileLock 保护 append（seq 单调递增）
 * - actor 固定 "manager"
 */

import fs from 'fs'
import path from 'path'
import {isoUtcNow} from './mailbox.js'
import {setTimeout as sleep} from 'timers/promises'

const VALID_ACTIONS = new Set([
  'project_created', 'archived',
  'requirements_discovery_started', 'requirements_coverage_assessed', 'requirements_drafted',
  'checkpoint_requested', 'checkpoint_reply_classified', 'checkpoint_approved', 'checkpoint_rejected',
  'assigned', 'task_done_received', 'revision_requested', 'rd_delivered',
  'review_criteria_checked', 'decided_insert_review', 'review_requested', 'review_received',
  'delivery_requested', 'delivered',
  'retro_triggered', 'retro_report_received', 'retro_proposal_invalid',
  'retro_approved_by_manager', 'retro_approved_by_human', 'retro_rejected_by_human',
  'retro_apply_failed', 'task_quality_adjusted', 'evolved',
  'error_alert_raised', 'recovered_checkpoint_response',
  'info_sent', 'checkpoint_request_sent', 'proposal_review_sent',
  'delivery_sent', 'evolution_report_sent', 'error_alert_sent',
])

function isValidAction(action) {
  if (VALID_ACTIONS.has(action)) return true
  if (action.startsWith('retro_applied_by_')) {
    const role = action.slice('retro_applied_by_'.length)
    return ['manager', 'pm', 'rd', 'qa'].includes(role)
  }
  return false
}

async function acquireLock(lockPath, {timeoutMs = 5000, retryMs = 20} = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { const fd = fs.openSync(lockPath, 'wx'); fs.closeSync(fd); return }
    catch { await sleep(retryMs) }
  }
  throw new Error(`lock timeout: ${lockPath}`)
}

function releaseLock(lockPath) { try { fs.unlinkSync(lockPath) } catch {} }

function lastSeq(eventsPath) {
  if (!fs.existsSync(eventsPath)) return 0
  const content = fs.readFileSync(eventsPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return Number(JSON.parse(lines[i]).seq) || 0 }
    catch { continue }
  }
  return 0
}

export function initEvents(eventsPath) {
  fs.mkdirSync(path.dirname(eventsPath), {recursive: true})
  if (!fs.existsSync(eventsPath)) fs.writeFileSync(eventsPath, '', 'utf-8')
}

export async function appendEvent(eventsPath, {action, payload, actor = 'manager'}) {
  if (!isValidAction(action)) throw new Error(`unknown action: ${action}`)
  if (actor !== 'manager') throw new Error(`actor must be 'manager'; got ${actor}`)

  fs.mkdirSync(path.dirname(eventsPath), {recursive: true})
  const lp = eventsPath + '.lock'
  await acquireLock(lp)
  try {
    const seq = lastSeq(eventsPath) + 1
    const entry = {ts: isoUtcNow(), seq, actor, action, payload}
    fs.appendFileSync(eventsPath, JSON.stringify(entry) + '\n', 'utf-8')
    return seq
  } finally { releaseLock(lp) }
}

export function readEvents(eventsPath) {
  if (!fs.existsSync(eventsPath)) return []
  return fs.readFileSync(eventsPath, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .flatMap(l => { try { return [JSON.parse(l)] } catch { return [] } })
}

export function tailEvents(eventsPath, {n}) {
  const all = readEvents(eventsPath)
  return n < all.length ? all.slice(-n) : all
}
