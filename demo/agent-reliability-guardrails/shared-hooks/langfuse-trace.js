import { startObservation } from '@langfuse/tracing';

const sessions = new Map();
let observationFactory = startObservation;

function isEnabled() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

function sessionKey(ctx) {
  return ctx.sessionId ?? 'default';
}

function getState(ctx) {
  if (!isEnabled()) {
    return null;
  }

  const key = sessionKey(ctx);
  let state = sessions.get(key);

  if (!state) {
    const root = observationFactory(
      `session-${key}`,
      {
        metadata: {
          sessionId: ctx.sessionId ?? null,
          source: 'agent-reliability-guardrails',
        },
      },
      { asType: 'agent' },
    );

    state = {
      root,
      generation: null,
      tools: [],
    };
    sessions.set(key, state);
  }

  return state;
}

function startChild(parent, name, attributes, options) {
  if (typeof parent?.startObservation === 'function') {
    return parent.startObservation(name, attributes, options);
  }

  return observationFactory(name, attributes, options);
}

function updateObservation(observation, fields) {
  if (typeof observation?.update === 'function') {
    observation.update(fields);
  }
}

function endObservation(observation) {
  if (typeof observation?.end === 'function') {
    observation.end();
    return;
  }

  observation?.otelSpan?.end?.();
}

function usageDetails(ctx) {
  if (ctx.inputTokens === undefined && ctx.outputTokens === undefined) {
    return undefined;
  }

  return {
    input: Number(ctx.inputTokens ?? 0),
    output: Number(ctx.outputTokens ?? 0),
  };
}

export function beforeTurnHandler(ctx) {
  getState(ctx);
}

export function beforeLlmHandler(ctx) {
  const state = getState(ctx);
  if (!state) {
    return;
  }

  if (state.generation) {
    endObservation(state.generation);
  }

  state.generation = startChild(
    state.root,
    `turn-${ctx.turnNumber ?? 0}-generation`,
    {
      input: ctx.metadata?.promptPreview ?? ctx.metadata?.prompt,
      metadata: {
        sessionId: ctx.sessionId ?? null,
        turn: ctx.turnNumber ?? 0,
        agentId: ctx.agentId ?? '',
      },
    },
    { asType: 'generation' },
  );
}

export function beforeToolHandler(ctx) {
  const state = getState(ctx);
  if (!state) {
    return;
  }

  const parent = state.generation ?? state.root;
  const tool = startChild(
    parent,
    ctx.toolName || 'tool-call',
    {
      input: ctx.toolInput,
      metadata: {
        sessionId: ctx.sessionId ?? null,
        turn: ctx.turnNumber ?? 0,
        agentId: ctx.agentId ?? '',
      },
    },
    { asType: 'tool' },
  );

  state.tools.push({
    name: ctx.toolName || '',
    observation: tool,
  });
}

export function afterToolHandler(ctx) {
  const state = getState(ctx);
  if (!state) {
    return;
  }

  const index = findToolIndex(state.tools, ctx.toolName || '');
  if (index === -1) {
    return;
  }

  const [entry] = state.tools.splice(index, 1);
  updateObservation(entry.observation, {
    output: toolOutput(ctx),
    level: ctx.success === false || ctx.metadata?.guardrailDeny ? 'ERROR' : 'DEFAULT',
    metadata: {
      success: ctx.success !== false,
      durationMs: ctx.durationMs ?? 0,
      error: ctx.metadata?.error,
    },
  });
  endObservation(entry.observation);
}

export function afterTurnHandler(ctx) {
  const state = getState(ctx);
  if (!state?.generation) {
    return;
  }

  updateObservation(state.generation, {
    output: ctx.metadata?.llmResponse || ctx.metadata?.output,
    usageDetails: usageDetails(ctx),
    metadata: {
      turn: ctx.turnNumber ?? 0,
      durationMs: ctx.durationMs ?? 0,
    },
  });
  endObservation(state.generation);
  state.generation = null;
}

export function taskCompleteHandler(ctx) {
  const state = getState(ctx);
  if (!state) {
    return;
  }

  const observation = startChild(
    state.root,
    'task-complete',
    {
      input: ctx.metadata?.taskDescription || ctx.taskName,
      output: ctx.metadata?.rawOutput || ctx.metadata?.output,
      metadata: {
        sessionId: ctx.sessionId ?? null,
        taskName: ctx.taskName ?? '',
      },
    },
    { asType: 'event' },
  );

  endObservation(observation);
  updateObservation(state.root, {
    output: ctx.metadata?.rawOutput || ctx.metadata?.output,
  });
}

export function sessionEndHandler(ctx) {
  flushAndClose(ctx);
}

export function flushAndClose(ctx) {
  const key = sessionKey(ctx);
  const state = sessions.get(key);
  if (!state) {
    return;
  }

  if (state.generation) {
    endObservation(state.generation);
    state.generation = null;
  }

  while (state.tools.length > 0) {
    const entry = state.tools.pop();
    endObservation(entry.observation);
  }

  endObservation(state.root);
  sessions.delete(key);
}

function findToolIndex(tools, name) {
  for (let index = tools.length - 1; index >= 0; index -= 1) {
    if (tools[index].name === name) {
      return index;
    }
  }

  return -1;
}

function toolOutput(ctx) {
  if (!ctx.metadata?.guardrailDeny) {
    return ctx.metadata?.toolOutput ?? ctx.metadata?.output;
  }

  return {
    toolOutput: ctx.metadata?.toolOutput,
    denyReason: ctx.metadata?.denyReason ?? ctx.metadata?.reason ?? '',
  };
}

export function __setObservationFactoryForTests(factory) {
  observationFactory = factory;
}

export function __resetLangfuseTraceForTests() {
  for (const state of sessions.values()) {
    if (state.generation) {
      endObservation(state.generation);
    }

    for (const entry of state.tools) {
      endObservation(entry.observation);
    }

    endObservation(state.root);
  }

  sessions.clear();
  observationFactory = startObservation;
}
