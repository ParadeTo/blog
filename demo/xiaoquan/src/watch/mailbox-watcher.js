import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'

const DEFAULT_ROLES = ['manager', 'pm', 'rd', 'qa']

function nowMs() {
  return Date.now()
}

function genMsgId() {
  return 'mailbox_' + randomBytes(6).toString('hex')
}

function safeReadJson(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]')
  } catch {
    return fallback
  }
}

function unreadSignature(messages) {
  return messages
    .filter(m => m && m.status === 'unread')
    .map(m => m.id || `${m.timestamp || ''}:${m.subject || ''}`)
    .sort()
    .join('|')
}

export class MailboxWatcher {
  constructor({workspaceRoot, dispatchFn, roles = DEFAULT_ROLES, debounceMs = 120} = {}) {
    this._workspaceRoot = workspaceRoot
    this._dispatchFn = dispatchFn
    this._roles = roles
    this._debounceMs = debounceMs
    this._projectsDir = path.join(workspaceRoot, 'shared', 'projects')
    this._watchers = new Map()
    this._timers = new Map()
    this._lastUnread = new Map()
    this._running = false
  }

  async start() {
    fs.mkdirSync(this._projectsDir, {recursive: true})
    this._running = true
    this._watchDir('projects', this._projectsDir, () => this._scheduleScanProjects())
    await this.scanNow()
  }

  async stop() {
    this._running = false
    for (const timer of this._timers.values()) clearTimeout(timer)
    this._timers.clear()
    for (const watcher of this._watchers.values()) {
      try { watcher.close() } catch {}
    }
    this._watchers.clear()
  }

  async scanNow() {
    await this._scanProjects()
  }

  _watchDir(key, dirPath, onEvent) {
    if (!this._running || this._watchers.has(key) || !fs.existsSync(dirPath)) return
    try {
      const watcher = fs.watch(dirPath, {persistent: true}, (_eventType, filename) => {
        if (filename && String(filename).endsWith('.lock')) return
        onEvent(filename ? String(filename) : '')
      })
      watcher.on('error', e => {
        console.warn(`[MailboxWatcher] watch error key=${key}:`, e.message)
        this._watchers.delete(key)
      })
      this._watchers.set(key, watcher)
    } catch (e) {
      console.warn(`[MailboxWatcher] cannot watch ${dirPath}:`, e.message)
    }
  }

  _schedule(key, fn) {
    if (!this._running) return
    const oldTimer = this._timers.get(key)
    if (oldTimer) clearTimeout(oldTimer)
    const timer = setTimeout(() => {
      this._timers.delete(key)
      fn().catch(e => console.error(`[MailboxWatcher] ${key} error:`, e.message))
    }, this._debounceMs)
    this._timers.set(key, timer)
  }

  _scheduleScanProjects() {
    this._schedule('scan-projects', () => this._scanProjects())
  }

  _scheduleScanProject(projectId) {
    this._schedule(`scan-project:${projectId}`, () => this._scanProject(projectId))
  }

  _scheduleCheckMailbox(projectId, role) {
    this._schedule(`mailbox:${projectId}:${role}`, () => this._checkMailbox(projectId, role))
  }

  async _scanProjects() {
    if (!this._running || !fs.existsSync(this._projectsDir)) return
    const entries = fs.readdirSync(this._projectsDir, {withFileTypes: true})
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      await this._scanProject(entry.name)
    }
  }

  async _scanProject(projectId) {
    if (!this._running) return
    const projectDir = path.join(this._projectsDir, projectId)
    if (!fs.existsSync(projectDir)) return

    this._watchDir(`project:${projectId}`, projectDir, () => this._scheduleScanProject(projectId))

    const mailboxesDir = path.join(projectDir, 'mailboxes')
    if (!fs.existsSync(mailboxesDir)) return

    this._watchDir(`mailboxes:${projectId}`, mailboxesDir, (filename) => {
      if (!filename || !filename.endsWith('.json')) {
        this._roles.forEach(role => this._scheduleCheckMailbox(projectId, role))
        return
      }
      const role = filename.slice(0, -'.json'.length)
      if (this._roles.includes(role)) this._scheduleCheckMailbox(projectId, role)
    })

    for (const role of this._roles) {
      await this._checkMailbox(projectId, role)
    }
  }

  async _checkMailbox(projectId, role) {
    if (!this._running) return
    const inboxPath = path.join(this._projectsDir, projectId, 'mailboxes', `${role}.json`)
    const messages = safeReadJson(inboxPath, [])
    const sig = unreadSignature(messages)
    const key = `${projectId}:${role}`
    const prev = this._lastUnread.get(key) || ''
    this._lastUnread.set(key, sig)

    if (!sig || sig === prev) return

    const unreadMsgIds = sig.split('|').filter(Boolean)
    const msgId = genMsgId()
    const inbound = {
      routingKey: `team:${role}`,
      content: `__wake__:new_mail:${projectId}`,
      msgId,
      rootId: msgId,
      senderId: 'mailbox-watcher',
      ts: nowMs(),
      isCron: false,
      attachment: null,
      meta: {wakeReason: 'new_mail', projectId, role, unreadMsgIds},
    }

    console.log(`[MailboxWatcher] wake role=${role} project=${projectId} unread=${unreadMsgIds.length}`)
    await this._dispatchFn(inbound)
  }
}
