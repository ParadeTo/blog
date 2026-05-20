/**
 * mailbox.js — 团队内文件邮箱：三态状态机（unread → in_progress → done）
 *
 * 对齐 Python xiaopaw-team 的 tools/mailbox.py：
 * - 位置：workspace/shared/projects/{pid}/mailboxes/{role}.json
 * - 锁：fs.open(lockPath, 'wx') retry（进程间安全）
 * - id 格式：msg-{8hex}
 */

import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'
import {setTimeout as sleep} from 'timers/promises'

export const VALID_ROLES = new Set(['manager', 'pm', 'rd', 'qa'])
export const VALID_FROM_EXTRA = new Set(['human', 'feishu_bridge'])
export const VALID_TYPES = new Set([
  'task_assign', 'task_done', 'review_request', 'review_done',
  'clarification_request', 'clarification_answer',
  'error_alert', 'checkpoint_response',
  'retro_trigger', 'retro_report',
  'retro_approved', 'retro_rejected',
  'retro_applied', 'retro_apply_failed',
])

export function isoUtcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function inboxPath(mailboxDir, role) { return path.join(mailboxDir, `${role}.json`) }
function lockFilePath(mailboxDir, role) { return path.join(mailboxDir, `${role}.json.lock`) }

async function acquireLock(lockPath, {timeoutMs = 5000, retryMs = 20} = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { const fd = fs.openSync(lockPath, 'wx'); fs.closeSync(fd); return }
    catch { await sleep(retryMs) }
  }
  throw new Error(`lock timeout: ${lockPath}`)
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath) } catch {}
}

export function initMailboxes(mailboxDir, roles) {
  fs.mkdirSync(mailboxDir, {recursive: true})
  for (const role of roles) {
    const p = inboxPath(mailboxDir, role)
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf-8')
  }
}

export async function sendMail(mailboxDir, {to, from: from_, type, subject, content, projectId}) {
  if (!VALID_ROLES.has(to)) throw new Error(`invalid recipient role: ${to}`)
  if (!VALID_ROLES.has(from_) && !VALID_FROM_EXTRA.has(from_))
    throw new Error(`invalid sender: ${from_}`)
  if (!VALID_TYPES.has(type)) throw new Error(`invalid type: ${type}`)

  const inbox = inboxPath(mailboxDir, to)
  if (!fs.existsSync(inbox)) throw new Error(`mailbox not initialized: ${inbox}`)

  const msgId = 'msg-' + randomBytes(4).toString('hex')
  const msg = {
    id: msgId, projectId, from: from_, to, type, subject, content,
    timestamp: isoUtcNow(), status: 'unread', processingSince: null,
  }

  const lp = lockFilePath(mailboxDir, to)
  await acquireLock(lp)
  try {
    const messages = JSON.parse(fs.readFileSync(inbox, 'utf-8') || '[]')
    messages.push(msg)
    fs.writeFileSync(inbox, JSON.stringify(messages, null, 2), 'utf-8')
  } finally { releaseLock(lp) }

  return msgId
}

export async function readInbox(mailboxDir, {role, staleTimeoutSec = 300}) {
  if (!VALID_ROLES.has(role)) throw new Error(`invalid role: ${role}`)
  const inbox = inboxPath(mailboxDir, role)
  if (!fs.existsSync(inbox)) throw new Error(`mailbox not initialized: ${inbox}`)

  const snapshot = []
  const lp = lockFilePath(mailboxDir, role)
  await acquireLock(lp)
  try {
    const messages = JSON.parse(fs.readFileSync(inbox, 'utf-8') || '[]')
    const now = isoUtcNow()
    const nowMs = Date.now()
    let changed = false
    for (const m of messages) {
      // auto-reset stale in_progress messages so they can be reprocessed
      if (m.status === 'in_progress' && m.processingSince) {
        const ageSec = (nowMs - new Date(m.processingSince).getTime()) / 1000
        if (ageSec > staleTimeoutSec) {
          m.status = 'unread'
          m.processingSince = null
          changed = true
        }
      }
      if (m.status === 'unread') {
        m.status = 'in_progress'
        m.processingSince = now
        snapshot.push({...m})
        changed = true
      }
    }
    if (changed) fs.writeFileSync(inbox, JSON.stringify(messages, null, 2), 'utf-8')
  } finally { releaseLock(lp) }

  return snapshot
}

export async function markDone(mailboxDir, {role, msgId}) {
  if (!VALID_ROLES.has(role)) throw new Error(`invalid role: ${role}`)
  const inbox = inboxPath(mailboxDir, role)
  const lp = lockFilePath(mailboxDir, role)
  await acquireLock(lp)
  try {
    const messages = JSON.parse(fs.readFileSync(inbox, 'utf-8') || '[]')
    const target = messages.find(m => m.id === msgId)
    if (!target) throw new Error(`msg not found: ${msgId}`)
    if (target.status !== 'in_progress')
      throw new Error(`msg ${msgId} is not in_progress (current=${target.status})`)
    target.status = 'done'
    fs.writeFileSync(inbox, JSON.stringify(messages, null, 2), 'utf-8')
  } finally { releaseLock(lp) }
}

export async function resetStale(mailboxDir, {role, timeoutSec}) {
  if (!VALID_ROLES.has(role)) throw new Error(`invalid role: ${role}`)
  const inbox = inboxPath(mailboxDir, role)
  const lp = lockFilePath(mailboxDir, role)
  let resetCount = 0
  await acquireLock(lp)
  try {
    const messages = JSON.parse(fs.readFileSync(inbox, 'utf-8') || '[]')
    const now = Date.now()
    for (const m of messages) {
      if (m.status !== 'in_progress' || !m.processingSince) continue
      const ageSec = (now - new Date(m.processingSince).getTime()) / 1000
      if (ageSec > timeoutSec) { m.status = 'unread'; m.processingSince = null; resetCount++ }
    }
    if (resetCount > 0) fs.writeFileSync(inbox, JSON.stringify(messages, null, 2), 'utf-8')
  } finally { releaseLock(lp) }
  return resetCount
}
