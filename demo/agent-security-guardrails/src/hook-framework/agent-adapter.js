import { EventType } from './registry.js';

export class AgentSecurityAdapter {
  constructor({ registry, sessionId = `sess_${Date.now()}` } = {}) {
    if (!registry) {
      throw new Error('registry is required');
    }
    this.registry = registry;
    this.sessionId = sessionId;
    this.turnNumber = 0;
  }

  async beforeToolCall({ toolName, toolInput = {} }) {
    const context = {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      toolName,
      toolInput,
    };
    await this.registry.dispatch(EventType.BEFORE_TOOL_CALL, context);
    await this.registry.dispatchGate(EventType.BEFORE_TOOL_CALL, context);
  }

  async afterToolCall({ toolName, toolInput = {}, success = true, output = '', metadata = {} }) {
    const context = {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      toolName,
      toolInput,
      success,
      metadata: {
        ...metadata,
        toolOutput: output,
      },
    };
    await this.registry.dispatch(EventType.AFTER_TOOL_CALL, context);
    await this.registry.dispatchGate(EventType.AFTER_TOOL_CALL, context);
  }

  async sessionEnd(metadata = {}) {
    const context = {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      metadata,
    };
    await this.registry.dispatch(EventType.SESSION_END, context);
    await this.registry.dispatchGate(EventType.SESSION_END, context);
  }
}
