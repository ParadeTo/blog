import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  DenyReason,
  EventType,
  GuardrailDeny,
  createHookContext,
} from '../src/hook-framework/registry.js'
import {CostGuard} from '../src/shared-hooks/cost-guard.js'
import {LoopDetector} from '../src/shared-hooks/loop-detector.js'
import {RetryTracker} from '../src/shared-hooks/retry-tracker.js'

describe('reliability hooks', () => {
  it('CostGuard denies when estimated budget is exceeded before next tool call', async () => {
    const guard = new CostGuard({
      budgetUsd: 0.000001,
      inputUsdPerMillion: 10,
      outputUsdPerMillion: 10,
    })
    await guard.afterTurnHandler(createHookContext({
      eventType: EventType.AFTER_TURN,
      sessionId: 's1',
      inputTokens: 1000,
      outputTokens: 1000,
    }))

    await assert.rejects(
      guard.beforeToolHandler(createHookContext({
        eventType: EventType.BEFORE_TOOL_CALL,
        sessionId: 's1',
        toolName: 'read_file',
      })),
      err => err instanceof GuardrailDeny && err.reasonCode === DenyReason.BUDGET_EXCEEDED,
    )
  })

  it('LoopDetector denies after repeated identical outputs', async () => {
    const detector = new LoopDetector({threshold: 3})
    const ctx = result => createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      sessionId: 's1',
      toolName: 'read_file',
      metadata: {result},
    })

    await detector.afterToolHandler(ctx('same'))
    await detector.afterToolHandler(ctx('same'))
    await assert.rejects(
      detector.afterToolHandler(ctx('same')),
      err => err instanceof GuardrailDeny && err.reasonCode === DenyReason.LOOP_DETECTED,
    )
  })

  it('RetryTracker denies after failed attempts exceed threshold', async () => {
    const tracker = new RetryTracker({maxRetries: 2})
    const ctx = success => createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      sessionId: 's1',
      toolName: 'run_script',
      success,
    })

    await tracker.afterToolHandler(ctx(false))
    await tracker.afterToolHandler(ctx(false))
    await assert.rejects(
      tracker.afterToolHandler(ctx(false)),
      err => err instanceof GuardrailDeny && err.reasonCode === DenyReason.RETRY_EXCEEDED,
    )
  })
})
