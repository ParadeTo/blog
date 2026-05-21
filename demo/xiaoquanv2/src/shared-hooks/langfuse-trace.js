import {getTraceContext} from '../hook-framework/trace-context.js'

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function createHttpClient({
  baseUrl = process.env.XIAOQUAN_LANGFUSE_BASE_URL || process.env.LANGFUSE_BASE_URL || 'http://localhost:3000',
  publicKey = process.env.XIAOQUAN_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY || '',
  secretKey = process.env.XIAOQUAN_LANGFUSE_SECRET_KEY || process.env.LANGFUSE_SECRET_KEY || '',
} = {}) {
  return {
    async ingest(events) {
      const token = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
      const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public/ingestion`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({batch: events}),
      })
      const bodyText = await resp.text()
      if (!resp.ok) {
        throw new Error(`Langfuse ingestion failed: ${resp.status} ${bodyText}`)
      }
      if (resp.status === 207) {
        const body = JSON.parse(bodyText)
        if (body.errors?.length) {
          throw new Error(`Langfuse ingestion partial failure: ${JSON.stringify(body.errors)}`)
        }
      }
    },
  }
}

function asLangfuseValue(value) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildGenerationInput(metadata = {}) {
  if (metadata.promptMessages) return {messages: metadata.promptMessages}
  if (metadata.promptPreview) return {prompt: metadata.promptPreview}
  return undefined
}

function buildGenerationMetadata(metadata = {}) {
  const {
    promptMessages,
    previousLlmOutput,
    ...rest
  } = metadata
  return rest
}

function appendToolCallOutput(existing, tool) {
  if (existing?.action === 'tool_calls' && Array.isArray(existing.tools)) {
    return {
      action: 'tool_calls',
      tools: [...existing.tools, tool],
    }
  }
  return {
    action: 'tool_calls',
    tools: [tool],
  }
}

class IngestionBuffer {
  constructor({enabled, client}) {
    this.enabled = enabled
    this.client = client
    this.events = []
    this.stateBySession = new Map()
  }

  state(ctx) {
    const inherited = getTraceContext()
    const turnNumber = ctx.turnNumber || 1
    const traceId = inherited?.traceId || `${ctx.sessionId}-turn-${turnNumber}`
    if (!this.stateBySession.has(traceId)) {
      this.stateBySession.set(traceId, {
        traceId,
        sessionId: ctx.sessionId,
        turnNumber,
        rootSpanId: inherited?.parentSpanId || `agent-${traceId}`,
        stack: [],
        generationId: '',
        generationOutput: undefined,
        input: '',
        output: '',
      })
    }
    return this.stateBySession.get(traceId)
  }

  parentObservationId(state) {
    const inherited = getTraceContext()?.parentSpanId || ''
    return state.stack.at(-1)?.id || inherited || state.rootSpanId
  }

  push(type, body) {
    if (!this.enabled) return
    const timestamp = nowIso()
    this.events.push({
      id: id('evt'),
      type,
      timestamp,
      body,
    })
  }

  async flush() {
    if (!this.enabled || this.events.length === 0) return
    const batch = this.events.splice(0)
    await this.client.ingest(batch)
  }
}

export function createLangfuseTraceHandlers({
  enabled = process.env.TRACE_TO_LANGFUSE === 'true',
  client = null,
} = {}) {
  const buffer = new IngestionBuffer({
    enabled,
    client: client || createHttpClient(),
  })

  return {
    async beforeTurnHandler(ctx) {
      const state = buffer.state(ctx)
      const inherited = getTraceContext()?.parentSpanId || ''
      state.input = asLangfuseValue(ctx.metadata.userContent) || ''
      buffer.push('trace-create', {
        id: state.traceId,
        name: `session-${ctx.sessionId}-turn-${ctx.turnNumber || 1}`,
        sessionId: ctx.sessionId,
        userId: ctx.senderId,
        input: state.input,
        metadata: {
          agentId: ctx.agentId,
          turnNumber: ctx.turnNumber,
        },
      })
      buffer.push('span-create', {
        id: state.rootSpanId,
        traceId: state.traceId,
        name: 'agent_execution',
        parentObservationId: inherited && inherited !== state.rootSpanId ? inherited : null,
        input: state.input,
        metadata: {
          agentId: ctx.agentId,
          turnNumber: ctx.turnNumber,
        },
      })
    },

    beforeLlmHandler(ctx) {
      const state = buffer.state(ctx)
      const previousOutput = ctx.metadata.previousLlmOutput !== undefined
        ? ctx.metadata.previousLlmOutput
        : state.generationOutput
      if (state.generationId && previousOutput !== undefined) {
        buffer.push('generation-update', {
          id: state.generationId,
          traceId: state.traceId,
          output: previousOutput,
          endTime: nowIso(),
        })
      }
      state.generationId = id('gen')
      state.generationOutput = undefined
      buffer.push('generation-create', {
        id: state.generationId,
        traceId: state.traceId,
        parentObservationId: buffer.parentObservationId(state),
        name: 'llm-call',
        model: ctx.metadata.model,
        input: buildGenerationInput(ctx.metadata),
        metadata: buildGenerationMetadata(ctx.metadata),
      })
    },

    beforeToolHandler(ctx) {
      const state = buffer.state(ctx)
      if (state.generationId) {
        state.generationOutput = appendToolCallOutput(state.generationOutput, {
          name: ctx.toolName,
          input: ctx.toolInput,
        })
        buffer.push('generation-update', {
          id: state.generationId,
          traceId: state.traceId,
          output: state.generationOutput,
          endTime: nowIso(),
        })
      }
      const spanId = id(`tool-${ctx.toolName || 'unknown'}`)
      buffer.push('span-create', {
        id: spanId,
        traceId: state.traceId,
        parentObservationId: buffer.parentObservationId(state),
        name: `tool-${ctx.toolName}`,
        input: ctx.toolInput,
      })
      state.stack.push({id: spanId, name: ctx.toolName})
    },

    afterToolHandler(ctx) {
      const state = buffer.state(ctx)
      const span = state.stack.pop() || {id: id(`tool-${ctx.toolName || 'unknown'}`)}
      buffer.push('span-update', {
        id: span.id,
        traceId: state.traceId,
        output: ctx.metadata.result,
        endTime: nowIso(),
        level: ctx.success ? 'DEFAULT' : 'ERROR',
        statusMessage: ctx.success ? undefined : ctx.metadata.result,
        metadata: ctx.metadata,
      })
    },

    async afterTurnHandler(ctx) {
      const state = buffer.state(ctx)
      const output = asLangfuseValue(ctx.metadata.reply || ctx.metadata.detail || ctx.metadata.reasonCode) || state.output
      if (output) state.output = output
      if (state.generationId) {
        const generationOutput = state.generationOutput !== undefined
          ? state.generationOutput
          : state.output || undefined
        buffer.push('generation-update', {
          id: state.generationId,
          traceId: state.traceId,
          usage: {
            input: ctx.inputTokens,
            output: ctx.outputTokens,
          },
          output: generationOutput,
          endTime: nowIso(),
        })
      }
      buffer.push('span-update', {
        id: state.rootSpanId,
        traceId: state.traceId,
        output: state.output || undefined,
        endTime: nowIso(),
        level: ctx.success ? 'DEFAULT' : 'ERROR',
        metadata: ctx.metadata,
      })
      buffer.push('trace-create', {
        id: state.traceId,
        input: state.input || undefined,
        output: state.output || undefined,
        metadata: {
          ...ctx.metadata,
          success: ctx.success,
        },
      })
      await buffer.flush()
    },

    taskCompleteHandler(ctx) {
      const state = buffer.state(ctx)
      state.output = asLangfuseValue(ctx.metadata.reply) || ''
      buffer.push('trace-create', {
        id: state.traceId,
        output: state.output || undefined,
        metadata: ctx.metadata,
      })
    },

    async flushAndClose(ctx) {
      await buffer.flush()
      if (ctx.sessionId) {
        const state = buffer.state(ctx)
        buffer.stateBySession.delete(state.traceId)
      }
    },
  }
}

const singleton = createLangfuseTraceHandlers()

export const beforeTurnHandler = singleton.beforeTurnHandler
export const beforeLlmHandler = singleton.beforeLlmHandler
export const beforeToolHandler = singleton.beforeToolHandler
export const afterToolHandler = singleton.afterToolHandler
export const afterTurnHandler = singleton.afterTurnHandler
export const taskCompleteHandler = singleton.taskCompleteHandler
export const flushAndClose = singleton.flushAndClose
