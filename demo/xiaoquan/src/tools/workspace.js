/**
 * workspace.js — 共享工作区读写 + Owner 权限校验
 *
 * 对齐 Python xiaopaw-team 的 tools/workspace.py：
 * - OWNER_BY_PREFIX: needs/(manager), design/(pm), tech/+code/(rd), qa/(qa)
 * - reviews/ 独立正则校验
 * - mailboxes/ events.jsonl 禁止直接写（走专用 Tool）
 */

import fs from 'fs'
import path from 'path'
import {setTimeout as sleep} from 'timers/promises'
import {initMailboxes} from './mailbox.js'
import {initEvents} from './event-log.js'

const REVIEWS_PATTERN = /^reviews\/([a-z_]+)\/(manager|pm|rd|qa)_([a-z0-9_]+)\.md$/

const OWNER_BY_PREFIX = {
  'needs/':  new Set(['manager']),
  'design/': new Set(['pm']),
  'tech/':   new Set(['rd']),
  'code/':   new Set(['rd']),
  'qa/':     new Set(['qa']),
}

const FORBIDDEN_PREFIXES = ['mailboxes/', 'events.jsonl']

function projectRoot(workspaceRoot, projectId) {
  return path.join(workspaceRoot, 'shared', 'projects', projectId)
}

export function checkPathTraversal(relPath) {
  if (relPath.startsWith('/') || relPath.startsWith('\\'))
    throw new Error(`absolute path not allowed: ${relPath}`)
  if (relPath.split(/[/\\]/).includes('..'))
    throw new Error(`path traversal not allowed: ${relPath}`)
}

export function checkWrite(role, relPath) {
  checkPathTraversal(relPath)

  for (const fp of FORBIDDEN_PREFIXES) {
    if (relPath === fp || relPath.startsWith(fp))
      throw new Error(`${relPath} must be written via dedicated Tool (SendMail/AppendEvent)`)
  }

  if (relPath.startsWith('reviews/')) {
    const m = REVIEWS_PATTERN.exec(relPath)
    if (!m)
      throw new Error(`reviews 文件名格式错误，必须匹配 reviews/{stage}/{reviewer}_{topic}.md；got ${relPath}`)
    const [, , reviewer] = m
    if (reviewer !== role)
      throw new Error(`${role} 不能以 reviewer=${reviewer} 身份写评审文件`)
    return
  }

  for (const [prefix, owners] of Object.entries(OWNER_BY_PREFIX)) {
    if (relPath.startsWith(prefix)) {
      if (!owners.has(role))
        throw new Error(`${role} cannot write ${relPath} (owner=${[...owners]})`)
      return
    }
  }

  throw new Error(`unknown path prefix: ${relPath}`)
}

async function acquireLock(lockPath, {timeoutMs = 5000, retryMs = 20} = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { const fd = fs.openSync(lockPath, 'wx'); fs.closeSync(fd); return }
    catch { await sleep(retryMs) }
  }
  throw new Error(`lock timeout: ${lockPath}`)
}

function releaseLock(lp) { try { fs.unlinkSync(lp) } catch {} }

export async function writeShared(workspaceRoot, {projectId, role, relPath, content}) {
  checkWrite(role, relPath)
  const full = path.join(projectRoot(workspaceRoot, projectId), relPath)
  fs.mkdirSync(path.dirname(full), {recursive: true})
  const lp = full + '.lock'
  await acquireLock(lp)
  try {
    const tmp = full + '.tmp'
    fs.writeFileSync(tmp, content, 'utf-8')
    fs.renameSync(tmp, full)
  } finally { releaseLock(lp) }
}

export function readShared(workspaceRoot, {projectId, role, relPath}) {
  checkPathTraversal(relPath)
  const full = path.join(projectRoot(workspaceRoot, projectId), relPath)
  if (!fs.existsSync(full)) throw new Error(`not found: ${full}`)
  return fs.readFileSync(full, 'utf-8')
}

export function initProjectTree(workspaceRoot, {projectId}) {
  const proj = projectRoot(workspaceRoot, projectId)
  const dirs = ['needs', 'design', 'tech', 'code', 'qa', 'qa/defects', 'reviews', 'mailboxes', 'logs/l2_task']
  for (const d of dirs) fs.mkdirSync(path.join(proj, d), {recursive: true})

  initMailboxes(path.join(proj, 'mailboxes'), ['manager', 'pm', 'rd', 'qa'])
  initEvents(path.join(proj, 'events.jsonl'))
  fs.closeSync(fs.openSync(path.join(proj, 'state.lock'), 'a'))
}
