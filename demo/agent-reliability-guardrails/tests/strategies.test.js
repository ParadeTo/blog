import { describe, expect, test, vi } from 'vitest';

import { GuardrailDeny } from '../src/hook-framework/registry.js';
import { CostGuard } from '../shared-hooks/cost-guard.js';
import { LoopDetector } from '../shared-hooks/loop-detector.js';
import { RetryTracker } from '../shared-hooks/retry-tracker.js';

describe('reliability strategies', () => {
  test('RetryTracker tracks consecutive failures and recovery metrics', () => {
    const logger = vi.fn();
    const tracker = new RetryTracker({ maxRetries: 2, logger });

    tracker.afterToolHandler({ toolName: 'search', success: false });
    tracker.afterToolHandler({ toolName: 'search', success: false });
    tracker.afterToolHandler({ toolName: 'search', success: true });

    expect(logger).toHaveBeenCalled();
    expect(tracker.getMetrics()).toEqual({
      total_retries: 1,
      successful_retries: 1,
      retry_success_rate: 1,
      active_failures: {},
    });
  });

  test('CostGuard denies turns that meet or exceed the configured budget', () => {
    const originalBudget = process.env.COST_GUARD_BUDGET;
    delete process.env.COST_GUARD_BUDGET;

    try {
      const guard = new CostGuard({
        budgetUsd: 0.000001,
        model: 'gpt-4o-mini',
        logger: () => {},
      });

      expect(() =>
        guard.afterTurnHandler({
          inputTokens: 1000,
          outputTokens: 1000,
        }),
      ).toThrow(GuardrailDeny);
      expect(guard.getMetrics().deny_count).toBe(1);
    } finally {
      if (originalBudget === undefined) {
        delete process.env.COST_GUARD_BUDGET;
      } else {
        process.env.COST_GUARD_BUDGET = originalBudget;
      }
    }
  });

  test('LoopDetector denies repeated identical tool output at the configured threshold', () => {
    const detector = new LoopDetector({ threshold: 3, logger: () => {} });
    const repeatedToolCall = {
      toolName: 'search',
      metadata: {
        toolOutput: 'same result',
      },
    };

    detector.afterToolHandler(repeatedToolCall);
    detector.afterToolHandler(repeatedToolCall);

    expect(() => detector.afterToolHandler(repeatedToolCall)).toThrow(GuardrailDeny);
    expect(detector.getMetrics().loop_detections).toBe(1);
  });
});
