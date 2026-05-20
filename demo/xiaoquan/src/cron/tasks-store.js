/**
 * tasks-store.js — cron/tasks.json 原子读写 API
 *
 * 对齐 Python xiaopaw-team 的 tasks_store.py：
 * - write-then-rename 原子写入，CronService 通过 mtime 检测热重载
 * - scheduleWake: 去重（同 routingKey+message 的未到期 at job 复用）
 * - 锁：用 fs.open(lockPath, 'wx') 实现进程间文件锁（retry）
 */

import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'
import {setTimeout as sleep} from 'timers/promises'

function nowMs() {
  return Date.now()
}

function genJobId() {
  return 'job-' + randomBytes(4).toString('hex')
}

function lockPath(tasksPath) {
  return tasksPath + '.lock'
}

async function acquireLock(tasksPath, {timeoutMs = 5000, retryMs = 20} = {}) {
  fs.mkdirSync(path.dirname(tasksPath), {recursive: true})
  const lp = lockPath(tasksPath)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lp, 'wx')
      fs.closeSync(fd)
      return true
    } catch {
      await sleep(retryMs)
    }
  }
  throw new Error(`Could not acquire lock on ${lp} after ${timeoutMs}ms`)
}

function releaseLock(tasksPath) {
  try { fs.unlinkSync(lockPath(tasksPath)) } catch {}
}

function loadStore(tasksPath) {
  if (!fs.existsSync(tasksPath)) return {version: 1, jobs: []}
  try {
    const raw = fs.readFileSync(tasksPath, 'utf-8') || '{"version":1,"jobs":[]}'
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return {version: 1, jobs: data}
    return {version: Number(data.version || 1), jobs: Array.isArray(data.jobs) ? data.jobs : []}
  } catch {
    return {version: 1, jobs: []}
  }
}

function dumpStore(tasksPath, store) {
  const dir = path.dirname(tasksPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true})
  const tmp = tasksPath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
  fs.renameSync(tmp, tasksPath)
}

export async function createJob(tasksPath, {
  name,
  routingKey,
  message,
  scheduleKind = 'at',
  atMs = null,
  everyMs = null,
  expr = null,
  tz = null,
  deleteAfterRun = true,
} = {}) {
  if (!['at', 'every', 'cron'].includes(scheduleKind)) throw new Error(`invalid scheduleKind: ${scheduleKind}`)
  if (scheduleKind === 'at' && atMs == null) atMs = nowMs() + 1000
  if (scheduleKind === 'every' && everyMs == null) throw new Error('everyMs required for every')
  if (scheduleKind === 'cron' && !expr) throw new Error('expr required for cron')

  await acquireLock(tasksPath)
  try {
    const store = loadStore(tasksPath)
    const now = nowMs()
    const jobId = genJobId()
    store.jobs.push({
      id: jobId,
      name,
      enabled: true,
      schedule: {kind: scheduleKind, atMs: scheduleKind === 'at' ? atMs : null,
        everyMs: scheduleKind === 'every' ? everyMs : null,
        expr: scheduleKind === 'cron' ? expr : null, tz: scheduleKind === 'cron' ? tz : null},
      payload: {routingKey, message},
      state: {nextRunAtMs: null, lastRunAtMs: null, lastStatus: null, lastError: null},
      createdAtMs: now,
      updatedAtMs: now,
      deleteAfterRun: Boolean(deleteAfterRun),
    })
    dumpStore(tasksPath, store)
    return jobId
  } finally {
    releaseLock(tasksPath)
  }
}

export async function scheduleWake(tasksPath, {role, reason = 'new_mail', delayMs = 1000, projectId = ''} = {}) {
  const tag = projectId ? `:${projectId}` : ''
  const targetMsg = `__wake__:${reason}${tag}`
  const targetRk = `team:${role}`

  // 去重：查找同 routingKey+message 且未到期的 at job
  await acquireLock(tasksPath)
  try {
    const now = nowMs()
    const store = loadStore(tasksPath)
    for (const j of store.jobs) {
      if (j.payload?.routingKey === targetRk &&
          j.payload?.message === targetMsg &&
          j.schedule?.kind === 'at' &&
          j.deleteAfterRun &&
          (j.schedule?.atMs || 0) > now) {
        return j.id  // 复用已有 pending wake
      }
    }
    // 无重复，创建新 job
    const jobId = genJobId()
    const now2 = nowMs()
    store.jobs.push({
      id: jobId,
      name: `wake-${role}-${reason}-${now2}`,
      enabled: true,
      schedule: {kind: 'at', atMs: now2 + delayMs, everyMs: null, expr: null, tz: null},
      payload: {routingKey: targetRk, message: targetMsg},
      state: {nextRunAtMs: null, lastRunAtMs: null, lastStatus: null, lastError: null},
      createdAtMs: now2,
      updatedAtMs: now2,
      deleteAfterRun: true,
    })
    dumpStore(tasksPath, store)
    return jobId
  } finally {
    releaseLock(tasksPath)
  }
}

export function listJobs(tasksPath) {
  return loadStore(tasksPath).jobs
}

export async function deleteJob(tasksPath, {jobId}) {
  await acquireLock(tasksPath)
  try {
    const store = loadStore(tasksPath)
    const before = store.jobs.length
    store.jobs = store.jobs.filter(j => j.id !== jobId)
    if (store.jobs.length === before) return false
    dumpStore(tasksPath, store)
    return true
  } finally {
    releaseLock(tasksPath)
  }
}
