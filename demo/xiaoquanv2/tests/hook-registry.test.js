import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  DenyReason,
  EventType,
  GuardrailDeny,
  HookRegistry,
  createHookContext,
} from '../src/hook-framework/registry.js'

describe('HookRegistry', () => {
  it('dispatch catches observer errors and continues', async () => {
    const registry = new HookRegistry()
    const calls = []
    registry.register(EventType.BEFORE_TURN, () => {
      calls.push('first')
      throw new Error('observer broke')
    })
    registry.register(EventType.BEFORE_TURN, () => {
      calls.push('second')
    })

    await registry.dispatch(
      EventType.BEFORE_TURN,
      createHookContext({eventType: EventType.BEFORE_TURN}),
    )

    assert.deepEqual(calls, ['first', 'second'])
  })

  it('dispatchGate throws GuardrailDeny and stops later handlers', async () => {
    const registry = new HookRegistry()
    const calls = []
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      calls.push('deny')
      throw new GuardrailDeny(DenyReason.PERMISSION_DENIED, 'blocked')
    })
    registry.register(EventType.BEFORE_TOOL_CALL, () => calls.push('after'))

    await assert.rejects(
      registry.dispatchGate(
        EventType.BEFORE_TOOL_CALL,
        createHookContext({eventType: EventType.BEFORE_TOOL_CALL}),
      ),
      err => err instanceof GuardrailDeny &&
        err.reasonCode === DenyReason.PERMISSION_DENIED,
    )
    assert.deepEqual(calls, ['deny'])
  })

  it('failClosed converts handler errors to GuardrailDeny', async () => {
    const registry = new HookRegistry()
    registry.register(
      EventType.BEFORE_TOOL_CALL,
      () => {
        throw new Error('config missing')
      },
      {name: 'sandbox-guard', failClosed: true},
    )

    await assert.rejects(
      registry.dispatchGate(
        EventType.BEFORE_TOOL_CALL,
        createHookContext({eventType: EventType.BEFORE_TOOL_CALL}),
      ),
      err => err instanceof GuardrailDeny &&
        err.reasonCode === DenyReason.HOOK_FAILURE,
    )
  })

  it('freezes toolInput and metadata copies', () => {
    const source = {path: '../secret'}
    const ctx = createHookContext({
      eventType: EventType.BEFORE_TOOL_CALL,
      toolName: 'read_file',
      toolInput: source,
      metadata: {source: 'test'},
    })
    source.path = 'changed'

    assert.equal(ctx.toolInput.path, '../secret')
    assert.throws(() => {
      ctx.toolInput.path = 'mutate'
    }, TypeError)
    assert.throws(() => {
      ctx.metadata.source = 'mutate'
    }, TypeError)
  })
})
