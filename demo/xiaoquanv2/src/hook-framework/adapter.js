import {EventType, GuardrailDeny, createHookContext} from './registry.js'

export class HookAdapter {
  constructor(registry, base = {}) {
    this.registry = registry
    this.base = base
  }

  _ctx(eventType, fields = {}) {
    return createHookContext({
      eventType,
      sessionId: this.base.sessionId,
      turnNumber: this.base.turnNumber || 0,
      senderId: this.base.senderId || '',
      agentId: this.base.agentId || 'xiaoquan',
      ...fields,
    })
  }

  async beforeTurn(userContent) {
    await this.registry?.dispatchGate(
      EventType.BEFORE_TURN,
      this._ctx(EventType.BEFORE_TURN, {
        metadata: {
          userContent: typeof userContent === 'string' ? userContent : '[non-text]',
        },
      }),
    )
  }

  async beforeLlm(fields = {}) {
    await this.registry?.dispatch(
      EventType.BEFORE_LLM,
      this._ctx(EventType.BEFORE_LLM, fields),
    )
  }

  async beforeToolCall(toolName, toolInput) {
    await this.registry?.dispatchGate(
      EventType.BEFORE_TOOL_CALL,
      this._ctx(EventType.BEFORE_TOOL_CALL, {toolName, toolInput}),
    )
  }

  async afterToolCall(toolName, toolInput, result, fields = {}) {
    await this.registry?.dispatchGate(
      EventType.AFTER_TOOL_CALL,
      this._ctx(EventType.AFTER_TOOL_CALL, {
        toolName,
        toolInput,
        success: fields.success !== false,
        durationMs: fields.durationMs || 0,
        metadata: {
          result: String(result ?? '').slice(0, 2000),
          guardrailDeny: !!fields.guardrailDeny,
        },
      }),
    )
  }

  async taskComplete(fields = {}) {
    await this.registry?.dispatch(
      EventType.TASK_COMPLETE,
      this._ctx(EventType.TASK_COMPLETE, fields),
    )
  }

  async afterTurn(fields = {}) {
    await this.registry?.dispatchGate(
      EventType.AFTER_TURN,
      this._ctx(EventType.AFTER_TURN, fields),
    )
  }

  async sessionEnd(fields = {}) {
    await this.registry?.dispatch(
      EventType.SESSION_END,
      this._ctx(EventType.SESSION_END, fields),
    )
  }

  isDeny(err) {
    return err instanceof GuardrailDeny
  }
}
