export const EventType = Object.freeze({
  BEFORE_TURN: 'before_turn',
  BEFORE_LLM: 'before_llm',
  BEFORE_TOOL_CALL: 'before_tool_call',
  AFTER_TOOL_CALL: 'after_tool_call',
  AFTER_TURN: 'after_turn',
  TASK_COMPLETE: 'task_complete',
  SESSION_END: 'session_end',
})

const EVENT_VALUES = new Set(Object.values(EventType))

export function normalizeEventType(eventType) {
  const normalized = String(eventType ?? '').trim().toLowerCase()
  if (!EVENT_VALUES.has(normalized)) {
    throw new Error(`unknown hook event: ${eventType}`)
  }
  return normalized
}

export function createHookContext(fields = {}) {
  const eventType = normalizeEventType(fields.eventType)

  return {
    eventType,
    timestamp: fields.timestamp ?? new Date().toISOString(),
    agentId: fields.agentId ?? '',
    taskName: fields.taskName ?? '',
    toolName: fields.toolName ?? '',
    toolInput: fields.toolInput ?? {},
    inputTokens: fields.inputTokens ?? 0,
    outputTokens: fields.outputTokens ?? 0,
    durationMs: fields.durationMs ?? 0,
    success: fields.success ?? true,
    sessionId: fields.sessionId ?? '',
    turnNumber: fields.turnNumber ?? 0,
    metadata: fields.metadata ?? {},
  }
}

export class HookRegistry {
  constructor({ logger = console.error } = {}) {
    this.handlers = new Map()
    this.handlerNames = new Map()
    this.logger = logger
  }

  register(eventType, handler, name = '') {
    const normalized = normalizeEventType(eventType)
    const handlers = this.handlers.get(normalized) ?? []
    const names = this.handlerNames.get(normalized) ?? []

    handlers.push(handler)
    names.push(name || handler.name || '<anonymous>')

    this.handlers.set(normalized, handlers)
    this.handlerNames.set(normalized, names)
  }

  async dispatch(eventType, context) {
    const normalized = normalizeEventType(eventType)
    const handlers = this.handlers.get(normalized) ?? []

    for (const handler of handlers) {
      try {
        await handler(context)
      } catch (error) {
        this.logger(`[HookRegistry] ${normalized} handler error: ${error.stack || error.message}`)
      }
    }
  }

  handlerCount(eventType) {
    return (this.handlers.get(normalizeEventType(eventType)) ?? []).length
  }

  summary() {
    const result = {}
    for (const [eventType, names] of this.handlerNames.entries()) {
      if (names.length > 0) result[eventType] = [...names]
    }
    return result
  }
}
