import { describe, expect, test, vi } from 'vitest';

import { HookLoader } from '../src/hook-framework/loader.js';
import { EventType, HookRegistry, createHookContext } from '../src/hook-framework/registry.js';
import { beforeTurnHandler } from '../shared-hooks/structured-log.js';
import {
  __resetLangfuseTraceForTests,
  __setObservationFactoryForTests,
  afterToolHandler,
  afterTurnHandler,
  beforeLlmHandler,
  beforeToolHandler,
  sessionEndHandler,
  taskCompleteHandler,
} from '../shared-hooks/langfuse-trace.js';

describe('observability handlers', () => {
  test('beforeTurnHandler emits compact structured JSON', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      beforeTurnHandler(createHookContext({
        eventType: EventType.BEFORE_TURN,
        sessionId: 's1',
        turnNumber: 1,
        agentId: 'demo-agent',
      }));

      const payload = JSON.parse(errorSpy.mock.calls[0][0]);

      expect(payload).toMatchObject({
        event: 'before_turn',
        session_id: 's1',
        turn: 1,
        agent_id: 'demo-agent',
      });
      expect(payload).not.toHaveProperty('tokens');
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('langfuse handlers are inert when credentials are absent', () => {
    const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;
    const observationFactory = vi.fn();

    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    __setObservationFactoryForTests(observationFactory);

    try {
      const ctx = createHookContext({
        eventType: EventType.BEFORE_LLM,
        sessionId: 's-disabled',
        turnNumber: 2,
        toolName: 'search',
        metadata: {
          promptPreview: 'short prompt',
          llmResponse: 'short response',
          toolOutput: 'tool result',
          rawOutput: 'final result',
        },
      });

      expect(() => {
        beforeLlmHandler(ctx);
        beforeToolHandler({ ...ctx, eventType: EventType.BEFORE_TOOL_CALL });
        afterToolHandler({ ...ctx, eventType: EventType.AFTER_TOOL_CALL });
        afterTurnHandler({ ...ctx, eventType: EventType.AFTER_TURN });
        taskCompleteHandler({ ...ctx, eventType: EventType.TASK_COMPLETE });
        sessionEndHandler({ ...ctx, eventType: EventType.SESSION_END });
      }).not.toThrow();
      expect(observationFactory).not.toHaveBeenCalled();
    } finally {
      restoreEnv('LANGFUSE_PUBLIC_KEY', originalPublicKey);
      restoreEnv('LANGFUSE_SECRET_KEY', originalSecretKey);
      __resetLangfuseTraceForTests();
    }
  });

  test('langfuse handlers map adapter metadata fields to observations', () => {
    const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;
    const observations = [];
    const observationFactory = vi.fn((name, attributes, options) => {
      const observation = createFakeObservation(name, attributes, options, observationFactory);
      observations.push(observation);
      return observation;
    });

    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    __setObservationFactoryForTests(observationFactory);

    try {
      const baseCtx = createHookContext({
        eventType: EventType.BEFORE_LLM,
        sessionId: 's-mapping',
        turnNumber: 3,
        taskName: 'demo task',
        toolName: 'search',
        toolInput: { query: 'agent' },
        inputTokens: 11,
        outputTokens: 13,
        metadata: {
          promptPreview: 'preview prompt',
          llmResponse: 'llm answer',
          toolOutput: 'blocked result',
          guardrailDeny: true,
          denyReason: 'budget exceeded',
          rawOutput: 'raw final',
          taskDescription: 'write a demo',
        },
      });

      beforeLlmHandler(baseCtx);
      beforeToolHandler({ ...baseCtx, eventType: EventType.BEFORE_TOOL_CALL });
      afterToolHandler({ ...baseCtx, eventType: EventType.AFTER_TOOL_CALL });
      afterTurnHandler({ ...baseCtx, eventType: EventType.AFTER_TURN });
      taskCompleteHandler({ ...baseCtx, eventType: EventType.TASK_COMPLETE });

      const generation = observations.find((entry) => entry.options.asType === 'generation');
      const tool = observations.find((entry) => entry.options.asType === 'tool');
      const taskComplete = observations.find((entry) => entry.name === 'task-complete');

      expect(generation.attributes.input).toBe('preview prompt');
      expect(generation.updates.at(-1)).toMatchObject({
        output: 'llm answer',
        usageDetails: {
          input: 11,
          output: 13,
        },
      });
      expect(tool.updates.at(-1)).toMatchObject({
        output: {
          toolOutput: 'blocked result',
          denyReason: 'budget exceeded',
        },
        level: 'ERROR',
      });
      expect(taskComplete.attributes).toMatchObject({
        input: 'write a demo',
        output: 'raw final',
      });
    } finally {
      restoreEnv('LANGFUSE_PUBLIC_KEY', originalPublicKey);
      restoreEnv('LANGFUSE_SECRET_KEY', originalSecretKey);
      __resetLangfuseTraceForTests();
    }
  });

  test('hooks.yaml loads observability hooks as observe-only and strategies as gate-only', async () => {
    const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });

    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    try {
      await loader.loadFromDirectory('./shared-hooks', 'global');

      expect(registry.handlerCount(EventType.BEFORE_TURN)).toBe(2);
      expect(registry.handlerCount(EventType.AFTER_TOOL_CALL)).toBe(4);
      expect(registry.summary().before_turn).toEqual([
        '[global] structured-log.beforeTurnHandler',
        '[global] langfuse-trace.beforeTurnHandler',
      ]);

      await registry.dispatch(EventType.BEFORE_TURN, { sessionId: 's-load', turnNumber: 1 });
      await registry.dispatchGate(EventType.BEFORE_TURN, { sessionId: 's-load', turnNumber: 1 });
      expect(errorSpy).toHaveBeenCalledTimes(1);

      await registry.dispatch(EventType.AFTER_TOOL_CALL, {
        sessionId: 's-load',
        turnNumber: 1,
        toolName: 'search',
        success: false,
        metadata: { toolOutput: 'first' },
      });
      await registry.dispatchGate(EventType.AFTER_TOOL_CALL, {
        sessionId: 's-load',
        turnNumber: 1,
        toolName: 'search',
        success: false,
        metadata: { toolOutput: 'first' },
      });

      expect(loader.strategies['retry-tracker'].getMetrics().active_failures.search).toBe(1);
    } finally {
      errorSpy.mockRestore();
      restoreEnv('LANGFUSE_PUBLIC_KEY', originalPublicKey);
      restoreEnv('LANGFUSE_SECRET_KEY', originalSecretKey);
      __resetLangfuseTraceForTests();
    }
  });
});

function createFakeObservation(name, attributes, options, observationFactory) {
  return {
    name,
    attributes,
    options,
    updates: [],
    ended: false,
    update(fields) {
      this.updates.push(fields);
    },
    end() {
      this.ended = true;
    },
    startObservation(childName, childAttributes, childOptions) {
      return observationFactory(childName, childAttributes, childOptions);
    },
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
