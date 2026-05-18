import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

import { runRealAgent } from '../src/agent/real-agent.js';
import { AgentObservabilityAdapter } from '../src/hook-framework/agent-adapter.js';
import { HookLoader } from '../src/hook-framework/loader.js';
import { HookRegistry } from '../src/hook-framework/registry.js';
import {
  applyDemoProviderEnv,
  applyCommandEnvOverrides,
  createScenarioChatClient,
  main,
  resolveLlmConfig,
  SHARED_HOOKS_DIR,
  SKILLS_DIR,
  WORKSPACE_DIR,
} from '../src/demo.js';
import { resolveLangfuseEnvironment } from '../src/instrumentation.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.resolve(testDir, '..');
const outputDir = path.join(WORKSPACE_DIR, 'output');

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

  test('importing demo module does not run main or require API keys', async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const demoUrl = pathToFileURL(path.join(demoDir, 'src/demo.js')).href;
      const imported = await import(`${demoUrl}?import-guard=${Date.now()}`);

      expect(imported.DEFAULT_TASK).toBeTruthy();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
      if (originalAnthropicKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      }
      log.mockRestore();
      error.mockRestore();
    }
  });

  test('runtime command env overrides do not replace provider config from .env aliases', () => {
    const targetEnv = {
      AGENT_MODEL: 'outer-shell-model',
      COST_GUARD_BUDGET: '1',
      LANGFUSE_PUBLIC_KEY: '',
      OPENAI_API_BASE: 'https://outer-shell.example/v1',
      OPENAI_API_KEY: 'env-file-provider-key',
      OPENAI_BASE_URL: 'https://env-file.example/v1',
      OPENAI_MODEL: 'env-file-model',
    };
    const demoEnv = {
      OPENAI_API_KEY: 'env-file-provider-key',
      OPENAI_BASE_URL: 'https://env-file.example/v1',
      OPENAI_MODEL: 'env-file-model',
    };
    const commandLineEnv = {
      AGENT_MODEL: 'outer-shell-model',
      OPENAI_API_KEY: 'outer-shell-provider-key',
      OPENAI_API_BASE: 'https://outer-shell.example/v1',
      COST_GUARD_BUDGET: '0.0005',
      LANGFUSE_PUBLIC_KEY: 'dummy-public-key',
    };

    applyDemoProviderEnv(targetEnv, demoEnv);
    applyCommandEnvOverrides(targetEnv, commandLineEnv);

    expect(targetEnv).toMatchObject({
      OPENAI_API_KEY: 'env-file-provider-key',
      OPENAI_BASE_URL: 'https://env-file.example/v1',
      OPENAI_MODEL: 'env-file-model',
      COST_GUARD_BUDGET: '0.0005',
      LANGFUSE_PUBLIC_KEY: 'dummy-public-key',
    });
    expect(targetEnv).not.toHaveProperty('AGENT_MODEL');
    expect(targetEnv).not.toHaveProperty('OPENAI_API_BASE');
    expect(resolveLlmConfig(targetEnv)).toMatchObject({
      apiKey: 'env-file-provider-key',
      baseUrl: 'https://env-file.example/v1',
      model: 'env-file-model',
    });
  });

  test('LLM config falls through blank provider aliases', () => {
    expect(resolveLlmConfig({
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: 'anthropic-key',
      OPENAI_API_BASE: '',
      OPENAI_BASE_URL: 'https://openai-compatible.example/v1',
      AGENT_MODEL: '',
      OPENAI_MODEL: 'model-from-alias',
    })).toMatchObject({
      apiKey: 'anthropic-key',
      baseUrl: 'https://openai-compatible.example/v1',
      model: 'model-from-alias',
    });
  });

  test('loop scenario deterministically triggers the loop detector', async () => {
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });
    await loader.loadTwoLayers(SHARED_HOOKS_DIR, WORKSPACE_DIR);
    const adapter = new AgentObservabilityAdapter({
      registry,
      sessionId: 'sess_20260518130000',
      taskName: 'loop-scenario',
      taskDescription: 'trigger deterministic loop',
    });

    await expect(
      runRealAgent({
        taskDescription: 'trigger deterministic loop',
        registry,
        adapter,
        workspaceDir: WORKSPACE_DIR,
        skillsDir: SKILLS_DIR,
        chatClient: createScenarioChatClient('loop', vi.fn()),
      }),
    ).rejects.toMatchObject({
      name: 'GuardrailDeny',
      reason: expect.stringContaining('Loop detected'),
    });
    expect(loader.strategies['loop-detector'].getMetrics()).toMatchObject({
      loop_detections: 1,
      total_tool_calls: 3,
    });
  });

  test('retry scenario deterministically records retry recovery', async () => {
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });
    await loader.loadTwoLayers(SHARED_HOOKS_DIR, WORKSPACE_DIR);
    const adapter = new AgentObservabilityAdapter({
      registry,
      sessionId: 'sess_20260518130500',
      taskName: 'retry-scenario',
      taskDescription: 'trigger deterministic retry',
    });

    const result = await runRealAgent({
      taskDescription: 'trigger deterministic retry',
      registry,
      adapter,
      workspaceDir: WORKSPACE_DIR,
      skillsDir: SKILLS_DIR,
      continueOnToolError: true,
      chatClient: createScenarioChatClient('retry', vi.fn()),
    });

    expect(result.result).toMatchObject({ scenario: 'retry', ok: true });
    expect(loader.strategies['retry-tracker'].getMetrics()).toMatchObject({
      successful_retries: 1,
      active_failures: {
        flaky_tool: 0,
      },
    });
  });

  test('main retry scenario completes without OpenAI key and prints result plus metrics', async () => {
    await fs.rm(path.join(outputDir, 'design_doc.md'), { force: true });
    await fs.rm(path.join(outputDir, 'task-audit.jsonl'), { force: true });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let lines = [];
    let errorText = '';

    try {
      await expect(
        main([], {
          GUARDRAIL_SCENARIO: 'retry',
          LANGFUSE_PUBLIC_KEY: 'test-public-key',
          LANGFUSE_SECRET_KEY: 'test-secret-key',
          LANGFUSE_EXPORT_MODE: 'immediate',
        }),
      ).resolves.toBeUndefined();
      lines = log.mock.calls.map((entry) => entry.join(' '));
      errorText = error.mock.calls.flat().join('\n');
    } finally {
      log.mockRestore();
      error.mockRestore();
      await fs.rm(path.join(outputDir, 'design_doc.md'), { force: true });
      await fs.rm(path.join(outputDir, 'task-audit.jsonl'), { force: true });
    }

    expect(lines).toContain('Result:');
    expect(lines.join('\n')).toContain('"scenario": "retry"');
    expect(lines).toContain('Design doc:');
    expect(lines.join('\n')).toContain('Retry Scenario Design Doc');
    expect(lines.join('\n')).toContain('Metrics: retry-tracker');
    expect(errorText).not.toContain('Guardrail triggered:');
  });

  test('default scenario delegates to fallback chat client', async () => {
    const fallback = vi.fn().mockResolvedValue({ content: '{"ok":true}' });
    const client = createScenarioChatClient('', fallback);
    const response = await client({ model: 'demo' });

    expect(response).toEqual({ content: '{"ok":true}' });
    expect(fallback).toHaveBeenCalledWith({ model: 'demo' });
  });

  test('Langfuse environment resolves tracing alias from env example', () => {
    expect(resolveLangfuseEnvironment({
      LANGFUSE_TRACING_ENVIRONMENT: 'local',
    })).toBe('local');
    expect(resolveLangfuseEnvironment({
      LANGFUSE_ENVIRONMENT: 'prod',
      LANGFUSE_TRACING_ENVIRONMENT: 'local',
    })).toBe('prod');
  });
});
