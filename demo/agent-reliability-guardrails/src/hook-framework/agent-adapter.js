import { EventType, createHookContext } from './registry.js';

const DEFAULT_PREVIEW_CHARS = 500;

export class AgentObservabilityAdapter {
  constructor({
    registry,
    agentId = 'demo-agent',
    taskName = 'real-agent',
    taskDescription = '',
    sessionId = crypto.randomUUID(),
    model = process.env.AGENT_MODEL ?? 'gpt-4o-mini',
    previewChars = DEFAULT_PREVIEW_CHARS,
  } = {}) {
    if (!registry) {
      throw new Error('registry is required');
    }

    this.registry = registry;
    this.agentId = agentId;
    this.taskName = taskName;
    this.taskDescription = taskDescription;
    this.sessionId = sessionId;
    this.model = model;
    this.previewChars = previewChars;
    this.turnNumber = 0;
    this.turnStarted = false;
    this.sessionEnded = false;
    this.promptPreview = '';
  }

  async beforeLlm({ messages = [], prompt = '' } = {}) {
    this.promptPreview = preview(prompt || messagesToPrompt(messages), this.previewChars);

    if (!this.turnStarted) {
      this.turnNumber += 1;
      this.turnStarted = true;
      await this.observe(EventType.BEFORE_TURN);
    }

    await this.observe(EventType.BEFORE_LLM, {
      metadata: {
        promptPreview: this.promptPreview,
        model: this.model,
      },
    });
  }

  async beforeToolCall({ toolName, toolInput = {} } = {}) {
    const context = this.context({
      eventType: EventType.BEFORE_TOOL_CALL,
      toolName,
      toolInput,
    });

    await this.registry.dispatch(EventType.BEFORE_TOOL_CALL, context);
    await this.registry.dispatchGate(EventType.BEFORE_TOOL_CALL, context);
  }

  async afterToolCall({
    toolName,
    toolInput = {},
    success = true,
    output = '',
    metadata = {},
  } = {}) {
    const context = this.context({
      eventType: EventType.AFTER_TOOL_CALL,
      toolName,
      toolInput,
      success,
      metadata: {
        ...metadata,
        toolOutput: String(output ?? ''),
        guardrailDeny: Boolean(metadata.guardrailDeny),
        denyReason: metadata.denyReason ?? '',
      },
    });

    await this.registry.dispatch(EventType.AFTER_TOOL_CALL, context);
    await this.registry.dispatchGate(EventType.AFTER_TOOL_CALL, context);
  }

  async afterTurn({
    output = '',
    llmResponse = '',
    usage = {},
    inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0,
    outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0,
    metadata = {},
  } = {}) {
    const context = this.context({
      eventType: EventType.AFTER_TURN,
      inputTokens,
      outputTokens,
      metadata: {
        ...metadata,
        output: String(output ?? ''),
        llmResponse: String(llmResponse ?? ''),
        promptPreview: this.promptPreview,
      },
    });

    try {
      await this.registry.dispatch(EventType.AFTER_TURN, context);
      await this.registry.dispatchGate(EventType.AFTER_TURN, context);
    } finally {
      this.turnStarted = false;
      this.promptPreview = '';
    }
  }

  async taskComplete({ rawOutput = '', taskDescription = this.taskDescription } = {}) {
    await this.observe(EventType.TASK_COMPLETE, {
      metadata: {
        rawOutput: String(rawOutput ?? ''),
        taskDescription,
      },
    });
  }

  async cleanup() {
    if (this.sessionEnded) {
      return;
    }

    this.sessionEnded = true;
    await this.observe(EventType.SESSION_END);
  }

  async observe(eventType, fields = {}) {
    await this.registry.dispatch(eventType, this.context({ ...fields, eventType }));
  }

  context(fields = {}) {
    return createHookContext({
      agentId: this.agentId,
      taskName: this.taskName,
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      ...fields,
    });
  }
}

function messagesToPrompt(messages) {
  return messages
    .map((message) => message?.content)
    .filter((content) => typeof content === 'string' && content.length > 0)
    .join('\n');
}

function preview(value, limit) {
  return String(value ?? '').slice(0, limit);
}
