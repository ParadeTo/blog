import {getTraceContext} from '../hook-framework/trace-context.js'

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
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
      if (!resp.ok) {
        throw new Error(`Langfuse ingestion failed: ${resp.status} ${await resp.text()}`)
      }
    },
  }
}

class IngestionBuffer {
  constructor({enabled, client}) {
    this.enabled = enabled
    this.client = client
    this.events = []
    this.stateBySession = new Map()
  }

  state(sessionId) {
    if (!this.stateBySession.has(sessionId)) {
      this.stateBySession.set(sessionId, {
        traceId: sessionId,
        rootSpanId: `session-${sessionId}`,
        stack: [],
        generationId: '',
      })
    }
    return this.stateBySession.get(sessionId)
  }

  parentObservationId(state) {
    const inherited = getTraceContext()?.parentSpanId || ''
    return state.stack.at(-1)?.id || inherited || state.rootSpanId
  }

  push(type, body) {
    if (!this.enabled) return
    this.events.push({
      id: id('evt'),
      type,
      timestamp: new Date().toISOString(),
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
      const state = buffer.state(ctx.sessionId)
      const inherited = getTraceContext()?.parentSpanId || ''
      buffer.push('trace-create', {
        id: state.traceId,
        name: `session-${ctx.sessionId}`,
        sessionId: ctx.sessionId,
        userId: ctx.senderId,
      })
      buffer.push('span-create', {
        id: state.rootSpanId,
        traceId: state.traceId,
        name: 'agent_execution',
        parentObservationId: inherited && inherited !== state.rootSpanId ? inherited : null,
      })
    },

    beforeLlmHandler(ctx) {
      const state = buffer.state(ctx.sessionId)
      state.generationId = id('gen')
      buffer.push('generation-create', {
        id: state.generationId,
        traceId: state.traceId,
        parentObservationId: buffer.parentObservationId(state),
        name: 'llm-call',
        model: ctx.metadata.model,
        metadata: ctx.metadata,
      })
    },

    beforeToolHandler(ctx) {
      const state = buffer.state(ctx.sessionId)
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
      const state = buffer.state(ctx.sessionId)
      const span = state.stack.pop() || {id: id(`tool-${ctx.toolName || 'unknown'}`)}
      buffer.push('span-update', {
        id: span.id,
        traceId: state.traceId,
        output: ctx.metadata.result,
        level: ctx.success ? 'DEFAULT' : 'ERROR',
        statusMessage: ctx.success ? undefined : ctx.metadata.result,
        metadata: ctx.metadata,
      })
    },

    async afterTurnHandler(ctx) {
      const state = buffer.state(ctx.sessionId)
      if (state.generationId) {
        buffer.push('generation-update', {
          id: state.generationId,
          traceId: state.traceId,
          usage: {
            input: ctx.inputTokens,
            output: ctx.outputTokens,
          },
        })
      }
      buffer.push('span-update', {
        id: state.rootSpanId,
        traceId: state.traceId,
        level: ctx.success ? 'DEFAULT' : 'ERROR',
        metadata: ctx.metadata,
      })
      await buffer.flush()
    },

    taskCompleteHandler(ctx) {
      const state = buffer.state(ctx.sessionId)
      buffer.push('trace-update', {
        id: state.traceId,
        output: ctx.metadata.reply,
        metadata: ctx.metadata,
      })
    },

    async flushAndClose(ctx) {
      await buffer.flush()
      if (ctx.sessionId) buffer.stateBySession.delete(ctx.sessionId)
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
