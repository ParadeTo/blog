function emit(ctx, phase) {
  console.log(JSON.stringify({
    ts: ctx.timestamp,
    phase,
    eventType: ctx.eventType,
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    turnNumber: ctx.turnNumber,
    toolName: ctx.toolName || undefined,
    success: ctx.success,
    durationMs: ctx.durationMs || undefined,
    inputTokens: ctx.inputTokens || undefined,
    outputTokens: ctx.outputTokens || undefined,
    metadata: ctx.metadata,
  }))
}

export function beforeTurnHandler(ctx) { emit(ctx, 'before_turn') }
export function beforeLlmHandler(ctx) { emit(ctx, 'before_llm') }
export function beforeToolHandler(ctx) { emit(ctx, 'before_tool_call') }
export function afterToolHandler(ctx) { emit(ctx, 'after_tool_call') }
export function afterTurnHandler(ctx) { emit(ctx, 'after_turn') }
export function taskCompleteHandler(ctx) { emit(ctx, 'task_complete') }
export function sessionEndHandler(ctx) { emit(ctx, 'session_end') }
