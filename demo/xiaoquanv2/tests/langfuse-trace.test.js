import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {EventType, createHookContext} from '../src/hook-framework/registry.js'
import {createLangfuseTraceHandlers} from '../src/shared-hooks/langfuse-trace.js'

describe('langfuse trace handlers', () => {
  let batches, handlers

  beforeEach(() => {
    batches = []
    handlers = createLangfuseTraceHandlers({
      enabled: true,
      client: {ingest: async events => batches.push(events)},
    })
  })

  it('creates trace, generation, tool span, task complete, and flush events', async () => {
    const base = {sessionId: 's1', agentId: 'xiaoquan'}
    await handlers.beforeTurnHandler(createHookContext({eventType: EventType.BEFORE_TURN, ...base}))
    await handlers.beforeLlmHandler(createHookContext({
      eventType: EventType.BEFORE_LLM,
      ...base,
      metadata: {model: 'mock'},
    }))
    await handlers.beforeToolHandler(createHookContext({
      eventType: EventType.BEFORE_TOOL_CALL,
      ...base,
      toolName: 'read_file',
    }))
    await handlers.afterToolHandler(createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      ...base,
      toolName: 'read_file',
      metadata: {result: 'ok'},
    }))
    await handlers.taskCompleteHandler(createHookContext({
      eventType: EventType.TASK_COMPLETE,
      ...base,
      metadata: {reply: 'done'},
    }))
    await handlers.flushAndClose(createHookContext({eventType: EventType.SESSION_END, ...base}))

    const flat = batches.flat()
    assert.ok(flat.find(e => e.type === 'trace-create'))
    assert.ok(flat.find(e => e.type === 'generation-create'))
    assert.ok(flat.find(e => e.type === 'span-create' && e.body.name === 'tool-read_file'))
    assert.ok(flat.find(e => e.type === 'trace-update' && e.body.output === 'done'))
  })

  it('marks denied tool span as error', async () => {
    const base = {sessionId: 's1', agentId: 'xiaoquan'}
    await handlers.beforeTurnHandler(createHookContext({eventType: EventType.BEFORE_TURN, ...base}))
    await handlers.beforeToolHandler(createHookContext({
      eventType: EventType.BEFORE_TOOL_CALL,
      ...base,
      toolName: 'run_script',
    }))
    await handlers.afterToolHandler(createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      ...base,
      toolName: 'run_script',
      success: false,
      metadata: {guardrailDeny: true, result: 'blocked'},
    }))
    await handlers.flushAndClose(createHookContext({eventType: EventType.SESSION_END, ...base}))

    assert.ok(batches.flat().find(e => e.type === 'span-update' && e.body.level === 'ERROR'))
  })
})
