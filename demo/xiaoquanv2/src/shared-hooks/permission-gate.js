import {DenyReason, GuardrailDeny} from '../hook-framework/registry.js'

export class PermissionGate {
  constructor(config = {}, deps = {}) {
    this.tools = Object.fromEntries(
      Object.entries(config.tools || {}).map(([name, value]) => [
        name.toLowerCase(),
        String(value).toLowerCase(),
      ]),
    )
    this.default = String(config.default || 'warn').toLowerCase()
    this.audit = deps.audit
    this.decisions = []
  }

  async beforeToolHandler(ctx) {
    const tool = String(ctx.toolName || '').toLowerCase()
    const permission = this.tools[tool] || this.default
    const decision = {
      tool: ctx.toolName,
      permission,
      senderId: ctx.senderId,
      sessionId: ctx.sessionId,
    }
    this.decisions.push(decision)

    if (permission === 'deny') {
      this.audit?.recordEvent('permission_deny', decision)
      throw new GuardrailDeny(
        DenyReason.PERMISSION_DENIED,
        `Permission denied for tool: ${ctx.toolName}`,
      )
    }
    if (permission === 'warn') {
      this.audit?.recordEvent('permission_warn', decision)
    }
  }
}
