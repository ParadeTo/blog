import { describe, expect, test, vi } from 'vitest';

import { GuardrailDeny, HookRegistry } from '../src/hook-framework/registry.js';
import { CostGuard } from '../shared-hooks/cost-guard.js';
import { LoopDetector } from '../shared-hooks/loop-detector.js';
import { RetryTracker } from '../shared-hooks/retry-tracker.js';

describe('reliability strategies', () => {
  test('CostGuard registered as a gate counts one event once across dispatch and dispatchGate', async () => {
    const guard = new CostGuard({
      budgetUsd: 1,
      model: 'gpt-4o-mini',
      logger: () => {},
    });
    const registry = new HookRegistry({ logger: vi.fn() });

    registry.register('after_turn', guard.afterTurnHandler.bind(guard), 'cost', { mode: 'gate' });
    await registry.dispatch('after_turn', {
      inputTokens: 1000,
      outputTokens: 1000,
    });
    await registry.dispatchGate('after_turn', {
      inputTokens: 1000,
      outputTokens: 1000,
    });

    expect(guard.getMetrics()).toMatchObject({
      total_input_tokens: 1000,
      total_output_tokens: 1000,
      estimated_cost_usd: 0.00075,
    });
  });

  test('RetryTracker tracks consecutive failures and recovery metrics', () => {
    const logger = vi.fn();
    const tracker = new RetryTracker({ maxRetries: 2, logger });

    tracker.afterToolHandler({ toolName: 'search', success: false });
    tracker.afterToolHandler({ toolName: 'search', success: false });
    tracker.afterToolHandler({ toolName: 'search', success: true });

    expect(logger).toHaveBeenCalled();
    expect(JSON.parse(logger.mock.calls.at(-1)[0])).toEqual({
      level: 'WARNING',
      guardrail: 'retry_tracker',
      message: "Tool 'search' failed 2 times consecutively",
      tool: 'search',
      consecutive_failures: 2,
      max_retries: 2,
    });
    expect(tracker.getMetrics()).toEqual({
      repeated_failures_after_first: 1,
      recoveries_after_failure: 1,
      active_failures: {
        search: 0,
      },
    });
  });

  test('RetryTracker rejects invalid maxRetries values', () => {
    expect(() => new RetryTracker({ maxRetries: 0 })).toThrow(/positive integer/i);
    expect(() => new RetryTracker({ maxRetries: 1.5 })).toThrow(/positive integer/i);
    expect(() => new RetryTracker({ maxRetries: 'many' })).toThrow(/positive integer/i);
  });

  test('CostGuard denies turns that meet or exceed the configured budget', () => {
    const originalBudget = process.env.COST_GUARD_BUDGET;
    delete process.env.COST_GUARD_BUDGET;
    const logger = vi.fn();

    try {
      const guard = new CostGuard({
        budgetUsd: 0.000001,
        model: 'gpt-4o-mini',
        logger,
      });

      expect(() =>
        guard.afterTurnHandler({
          turnNumber: 3,
          inputTokens: 1000,
          outputTokens: 1000,
        }),
      ).toThrow('Budget exceeded: $0.000750 >= limit $0.000001');
      expect(JSON.parse(logger.mock.calls.at(-1)[0])).toMatchObject({
        level: 'CRITICAL',
        guardrail: 'cost_guard',
        message: 'Budget exceeded - blocking',
        estimated_cost_usd: 0.00075,
        budget_usd: 0.000001,
      });
      expect(guard.getMetrics().deny_count).toBe(1);
    } finally {
      if (originalBudget === undefined) {
        delete process.env.COST_GUARD_BUDGET;
      } else {
        process.env.COST_GUARD_BUDGET = originalBudget;
      }
    }
  });

  test('CostGuard uses a safe default budget and logs cost updates with plan fields', () => {
    const originalBudget = process.env.COST_GUARD_BUDGET;
    delete process.env.COST_GUARD_BUDGET;
    const logger = vi.fn();

    try {
      const guard = new CostGuard({
        model: 'gpt-4o-mini',
        logger,
      });

      guard.afterTurnHandler({
        turnNumber: 7,
        inputTokens: 1000,
        outputTokens: 1000,
      });

      expect(JSON.parse(logger.mock.calls.at(-1)[0])).toEqual({
        level: 'INFO',
        guardrail: 'cost_guard',
        turn: 7,
        input_tokens: 1000,
        output_tokens: 1000,
        estimated_cost_usd: 0.00075,
        budget_usd: 1,
        remaining_usd: 0.99925,
      });
      expect(guard.getMetrics()).toEqual({
        model: 'gpt-4o-mini',
        total_input_tokens: 1000,
        total_output_tokens: 1000,
        estimated_cost_usd: 0.00075,
        budget_usd: 1,
        remaining_usd: 0.99925,
        budget_utilization: 0,
        deny_count: 0,
      });
    } finally {
      if (originalBudget === undefined) {
        delete process.env.COST_GUARD_BUDGET;
      } else {
        process.env.COST_GUARD_BUDGET = originalBudget;
      }
    }
  });

  test('LoopDetector denies repeated identical tool output at the configured threshold', () => {
    const logger = vi.fn();
    const detector = new LoopDetector({ threshold: 3, logger });
    const repeatedToolCall = {
      turnNumber: 4,
      toolName: 'search',
      metadata: {
        toolOutput: 'same result',
      },
    };

    detector.afterToolHandler(repeatedToolCall);
    detector.afterToolHandler(repeatedToolCall);

    expect(() => detector.afterToolHandler(repeatedToolCall)).toThrow(
      'Loop detected: identical state repeated 3 consecutive times',
    );
    expect(JSON.parse(logger.mock.calls.at(-1)[0])).toMatchObject({
      level: 'CRITICAL',
      guardrail: 'loop_detector',
      message: 'Loop detected - terminating',
      turn: 4,
      tool: 'search',
      threshold: 3,
    });
    expect(detector.getMetrics().loop_detections).toBe(1);
  });

  test('LoopDetector rejects invalid thresholds and distinguishes long outputs beyond the prefix', () => {
    expect(() => new LoopDetector({ threshold: 0 })).toThrow(/positive integer/i);
    expect(() => new LoopDetector({ threshold: 2.5 })).toThrow(/positive integer/i);
    expect(() => new LoopDetector({ threshold: 'often' })).toThrow(/positive integer/i);

    const detector = new LoopDetector({ threshold: 3, logger: () => {} });
    const sharedPrefix = 'x'.repeat(220);

    detector.afterToolHandler({
      toolName: 'search',
      metadata: { toolOutput: `${sharedPrefix}-one` },
    });
    detector.afterToolHandler({
      toolName: 'search',
      metadata: { toolOutput: `${sharedPrefix}-two` },
    });

    expect(() =>
      detector.afterToolHandler({
        toolName: 'search',
        metadata: { toolOutput: `${sharedPrefix}-three` },
      }),
    ).not.toThrow();
    expect(detector.getMetrics().loop_detections).toBe(0);
  });
});
