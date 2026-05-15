export const EventType = Object.freeze({
  BEFORE_TURN: 'before_turn',
  BEFORE_LLM: 'before_llm',
  BEFORE_TOOL_CALL: 'before_tool_call',
  AFTER_TOOL_CALL: 'after_tool_call',
  AFTER_TURN: 'after_turn',
  TASK_COMPLETE: 'task_complete',
  SESSION_END: 'session_end',
});

const EVENT_VALUES = new Set(Object.values(EventType));

export class GuardrailDeny extends Error {
  constructor(reason, metadata = {}) {
    super(reason);
    this.name = 'GuardrailDeny';
    this.reason = reason;
    this.metadata = metadata;
  }
}

export function normalizeEventType(eventType) {
  if (typeof eventType !== 'string') {
    throw new Error(`unknown hook event: ${String(eventType)}`);
  }

  const normalizedKey = eventType.trim().toUpperCase();
  if (Object.hasOwn(EventType, normalizedKey)) {
    return EventType[normalizedKey];
  }

  const normalizedValue = eventType.trim().toLowerCase();
  if (EVENT_VALUES.has(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(`unknown hook event: ${eventType}`);
}

export function createHookContext(fields = {}) {
  const {
    eventType,
    timestamp = new Date().toISOString(),
    agentId = '',
    taskName = '',
    toolName = '',
    toolInput = {},
    inputTokens = 0,
    outputTokens = 0,
    durationMs = 0,
    success = true,
    sessionId = null,
    turnNumber = 0,
    metadata = {},
    ...rest
  } = fields;

  return {
    ...rest,
    eventType: normalizeEventType(eventType),
    timestamp,
    agentId,
    taskName,
    toolName,
    toolInput,
    inputTokens,
    outputTokens,
    durationMs,
    success,
    sessionId,
    turnNumber,
    metadata,
  };
}

export class HookRegistry {
  constructor({ logger = console.error } = {}) {
    this.logger = logger;
    this.handlers = new Map(Object.values(EventType).map((eventType) => [eventType, []]));
  }

  register(eventType, handler, name = '') {
    const normalizedEventType = normalizeEventType(eventType);

    if (typeof handler !== 'function') {
      throw new TypeError('hook handler must be a function');
    }

    this.handlers.get(normalizedEventType).push({
      handler,
      name,
    });
  }

  async dispatch(eventType, context = {}) {
    const normalizedEventType = normalizeEventType(eventType);
    const hookContext = createHookContext({ ...context, eventType: normalizedEventType });

    for (const entry of this.handlers.get(normalizedEventType)) {
      try {
        await entry.handler(hookContext);
      } catch (error) {
        this.logHandlerError(normalizedEventType, entry.name, error);
      }
    }
  }

  async dispatchGate(eventType, context = {}) {
    const normalizedEventType = normalizeEventType(eventType);
    const hookContext = createHookContext({ ...context, eventType: normalizedEventType });

    for (const entry of this.handlers.get(normalizedEventType)) {
      try {
        await entry.handler(hookContext);
      } catch (error) {
        if (error instanceof GuardrailDeny) {
          throw error;
        }

        this.logHandlerError(normalizedEventType, entry.name, error);
      }
    }
  }

  handlerCount(eventType) {
    return this.handlers.get(normalizeEventType(eventType)).length;
  }

  summary() {
    return Object.fromEntries(
      Object.values(EventType).map((eventType) => [
        eventType,
        this.handlers.get(eventType).map(({ name }) => name),
      ]),
    );
  }

  logHandlerError(eventType, handlerName, error) {
    this.logger({
      message: 'hook handler failed',
      eventType,
      handlerName,
      error,
    });
  }
}
