import { describe, expect, test, vi } from 'vitest';

import { runGuardedToolCall } from '../src/agent/real-agent.js';
import { GuardrailDeny } from '../src/hook-framework/registry.js';

describe('guarded tool lifecycle', () => {
  test('does not execute tool when beforeToolCall denies', async () => {
    const execute = vi.fn();
    const adapter = {
      beforeToolCall: vi.fn(async () => {
        throw new GuardrailDeny('blocked before execution');
      }),
      afterToolCall: vi.fn(),
    };

    await expect(
      runGuardedToolCall({
        adapter,
        toolName: 'shell_executor',
        toolInput: { query: 'whoami' },
        execute,
      }),
    ).rejects.toThrow(GuardrailDeny);

    expect(execute).not.toHaveBeenCalled();
    expect(adapter.afterToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        metadata: expect.objectContaining({ deniedBeforeExecution: true }),
      }),
    );
  });
});
