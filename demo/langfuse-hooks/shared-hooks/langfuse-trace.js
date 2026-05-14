import { startObservation } from '@langfuse/tracing'

const sessions = new Map()

function enabled() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)
}

function sessionKey(ctx) {
  return ctx.sessionId || 'default'
}

function getState(ctx) {
  if (!enabled()) return null

  const key = sessionKey(ctx)
  let state = sessions.get(key)

  if (!state) {
    const root = startObservation(
      `session-${key}`,
      {
        input: ctx.metadata?.taskDescription || ctx.taskName || undefined,
        metadata: {
          sessionId: key,
          source: 'langfuse-hooks-js-demo',
        },
      },
      { asType: 'agent' },
    )

    state = {
      root,
      generation: null,
      genCount: 0,
      toolCount: 0,
      spanStack: [],
    }
    sessions.set(key, state)
  }

  return state
}

function currentToolParent(state) {
  if (state.generation) return state.generation
  if (state.spanStack.length > 0) return state.spanStack.at(-1).observation
  return state.root
}

function closeGeneration(state, attributes = {}) {
  if (!state.generation) return
  state.generation.update(attributes)
  state.generation.end()
  state.generation = null
}

function closeOpenTools(state, level = 'WARNING') {
  while (state.spanStack.length > 0) {
    const entry = state.spanStack.pop()
    entry.observation.update({
      level,
      statusMessage: 'orphaned-tool-auto-closed',
      metadata: {
        tool: entry.toolName,
        phase: 'auto-close',
      },
    })
    entry.observation.end()
  }
}

export function beforeLlmHandler(ctx) {
  const state = getState(ctx)
  if (!state) return

  closeGeneration(state, {
    metadata: { phase: 'closed-before-next-generation' },
  })

  state.genCount += 1
  const promptPreview = ctx.metadata?.promptPreview || ''
  const model = ctx.metadata?.model || process.env.LANGFUSE_HOOKS_AGENT_MODEL || 'gpt-5.4-nano-2026-03-17'

  state.generation = state.root.startObservation(
    `llm-call-${state.genCount}`,
    {
      input: promptPreview ? { prompt: promptPreview } : undefined,
      model,
      metadata: {
        agentId: ctx.agentId,
        turn: ctx.turnNumber,
        callNumber: state.genCount,
      },
    },
    { asType: 'generation' },
  )
}

export function beforeToolHandler(ctx) {
  const state = getState(ctx)
  if (!state) return

  state.toolCount += 1
  const observation = currentToolParent(state).startObservation(
    `tool-${ctx.toolName}`,
    {
      input: ctx.toolInput && Object.keys(ctx.toolInput).length > 0 ? ctx.toolInput : undefined,
      metadata: {
        tool: ctx.toolName,
        turn: ctx.turnNumber,
        callNumber: state.toolCount,
      },
    },
    { asType: 'tool' },
  )

  state.spanStack.push({
    observation,
    toolName: ctx.toolName,
    turnNumber: ctx.turnNumber,
  })
}

export function afterToolHandler(ctx) {
  const state = getState(ctx)
  if (!state) return

  const index = state.spanStack.findLastIndex(
    entry => entry.toolName === ctx.toolName && entry.turnNumber === ctx.turnNumber,
  )
  const output = {
    success: ctx.success,
  }

  if (ctx.metadata?.toolOutput) output.result = ctx.metadata.toolOutput
  if (ctx.metadata?.guardrailDeny) output.denyReason = ctx.metadata.denyReason || ''

  if (index >= 0) {
    const [entry] = state.spanStack.splice(index, 1)
    entry.observation.update({
      output,
      level: ctx.success && !ctx.metadata?.guardrailDeny ? 'DEFAULT' : 'ERROR',
      metadata: {
        tool: ctx.toolName,
        durationMs: ctx.durationMs,
      },
    })
    entry.observation.end()
  } else {
    const orphan = currentToolParent(state).startObservation(
      `tool-${ctx.toolName}`,
      {
        input: ctx.toolInput,
        output,
        level: ctx.success ? 'DEFAULT' : 'ERROR',
        metadata: {
          tool: ctx.toolName,
          durationMs: ctx.durationMs,
          phase: 'orphan-after-tool',
        },
      },
      { asType: 'tool' },
    )
    orphan.end()
  }
}

export function afterTurnHandler(ctx) {
  const state = getState(ctx)
  if (!state) return

  closeOpenTools(state)

  const output = ctx.metadata?.llmResponse || ctx.metadata?.output
  const usageDetails = {}
  if (ctx.inputTokens) usageDetails.input = ctx.inputTokens
  if (ctx.outputTokens) usageDetails.output = ctx.outputTokens
  if (ctx.inputTokens || ctx.outputTokens) {
    usageDetails.total = (ctx.inputTokens || 0) + (ctx.outputTokens || 0)
  }

  closeGeneration(state, {
    output: output || undefined,
    usageDetails: Object.keys(usageDetails).length > 0 ? usageDetails : undefined,
  })
}

export function taskCompleteHandler(ctx) {
  const state = getState(ctx)
  if (!state) return

  const taskDescription = ctx.metadata?.taskDescription || ctx.taskName
  const rawOutput = ctx.metadata?.rawOutput || ''
  const span = state.root.startObservation(
    'task-complete',
    {
      input: taskDescription || undefined,
      output: rawOutput || undefined,
      metadata: {
        agent: ctx.agentId,
      },
    },
  )

  span.end()
  state.root.update({
    input: taskDescription || undefined,
    output: rawOutput || undefined,
  })
  state.root.setTraceIO({
    input: taskDescription || undefined,
    output: rawOutput || undefined,
  })
}

export function flushAndClose(ctx) {
  const key = sessionKey(ctx)
  const state = sessions.get(key)
  if (!state) return

  closeOpenTools(state)
  closeGeneration(state, {
    level: 'WARNING',
    statusMessage: 'orphaned-generation-auto-closed',
  })
  state.root.end()
  sessions.delete(key)
}

export function __resetForTests() {
  for (const state of sessions.values()) {
    closeOpenTools(state)
    closeGeneration(state)
    state.root.end()
  }
  sessions.clear()
}
