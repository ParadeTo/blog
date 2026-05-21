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
    const base = {sessionId: 's1', agentId: 'xiaoquan', turnNumber: 1}
    await handlers.beforeTurnHandler(createHookContext({
      eventType: EventType.BEFORE_TURN,
      ...base,
      senderId: 'ou_test',
      metadata: {userContent: 'hello'},
    }))
    await handlers.beforeLlmHandler(createHookContext({
      eventType: EventType.BEFORE_LLM,
      ...base,
      metadata: {
        model: 'mock',
        promptMessages: [{role: 'user', content: 'hello'}],
      },
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
    await handlers.beforeLlmHandler(createHookContext({
      eventType: EventType.BEFORE_LLM,
      ...base,
      metadata: {
        model: 'mock',
        previousLlmOutput: {action: 'tool_calls', tools: [{name: 'read_file'}]},
        promptMessages: [{role: 'tool', content: 'ok'}],
      },
    }))
    await handlers.taskCompleteHandler(createHookContext({
      eventType: EventType.TASK_COMPLETE,
      ...base,
      metadata: {reply: 'done'},
    }))
    await handlers.afterTurnHandler(createHookContext({
      eventType: EventType.AFTER_TURN,
      ...base,
      inputTokens: 10,
      outputTokens: 2,
      metadata: {reply: 'done'},
    }))
    await handlers.flushAndClose(createHookContext({eventType: EventType.SESSION_END, ...base}))

    const flat = batches.flat()
    assert.ok(flat.find(e => e.type === 'trace-create' && e.body.id === 's1-turn-1' && e.body.input === 'hello'))
    assert.ok(flat.find(e =>
      e.type === 'generation-create' &&
      e.body.input?.messages?.[0]?.content === 'hello',
    ))
    assert.ok(flat.find(e => e.type === 'generation-update' && e.body.output === 'done'))
    assert.ok(flat.find(e => e.type === 'span-create' && e.body.name === 'tool-read_file'))
    assert.ok(flat.find(e => e.type === 'span-update' && e.body.endTime))
    assert.ok(flat.find(e => e.type === 'generation-update' && e.body.output === 'done' && e.body.endTime))
    assert.ok(flat.find(e => e.type === 'span-update' && e.body.id === 'agent-s1-turn-1' && e.body.endTime))
    assert.ok(flat.find(e => e.type === 'trace-create' && e.body.output === 'done'))
    assert.equal(flat.find(e => e.type === 'span-create' && e.body.name === 'agent_execution').body.input, 'hello')
  })

  it('marks denied tool span as error', async () => {
    const base = {sessionId: 's1', agentId: 'xiaoquan', turnNumber: 1}
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

  it('closes the previous generation when the next LLM call starts', async () => {
    const base = {sessionId: 's1', agentId: 'xiaoquan', turnNumber: 1}
    await handlers.beforeTurnHandler(createHookContext({
      eventType: EventType.BEFORE_TURN,
      ...base,
      metadata: {userContent: 'hello'},
    }))
    await handlers.beforeLlmHandler(createHookContext({
      eventType: EventType.BEFORE_LLM,
      ...base,
      metadata: {
        model: 'mock',
        promptMessages: [{role: 'user', content: 'hello'}],
      },
    }))
    await handlers.beforeLlmHandler(createHookContext({
      eventType: EventType.BEFORE_LLM,
      ...base,
      metadata: {
        model: 'mock',
        previousLlmOutput: {action: 'tool_calls', tools: [{name: 'list_skills'}]},
        promptMessages: [{role: 'tool', content: 'tool result'}],
      },
    }))
    await handlers.flushAndClose(createHookContext({eventType: EventType.SESSION_END, ...base}))

    assert.ok(batches.flat().find(e =>
      e.type === 'generation-update' &&
      e.body.output?.action === 'tool_calls' &&
      e.body.endTime,
    ))
  })

  it('keeps tool-call output on generation when a later guardrail denies the turn', async () => {
    const base = {sessionId: 's1', agentId: 'xiaoquan', turnNumber: 1}
    await handlers.beforeTurnHandler(createHookContext({
      eventType: EventType.BEFORE_TURN,
      ...base,
      metadata: {userContent: '连续读取 loop-demo.txt'},
    }))
    await handlers.beforeLlmHandler(createHookContext({
      eventType: EventType.BEFORE_LLM,
      ...base,
      metadata: {
        model: 'mock',
        promptMessages: [{role: 'user', content: '连续读取 loop-demo.txt'}],
      },
    }))
    await handlers.beforeToolHandler(createHookContext({
      eventType: EventType.BEFORE_TOOL_CALL,
      ...base,
      toolName: 'read_file',
      toolInput: {path: 'loop-demo.txt'},
    }))
    await handlers.afterToolHandler(createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      ...base,
      toolName: 'read_file',
      success: true,
      metadata: {result: 'loop-demo-content'},
    }))
    await handlers.afterTurnHandler(createHookContext({
      eventType: EventType.AFTER_TURN,
      ...base,
      success: false,
      metadata: {
        reply: '安全策略拦截：loop_detected',
        reasonCode: 'loop_detected',
      },
    }))
    await handlers.flushAndClose(createHookContext({eventType: EventType.SESSION_END, ...base}))

    const flat = batches.flat()
    assert.ok(flat.find(e =>
      e.type === 'generation-update' &&
      e.body.output?.action === 'tool_calls' &&
      e.body.output.tools?.[0]?.name === 'read_file',
    ))
    assert.equal(
      flat.some(e => e.type === 'generation-update' && e.body.output === '安全策略拦截：loop_detected'),
      false,
    )
    assert.ok(flat.find(e =>
      e.type === 'span-update' &&
      e.body.id === 'agent-s1-turn-1' &&
      e.body.output === '安全策略拦截：loop_detected' &&
      e.body.level === 'ERROR',
    ))
    assert.ok(flat.find(e => e.type === 'trace-create' && e.body.output === '安全策略拦截：loop_detected'))
  })
})
