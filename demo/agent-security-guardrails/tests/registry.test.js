import { describe, expect, test, vi } from 'vitest';

import { EventType, GuardrailDeny, HookRegistry } from '../src/hook-framework/registry.js';

describe('HookRegistry', () => {
  test('dispatchGate propagates GuardrailDeny', async () => {
    const registry = new HookRegistry({ logger: vi.fn() });
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      throw new GuardrailDeny('blocked', { guardrail: 'test' });
    }, 'deny', { mode: 'gate' });

    await expect(registry.dispatchGate(EventType.BEFORE_TOOL_CALL, {})).rejects.toMatchObject({
      name: 'GuardrailDeny',
      reason: 'blocked',
    });
  });

  test('dispatch catches ordinary errors and continues', async () => {
    const logger = vi.fn();
    const after = vi.fn();
    const registry = new HookRegistry({ logger });
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      throw new Error('log failed');
    }, 'broken', { mode: 'observe' });
    registry.register(EventType.BEFORE_TOOL_CALL, after, 'after', { mode: 'observe' });

    await registry.dispatch(EventType.BEFORE_TOOL_CALL, {});

    expect(after).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledOnce();
  });
});
