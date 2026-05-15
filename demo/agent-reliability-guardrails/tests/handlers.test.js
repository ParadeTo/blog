import { describe, expect, test, vi } from 'vitest';

import { EventType, createHookContext } from '../src/hook-framework/registry.js';
import { beforeTurnHandler } from '../shared-hooks/structured-log.js';

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
});
