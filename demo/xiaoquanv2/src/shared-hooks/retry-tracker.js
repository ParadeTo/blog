import {DenyReason, GuardrailDeny} from '../hook-framework/registry.js'

export class RetryTracker {
  constructor(config = {}, deps = {}) {
    this.maxRetries = Number(config.maxRetries ?? 3)
    this.audit = deps.audit
    this.failures = new Map()
  }

  async afterToolHandler(ctx) {
    const key = `${ctx.sessionId}:${ctx.toolName}`
    if (ctx.success) {
      this.failures.delete(key)
      return
    }

    const count = (this.failures.get(key) || 0) + 1
    this.failures.set(key, count)
    this.audit?.recordEvent('tool_retry', {
      sessionId: ctx.sessionId,
      tool: ctx.toolName,
      count,
    })

    if (count > this.maxRetries) {
      this.audit?.recordEvent('retry_deny', {
        sessionId: ctx.sessionId,
        tool: ctx.toolName,
        count,
      })
      throw new GuardrailDeny(
        DenyReason.RETRY_EXCEEDED,
        `Retry limit exceeded for ${ctx.toolName}: ${count}`,
      )
    }
  }

  async afterTurnHandler(ctx) {
    if (!ctx.success) return
    for (const key of [...this.failures.keys()]) {
      if (key.startsWith(`${ctx.sessionId}:`)) {
        this.failures.delete(key)
      }
    }
  }
}
