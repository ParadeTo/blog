import { describe, expect, test, vi } from 'vitest';

import {
  EventType,
  GuardrailDeny,
  HookRegistry,
  createHookContext,
  normalizeEventType,
} from '../src/hook-framework/registry.js';

describe('hook registry', () => {
  test('normalizes known event names', () => {
    expect(normalizeEventType('BEFORE_TURN')).toBe(EventType.BEFORE_TURN);
    expect(normalizeEventType('before_llm')).toBe(EventType.BEFORE_LLM);
    expect(normalizeEventType(' BEFORE_TURN ')).toBe(EventType.BEFORE_TURN);
    expect(normalizeEventType('Before_Llm')).toBe(EventType.BEFORE_LLM);
  });

  test('rejects unknown event names', () => {
    expect(() => normalizeEventType('before_breakfast')).toThrow(/unknown hook event/i);
  });

  test('createHookContext applies defaults and preserves metadata', () => {
    const metadata = { requestId: 'req-1' };
    const context = createHookContext({
      eventType: ' Before_Turn ',
      metadata,
    });

    expect(context).toMatchObject({
      eventType: EventType.BEFORE_TURN,
      agentId: '',
      taskName: '',
      toolName: '',
      toolInput: {},
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      success: true,
      turnNumber: 0,
      metadata,
    });
    expect(context.metadata).toBe(metadata);
    expect(typeof context.timestamp).toBe('string');
  });

  test('register rejects non-function handlers', () => {
    const registry = new HookRegistry({ logger: vi.fn() });

    expect(() => registry.register(EventType.AFTER_TURN, 'not-a-handler')).toThrow(
      /hook handler must be a function/i,
    );
  });

  test('dispatch catches ordinary handler errors, logs once, and keeps going', async () => {
    const logger = vi.fn();
    const registry = new HookRegistry({ logger });
    const calls = [];

    registry.register(EventType.BEFORE_TURN, () => {
      calls.push('first');
      throw new Error('handler failed');
    }, 'failing-handler');
    registry.register(EventType.BEFORE_TURN, () => {
      calls.push('second');
    }, 'later-handler');

    await registry.dispatch(EventType.BEFORE_TURN, {});

    expect(calls).toEqual(['first', 'second']);
    expect(logger).toHaveBeenCalledTimes(1);
  });

  test('dispatchGate propagates GuardrailDeny', async () => {
    const registry = new HookRegistry({ logger: vi.fn() });

    registry.register(EventType.BEFORE_LLM, () => {
      throw new GuardrailDeny('budget exceeded');
    });

    await expect(registry.dispatchGate(EventType.BEFORE_LLM, {})).rejects.toMatchObject({
      name: 'GuardrailDeny',
      reason: 'budget exceeded',
    });
  });

  test('dispatchGate catches ordinary errors, logs once, and keeps going', async () => {
    const logger = vi.fn();
    const registry = new HookRegistry({ logger });
    const calls = [];

    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      calls.push('first');
      throw new Error('ordinary failure');
    }, 'failing-gate');
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      calls.push('second');
    }, 'later-gate');

    await registry.dispatchGate(EventType.BEFORE_TOOL_CALL, {});

    expect(calls).toEqual(['first', 'second']);
    expect(logger).toHaveBeenCalledTimes(1);
  });

  test('handlerCount and summary work', () => {
    const registry = new HookRegistry({ logger: vi.fn() });

    registry.register(EventType.AFTER_TURN, () => {}, 'h1');
    registry.register('AFTER_TURN', () => {}, 'h2');

    expect(registry.handlerCount(EventType.AFTER_TURN)).toBe(2);
    expect(registry.summary().after_turn).toEqual(['h1', 'h2']);
  });
});
