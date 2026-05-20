import crypto from 'crypto'
import {DenyReason, GuardrailDeny} from '../hook-framework/registry.js'

function hash(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex')
}

export class LoopDetector {
  constructor(config = {}) {
    this.threshold = Number(config.threshold ?? 3)
    this.state = new Map()
  }

  async afterToolHandler(ctx) {
    this._record(ctx.sessionId, `${ctx.toolName}:${hash(ctx.metadata.result)}`)
  }

  async afterTurnHandler(ctx) {
    if (ctx.metadata.reply == null) return
    this._record(ctx.sessionId, `reply:${hash(ctx.metadata.reply)}`)
  }

  _record(sessionId, value) {
    const prev = this.state.get(sessionId) || {value: '', count: 0}
    const next = prev.value === value ? {value, count: prev.count + 1} : {value, count: 1}
    this.state.set(sessionId, next)

    if (next.count >= this.threshold) {
      throw new GuardrailDeny(
        DenyReason.LOOP_DETECTED,
        `Repeated output detected ${next.count} times`,
      )
    }
  }
}
