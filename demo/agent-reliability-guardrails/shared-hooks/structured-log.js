function emit(ctx) {
  const payload = {
    timestamp: ctx.timestamp ?? new Date().toISOString(),
    event: ctx.eventType,
    session_id: ctx.sessionId ?? null,
    turn: ctx.turnNumber ?? ctx.turn ?? 0,
  };

  if (ctx.agentId) {
    payload.agent_id = ctx.agentId;
  }

  if (ctx.toolName) {
    payload.tool = ctx.toolName;
  }

  if (ctx.inputTokens || ctx.outputTokens) {
    payload.tokens = {
      input: Number(ctx.inputTokens ?? 0),
      output: Number(ctx.outputTokens ?? 0),
    };
  }

  if (ctx.metadata?.guardrailDeny) {
    payload.guardrail_deny = true;
    payload.deny_reason = ctx.metadata.denyReason ?? ctx.metadata.reason ?? '';
  }

  console.error(JSON.stringify(payload));
}

export function beforeTurnHandler(ctx) {
  emit(ctx);
}

export function beforeLlmHandler(ctx) {
  emit(ctx);
}

export function beforeToolHandler(ctx) {
  emit(ctx);
}

export function afterToolHandler(ctx) {
  emit(ctx);
}

export function afterTurnHandler(ctx) {
  emit(ctx);
}

export function taskCompleteHandler(ctx) {
  emit(ctx);
}

export function sessionEndHandler(ctx) {
  emit(ctx);
}
