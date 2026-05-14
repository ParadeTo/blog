import { EventType, createHookContext } from './registry.js'

const MAX_TEXT = 2000

function truncate(text, limit = MAX_TEXT) {
  const value = String(text ?? '')
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}... [truncated, ${value.length} chars total]`
}

export class AgentObservabilityAdapter {
  constructor(registry, { sessionId = '' } = {}) {
    this.registry = registry
    this.sessionId = sessionId
    this.turnCount = 0
    this.currentTurnHasLlm = false
    this.cleaned = false
    this.lastAgentRole = ''
    this.taskDescription = ''
    this.lastPromptPreview = ''
  }

  async beforeLlm({ agentId = '', taskDescription = '', messages = [], llm = {} } = {}) {
    this.lastAgentRole = agentId

    if (taskDescription && !this.taskDescription) {
      this.taskDescription = truncate(taskDescription)
    }

    if (!this.currentTurnHasLlm) {
      this.turnCount += 1
      this.currentTurnHasLlm = true
      await this.registry.dispatch(
        EventType.BEFORE_TURN,
        createHookContext({
          eventType: EventType.BEFORE_TURN,
          agentId,
          sessionId: this.sessionId,
          turnNumber: this.turnCount,
        }),
      )
    }

    const lastMessage = messages.at(-1)
    const content = typeof lastMessage === 'string' ? lastMessage : lastMessage?.content
    const preview = truncate(content ?? '', 500)
    const model = String(llm.model ?? process.env.LANGFUSE_HOOKS_AGENT_MODEL ?? 'gpt-5.4-nano-2026-03-17').split('/').at(-1)

    this.lastPromptPreview = preview

    await this.registry.dispatch(
      EventType.BEFORE_LLM,
      createHookContext({
        eventType: EventType.BEFORE_LLM,
        agentId,
        sessionId: this.sessionId,
        turnNumber: this.turnCount,
        metadata: { promptPreview: preview, model },
      }),
    )
  }

  async beforeToolCall({ toolName, toolInput = {} }) {
    await this.registry.dispatch(
      EventType.BEFORE_TOOL_CALL,
      createHookContext({
        eventType: EventType.BEFORE_TOOL_CALL,
        toolName,
        toolInput: { ...toolInput },
        sessionId: this.sessionId,
        turnNumber: this.turnCount,
      }),
    )
  }

  async afterToolCall({
    toolName,
    toolInput = {},
    toolOutput = '',
    durationMs = 0,
    success = true,
    metadata = {},
  }) {
    await this.registry.dispatch(
      EventType.AFTER_TOOL_CALL,
      createHookContext({
        eventType: EventType.AFTER_TOOL_CALL,
        toolName,
        toolInput: { ...toolInput },
        durationMs,
        success,
        sessionId: this.sessionId,
        turnNumber: this.turnCount,
        metadata: {
          ...metadata,
          toolOutput: truncate(toolOutput),
        },
      }),
    )
  }

  async afterTurn({
    agentId = this.lastAgentRole,
    toolName = '',
    output = '',
    llmResponse = '',
    inputTokens = 0,
    outputTokens = 0,
  } = {}) {
    await this.registry.dispatch(
      EventType.AFTER_TURN,
      createHookContext({
        eventType: EventType.AFTER_TURN,
        sessionId: this.sessionId,
        turnNumber: this.turnCount,
        agentId,
        toolName,
        inputTokens,
        outputTokens,
        metadata: {
          output: truncate(output),
          llmResponse: truncate(llmResponse),
          promptPreview: this.lastPromptPreview,
        },
      }),
    )

    this.currentTurnHasLlm = false
    this.lastPromptPreview = ''
  }

  async taskComplete({ rawOutput = '', description = '' } = {}) {
    const taskDescription = description || this.taskDescription

    await this.registry.dispatch(
      EventType.TASK_COMPLETE,
      createHookContext({
        eventType: EventType.TASK_COMPLETE,
        sessionId: this.sessionId,
        taskName: truncate(taskDescription, 500),
        agentId: this.lastAgentRole,
        metadata: {
          rawOutput: truncate(rawOutput),
          taskDescription: truncate(taskDescription, 500),
        },
      }),
    )
  }

  async cleanup() {
    if (this.cleaned) return
    this.cleaned = true

    await this.registry.dispatch(
      EventType.SESSION_END,
      createHookContext({
        eventType: EventType.SESSION_END,
        sessionId: this.sessionId,
      }),
    )
  }
}
