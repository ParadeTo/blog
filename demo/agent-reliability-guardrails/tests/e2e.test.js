import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

import { AgentObservabilityAdapter } from '../src/hook-framework/agent-adapter.js';
import { HookLoader } from '../src/hook-framework/loader.js';
import { HookRegistry } from '../src/hook-framework/registry.js';
import { SHARED_HOOKS_DIR, WORKSPACE_DIR } from '../src/demo.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.resolve(testDir, '..');

describe('guardrails demo e2e wiring', () => {
  test('loads shared and workspace hooks, records a turn, and exposes core strategies', async () => {
    expect(SHARED_HOOKS_DIR).toBe(path.join(demoDir, 'shared-hooks'));
    expect(WORKSPACE_DIR).toBe(path.join(demoDir, 'workspace/demo-agent'));

    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });

    await loader.loadTwoLayers(SHARED_HOOKS_DIR, WORKSPACE_DIR);

    const adapter = new AgentObservabilityAdapter({
      registry,
      agentId: 'demo-agent',
      taskName: 'e2e-test',
      taskDescription: 'verify guardrail hook wiring',
      sessionId: 'sess_20260518123456',
      model: 'gpt-4o-mini',
    });

    try {
      await adapter.afterTurn({
        output: '{"ok":true}',
        llmResponse: '{"ok":true}',
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
        },
      });
    } finally {
      await adapter.cleanup();
    }

    expect(Object.keys(loader.strategies).sort()).toEqual([
      'cost-guard',
      'loop-detector',
      'retry-tracker',
    ]);
    expect(loader.strategies['cost-guard'].getMetrics()).toMatchObject({
      total_input_tokens: 120,
      total_output_tokens: 30,
    });
  });
});
