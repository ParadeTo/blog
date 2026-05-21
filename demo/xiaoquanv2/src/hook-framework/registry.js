export const EventType = Object.freeze({
  BEFORE_TURN: 'BEFORE_TURN',
  BEFORE_LLM: 'BEFORE_LLM',
  BEFORE_TOOL_CALL: 'BEFORE_TOOL_CALL',
  AFTER_TOOL_CALL: 'AFTER_TOOL_CALL',
  AFTER_TURN: 'AFTER_TURN',
  TASK_COMPLETE: 'TASK_COMPLETE',
  SESSION_END: 'SESSION_END',
})

export const DenyReason = Object.freeze({
  BUDGET_EXCEEDED: 'budget_exceeded',
  LOOP_DETECTED: 'loop_detected',
  SANDBOX_VIOLATION: 'sandbox_violation',
  PERMISSION_DENIED: 'permission_denied',
  PROMPT_INJECTION: 'prompt_injection',
  RETRY_EXCEEDED: 'retry_exceeded',
  HOOK_FAILURE: 'hook_failure',
})

export class GuardrailDeny extends Error {
  constructor(reasonCode, detail = '', options = {}) {
    super(detail || reasonCode)
    this.name = 'GuardrailDeny'
    this.reasonCode = reasonCode
    this.detail = detail
    this.metadata = Object.freeze({...options.metadata})
  }
}

export function createHookContext(input) {
  return Object.freeze({
    eventType: input.eventType,
    timestamp: input.timestamp || new Date().toISOString(),
    agentId: input.agentId || '',
    taskName: input.taskName || '',
    toolName: input.toolName || '',
    toolInput: Object.freeze({...input.toolInput}),
    inputTokens: input.inputTokens || 0,
    outputTokens: input.outputTokens || 0,
    durationMs: input.durationMs || 0,
    success: input.success !== false,
    sessionId: input.sessionId || '',
    turnNumber: input.turnNumber || 0,
    senderId: input.senderId || '',
    metadata: Object.freeze({...input.metadata}),
  })
}

export class HookRegistry {
  constructor({logger = console} = {}) {
    this._handlers = new Map()
    this._logger = logger
  }

  register(eventType, handler, opts = {}) {
    if (!this._handlers.has(eventType)) this._handlers.set(eventType, [])
    this._handlers.get(eventType).push({
      handler,
      name: opts.name || handler.name || 'anonymous',
      failClosed: !!opts.failClosed,
    })
  }

  async dispatch(eventType, ctx) {
    for (const item of this._handlers.get(eventType) || []) {
      try {
        await item.handler(ctx)
      } catch (err) {
        this._logger.warn?.(`[hooks] observer failed: ${item.name}: ${err.message}`)
      }
    }
  }

  async dispatchGate(eventType, ctx) {
    for (const item of this._handlers.get(eventType) || []) {
      try {
        await item.handler(ctx)
      } catch (err) {
        if (err instanceof GuardrailDeny) throw err
        if (item.failClosed) {
          throw new GuardrailDeny(DenyReason.HOOK_FAILURE, `${item.name}: ${err.message}`)
        }
        this._logger.warn?.(`[hooks] gate observer failed: ${item.name}: ${err.message}`)
      }
    }
  }

  summary() {
    return Object.fromEntries([...this._handlers.entries()].map(([event, handlers]) => [
      event,
      handlers.map(h => ({name: h.name, failClosed: h.failClosed})),
    ]))
  }
}
