export function beforeToolHandler(ctx) {
  console.error(
    JSON.stringify({
      event: 'before_tool_call',
      tool: ctx.toolName,
      session_id: ctx.sessionId,
    }),
  );
}

export function afterToolHandler(ctx) {
  console.error(
    JSON.stringify({
      event: 'after_tool_call',
      tool: ctx.toolName,
      success: ctx.success,
      guardrail_deny: Boolean(ctx.metadata?.guardrailDeny),
    }),
  );
}
