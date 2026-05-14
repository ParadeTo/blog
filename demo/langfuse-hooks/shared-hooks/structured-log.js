function emit(ctx) {
  const record = {
    timestamp: ctx.timestamp,
    event: ctx.eventType,
    session_id: ctx.sessionId,
    turn: ctx.turnNumber,
  }

  if (ctx.agentId) record.agent_id = ctx.agentId
  if (ctx.toolName) record.tool = ctx.toolName
  if (ctx.inputTokens || ctx.outputTokens) {
    record.tokens = { input: ctx.inputTokens, output: ctx.outputTokens }
  }

  console.error(JSON.stringify(record))
}

export function beforeTurnHandler(ctx) {
  emit(ctx)
}

export function beforeLlmHandler(ctx) {
  emit(ctx)
}

export function beforeToolHandler(ctx) {
  emit(ctx)
}

export function afterToolHandler(ctx) {
  emit(ctx)
}

export function afterTurnHandler(ctx) {
  emit(ctx)
}
