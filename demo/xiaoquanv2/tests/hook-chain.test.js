import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  DenyReason,
  EventType,
  GuardrailDeny,
  HookRegistry,
  createHookContext,
} from '../src/hook-framework/registry.js'

describe('hook chain ordering', () => {
  it('observer handlers can record before a strategy denies', async () => {
    const registry = new HookRegistry()
    const calls = []
    registry.register(EventType.BEFORE_TOOL_CALL, () => calls.push('structured-log'))
    registry.register(EventType.BEFORE_TOOL_CALL, () => calls.push('langfuse-trace'))
    registry.register(
      EventType.BEFORE_TOOL_CALL,
      () => {
        calls.push('sandbox')
        throw new GuardrailDeny(DenyReason.SANDBOX_VIOLATION, 'blocked')
      },
      {name: 'sandbox-guard', failClosed: true},
    )
    registry.register(
      EventType.BEFORE_TOOL_CALL,
      () => calls.push('permission'),
      {name: 'permission-gate', failClosed: true},
    )

    await assert.rejects(
      registry.dispatchGate(
        EventType.BEFORE_TOOL_CALL,
        createHookContext({
          eventType: EventType.BEFORE_TOOL_CALL,
          toolName: 'run_script',
        }),
      ),
      GuardrailDeny,
    )
    assert.deepEqual(calls, ['structured-log', 'langfuse-trace', 'sandbox'])
  })
})
