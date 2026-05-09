/**
 * service.js — CronService：读 cron/tasks.json，精确调度定时任务
 *
 * 对齐 Python xiaopaw-team 的 cron/service.py：
 * - at：一次性触发，deleteAfterRun=true 则删除
 * - every：固定间隔，触发后 nextRunAtMs = firedAtMs + everyMs
 * - mtime+size 热重载
 * - 触发时构造 InboundMessage 进入 Runner 管道
 */

import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'

function nowMs() { return Date.now() }

function genMsgId() { return 'cron_' + randomBytes(6).toString('hex') }

function parseWakeReason(message) {
  if (!message || !message.startsWith('__wake__:')) return null
  const rest = message.slice('__wake__:'.length)
  const colonIdx = rest.indexOf(':')
  return colonIdx === -1 ? rest : rest.slice(0, colonIdx)
}

export class CronService {
  constructor({dataDir, dispatchFn, tickIntervalMs = 50} = {}) {
    this._dataDir = dataDir
    this._dispatchFn = dispatchFn
    this._tickIntervalMs = tickIntervalMs
    this._tasksPath = path.join(dataDir, 'cron', 'tasks.json')
    this._lastMtime = 0
    this._lastSize = -1
    this._timer = null
    this._running = false
    this.jobs = []
    this._disabledJobsRaw = []
  }

  async start() {
    this._loadStore()
    this._running = true
    this._ticking = false
    this._timer = setInterval(() => {
      if (this._ticking) return
      this._ticking = true
      this._tick().catch(e => {
        console.error('[CronService] tick error:', e.message)
      }).finally(() => { this._ticking = false })
    }, this._tickIntervalMs)
  }

  async stop() {
    this._running = false
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  }

  async _tick() {
    if (!this._running) return
    if (this._checkMtime()) this._loadStore()

    const now = nowMs()
    const firedIds = []

    for (const job of this.jobs) {
      if (job.state.nextRunAtMs != null && job.state.nextRunAtMs <= now) {
        await this._fire(job)
        firedIds.push(job.id)
      }
    }

    if (firedIds.length > 0) {
      this._postFire(firedIds, now)
      this._saveStore()
    }
  }

  async _fire(job) {
    const msgId = genMsgId()
    const ts = nowMs()
    const wakeReason = parseWakeReason(job.payload.message)

    const inbound = {
      routingKey: job.payload.routingKey,
      content: job.payload.message,
      msgId,
      rootId: msgId,
      senderId: 'cron',
      ts,
      isCron: true,
      attachment: null,
      meta: wakeReason ? {wakeReason} : {},
    }

    try {
      await this._dispatchFn(inbound)
      job.state.lastStatus = 'ok'
      job.state.lastError = null
    } catch (e) {
      job.state.lastStatus = 'error'
      job.state.lastError = e.message
      console.error(`[CronService] fire error job=${job.id}:`, e.message)
    }
    job.state.lastRunAtMs = ts
  }

  _postFire(firedIds, firedAtMs) {
    const toRemove = new Set()
    for (const job of this.jobs) {
      if (!firedIds.includes(job.id)) continue
      if (job.schedule.kind === 'at') {
        if (job.deleteAfterRun) { toRemove.add(job.id) }
        else { job.enabled = false; job.state.nextRunAtMs = null }
      } else if (job.schedule.kind === 'every' && job.schedule.everyMs) {
        job.state.nextRunAtMs = firedAtMs + job.schedule.everyMs
      }
      // cron kind: 暂不支持，可扩展
    }
    this.jobs = this.jobs.filter(j => !toRemove.has(j.id))
  }

  _loadStore() {
    if (!fs.existsSync(this._tasksPath)) {
      this.jobs = []; this._disabledJobsRaw = []
      this._lastMtime = 0; this._lastSize = -1
      return
    }
    try {
      const st = fs.statSync(this._tasksPath)
      this._lastMtime = st.mtimeMs
      this._lastSize = st.size
      const raw = fs.readFileSync(this._tasksPath, 'utf-8')
      const data = JSON.parse(raw || '{"version":1,"jobs":[]}')
      const jobsRaw = Array.isArray(data) ? data : (data.jobs || [])

      this.jobs = []
      this._disabledJobsRaw = []
      const now = nowMs()

      for (const r of jobsRaw) {
        if (!r.enabled) { this._disabledJobsRaw.push(r); continue }
        const job = {...r}
        // 补全 nextRunAtMs
        if (job.state.nextRunAtMs == null) {
          if (job.schedule.kind === 'at' && job.schedule.atMs != null)
            job.state.nextRunAtMs = job.schedule.atMs
          else if (job.schedule.kind === 'every' && job.schedule.everyMs != null)
            job.state.nextRunAtMs = now + job.schedule.everyMs
        }
        this.jobs.push(job)
      }
    } catch (e) {
      console.error('[CronService] load error:', e.message)
      this.jobs = []
    }
  }

  _checkMtime() {
    if (!fs.existsSync(this._tasksPath)) return this._lastMtime !== 0
    try {
      const st = fs.statSync(this._tasksPath)
      return st.mtimeMs !== this._lastMtime || st.size !== this._lastSize
    } catch { return false }
  }

  _saveStore() {
    const enabledRaw = this.jobs.map(j => ({
      id: j.id, name: j.name, enabled: j.enabled,
      schedule: j.schedule, payload: j.payload, state: j.state,
      createdAtMs: j.createdAtMs, updatedAtMs: j.updatedAtMs,
      deleteAfterRun: j.deleteAfterRun,
    }))
    const output = {version: 1, jobs: [...enabledRaw, ...this._disabledJobsRaw]}
    const tmp = this._tasksPath + '.tmp'
    fs.mkdirSync(path.dirname(this._tasksPath), {recursive: true})
    fs.writeFileSync(tmp, JSON.stringify(output, null, 2), 'utf-8')
    fs.renameSync(tmp, this._tasksPath)
    const st = fs.statSync(this._tasksPath)
    this._lastMtime = st.mtimeMs
    this._lastSize = st.size
  }
}
