import {DenyReason, GuardrailDeny} from '../hook-framework/registry.js'

function normalizeText(value) {
  let text = String(value ?? '').normalize('NFKC')
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(text)
      if (decoded === text) break
      text = decoded
    } catch {
      break
    }
  }
  return text
}

function flatten(input) {
  if (input == null) return []
  if (typeof input === 'string') return [input]
  if (Array.isArray(input)) return input.flatMap(flatten)
  if (typeof input === 'object') return Object.values(input).flatMap(flatten)
  return [String(input)]
}

export class SandboxGuard {
  constructor(config = {}, deps = {}) {
    this.audit = deps.audit
    this.pathTraversal = /(^|[/\\])\.\.([/\\]|$)/
    this.dangerous = /(rm\s+-rf|sudo\b|chmod\s+777|curl\b[^\n|;]*\|\s*sh|eval\s*\(|exec\s*\(|`|\$\(|&&|;|\|)/i
    this.promptInjection = /(\[SYSTEM\]|ignore previous instructions|忽略以上指令|忽略之前的指令)/i
  }

  async beforeToolHandler(ctx) {
    const texts = flatten(ctx.toolInput).map(normalizeText)

    for (const text of texts) {
      if (this.pathTraversal.test(text)) {
        this._deny(ctx, DenyReason.SANDBOX_VIOLATION, `path traversal: ${text}`)
      }
      if (this.dangerous.test(text)) {
        this._deny(ctx, DenyReason.SANDBOX_VIOLATION, `dangerous input: ${text}`)
      }
      if (this.promptInjection.test(text)) {
        this._deny(ctx, DenyReason.PROMPT_INJECTION, `prompt injection: ${text}`)
      }
    }
  }

  _deny(ctx, reasonCode, detail) {
    this.audit?.recordEvent('sandbox_deny', {
      sessionId: ctx.sessionId,
      tool: ctx.toolName,
      reasonCode,
      detail,
    })
    throw new GuardrailDeny(reasonCode, detail)
  }
}
