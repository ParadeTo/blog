/**
 * feishu-bridge.js — 飞书单一接口 + Checkpoint 跟踪 + 消息分类
 *
 * 对齐 Python xiaopaw-team 的 tools/feishu_bridge.py：
 * - CheckpointStore：JSONL 持久化 pending checkpoints
 * - classify()：5 类分流（checkpoint_response / new_requirement / sop_cocreate / clarification_answer / need_discussion）
 */

import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'
import {setTimeout as sleep} from 'timers/promises'

function nowMs() { return Date.now() }
function genCkptId() { return 'ckpt-' + randomBytes(4).toString('hex') }

async function acquireLock(lockPath, {timeoutMs = 5000, retryMs = 20} = {}) {
  fs.mkdirSync(path.dirname(lockPath), {recursive: true})
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { const fd = fs.openSync(lockPath, 'wx'); fs.closeSync(fd); return }
    catch { await sleep(retryMs) }
  }
  throw new Error(`lock timeout: ${lockPath}`)
}

function releaseLock(lp) { try { fs.unlinkSync(lp) } catch {} }

export class CheckpointStore {
  constructor({dataDir}) {
    this._path = path.join(dataDir, 'feishu_bridge', 'pending.jsonl')
    this._lockPath = this._path + '.lock'
  }

  _ensure() {
    fs.mkdirSync(path.dirname(this._path), {recursive: true})
    if (!fs.existsSync(this._path)) fs.writeFileSync(this._path, '', 'utf-8')
  }

  _readAll() {
    this._ensure()
    const resolvedIds = new Set()
    const rawEntries = []
    const lines = fs.readFileSync(this._path, 'utf-8').split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const d = JSON.parse(line)
        if (d.resolved_at_ms && d.checkpoint_id && !d.routing_key) {
          resolvedIds.add(d.checkpoint_id)
          continue
        }
        rawEntries.push(d)
      } catch {}
    }
    return rawEntries
      .filter(d => d.checkpoint_id && !resolvedIds.has(d.checkpoint_id))
      .map(d => ({
        checkpointId: d.checkpoint_id,
        routingKey: d.routing_key,
        projectId: d.project_id || '',
        kind: d.kind || 'checkpoint_request',
        question: d.question || '',
        createdAtMs: Number(d.created_at_ms || 0),
      }))
  }

  async register({routingKey, projectId, kind, question, checkpointId}) {
    const cid = checkpointId || genCkptId()
    const entry = {
      checkpoint_id: cid, routing_key: routingKey, project_id: projectId,
      kind, question, created_at_ms: nowMs(), resolved_at_ms: null,
    }
    await acquireLock(this._lockPath)
    try {
      this._ensure()
      const existing = this._readAll().find(d => d.checkpointId === cid && d.routingKey === routingKey)
      if (existing) return cid
      fs.appendFileSync(this._path, JSON.stringify(entry) + '\n', 'utf-8')
    } finally { releaseLock(this._lockPath) }
    return cid
  }

  async pending() {
    await acquireLock(this._lockPath)
    try { return this._readAll() }
    finally { releaseLock(this._lockPath) }
  }

  async pendingForRoutingKey(routingKey) {
    const all = await this.pending()
    return all.filter(c => c.routingKey === routingKey)
  }

  async resolve(checkpointId) {
    await acquireLock(this._lockPath)
    try {
      this._ensure()
      const lines = fs.readFileSync(this._path, 'utf-8').split('\n').filter(l => l.trim())
      let hasRegistered = false
      let alreadyResolved = false
      for (const line of lines) {
        try {
          const d = JSON.parse(line)
          if (d.checkpoint_id !== checkpointId) continue
          if (d.resolved_at_ms && !d.routing_key) { alreadyResolved = true }
          else if (d.routing_key) { hasRegistered = true }
        } catch {}
      }
      if (alreadyResolved || !hasRegistered) return false
      fs.appendFileSync(this._path,
        JSON.stringify({checkpoint_id: checkpointId, resolved_at_ms: nowMs()}) + '\n', 'utf-8')
      return true
    } finally { releaseLock(this._lockPath) }
  }
}

const NEW_REQ_KEYWORDS = [
  '帮我做', '做一个', '帮我写', '搭一个', '搭个', '实现', '开发一个', '建一个',
  '构建', '需求', '新项目', '新需求', 'build', 'create', 'implement', 'new project', 'new feature',
]
const SOP_KEYWORDS = ['sop', '流程', '标准', '工作流', '规范', 'workflow']
const CLARIFICATION_KEYWORDS = ['答复', '回答', '澄清', '答案', 'answer']
const DECISION_TOKENS = ['同意', '批准', 'approve', 'yes', '确认', 'ok', '接受', '接受默认', '默认', '拒绝', '不同意', 'reject', 'no']

function matchKeywords(text, keywords) {
  const t = text.toLowerCase()
  return keywords.some(kw => t.includes(kw.toLowerCase()))
}

function isDecisionReply(text) {
  // TODO: replace the growing regex fallback with a lightweight LLM classifier
  // for ambiguous checkpoint replies; keep explicit checkpoint IDs and simple
  // approve/reject tokens on the deterministic fast path.
  const stripped = (text || '').trim()
  const lower = stripped.toLowerCase()
  if (/^(选\s*)?[12]$/.test(stripped)) return true
  if (/^[a-f]$/i.test(stripped)) return true
  if (/^(?:\d+\s*[a-f](?:\s+|$)){2,}$/i.test(stripped)) return true
  return DECISION_TOKENS.some(tok => lower.includes(tok.toLowerCase()))
}

/**
 * classify(text, {callbackValue, pendingForRk})
 * @returns {[string, string|null]} [category, checkpointId]
 */
export function classify(text, {callbackValue = null, pendingForRk = []} = {}) {
  // 1. 飞书卡片 callback 最优先
  if (callbackValue && callbackValue.checkpoint_id)
    return ['checkpoint_response', callbackValue.checkpoint_id]

  const stripped = (text || '').trim()
  if (!stripped) return ['need_discussion', null]

  // 2. 文本匹配显式 checkpoint_id（格式 ckpt-xxxx）
  const ckptMatch = /ckpt-[0-9a-f]{8}/.exec(stripped)
  if (ckptMatch && pendingForRk.some(c => c.checkpointId === ckptMatch[0]))
    return ['checkpoint_response', ckptMatch[0]]
  const explicitPending = pendingForRk.find(c => c.checkpointId && stripped.includes(c.checkpointId))
  if (explicitPending) return ['checkpoint_response', explicitPending.checkpointId]

  // 3. 有 pending，用户直接给决策词
  if (pendingForRk.length > 0) {
    const latest = pendingForRk.reduce((a, b) => a.createdAtMs > b.createdAtMs ? a : b)
    if (isDecisionReply(stripped))
      return ['checkpoint_response', latest.checkpointId]
  }

  // 4. 关键词分类
  if (matchKeywords(stripped, SOP_KEYWORDS)) return ['sop_cocreate', null]
  if (matchKeywords(stripped, NEW_REQ_KEYWORDS)) return ['new_requirement', null]
  if (matchKeywords(stripped, CLARIFICATION_KEYWORDS)) return ['clarification_answer', null]

  return ['need_discussion', null]
}
