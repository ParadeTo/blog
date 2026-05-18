import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { GuardrailDeny } from '../src/hook-framework/registry.js';
import { AgentObservabilityAdapter } from '../src/hook-framework/agent-adapter.js';
import {
  defaultChatClient,
  parseToolArguments,
  runGuardedToolCall,
  runRealAgent,
} from '../src/agent/real-agent.js';

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('real agent loop', () => {
  test('loads the design SOP, writes the design doc, and returns the final JSON result', async () => {
    const outputDir = await makeTempDir();
    const calls = [];
    const chatClient = vi
      .fn()
      .mockImplementationOnce(async () => ({
        content: '',
        toolCalls: [
          toolCall('call-1', 'skill_loader', { skill_name: 'sop_design' }),
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      }))
      .mockImplementationOnce(async () => ({
        content: '',
        toolCalls: [
          toolCall('call-2', 'write_design_doc', {
            content: '# 短链接服务设计\n\n短链接服务需要生成、跳转和观测能力。',
          }),
        ],
        usage: { input_tokens: 110, output_tokens: 30 },
      }))
      .mockImplementationOnce(async () => ({
        content: JSON.stringify({ errcode: 0, file_path: 'output/design_doc.md' }),
        toolCalls: [],
        usage: { input_tokens: 80, output_tokens: 15 },
      }));

    const result = await runRealAgent({
      taskDescription: '为短链接服务写一份技术设计文档',
      chatClient: async (request) => {
        calls.push(request);
        return chatClient(request);
      },
      outputDir,
    });

    expect(chatClient).toHaveBeenCalledTimes(3);
    expect(calls[0].messages.at(-1).content).toContain('为短链接服务写一份技术设计文档');
    expect(calls[1].messages.at(-1)).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-1',
      name: 'skill_loader',
    });
    expect(calls[2].messages.at(-1)).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-2',
      name: 'write_design_doc',
    });
    expect(calls[2].messages.at(-1).content).not.toContain('absolute_path');
    expect(result.result.errcode).toBe(0);
    expect(result.designDocPath).toBe(path.join(outputDir, 'design_doc.md'));
    await expect(fs.readFile(result.designDocPath, 'utf8')).resolves.toContain('短链接服务');
  });

  test('runGuardedToolCall emits afterToolCall when beforeToolCall denies', async () => {
    const deny = new GuardrailDeny('tool blocked', { guardrail: 'test_guard' });
    const adapter = {
      beforeToolCall: vi.fn(async () => {
        throw deny;
      }),
      afterToolCall: vi.fn(),
    };
    const tool = vi.fn(async () => 'should not run');

    await expect(
      runGuardedToolCall({
        adapter,
        toolName: 'write_design_doc',
        toolInput: { content: 'blocked' },
        execute: tool,
      }),
    ).rejects.toBe(deny);

    expect(tool).not.toHaveBeenCalled();
    expect(adapter.afterToolCall).toHaveBeenCalledWith({
      toolName: 'write_design_doc',
      toolInput: { content: 'blocked' },
      success: false,
      output: '',
      metadata: {
        guardrailDeny: true,
        denyReason: 'tool blocked',
        deniedBeforeExecution: true,
      },
    });
  });

  test('runGuardedToolCall does not convert afterToolCall denial into tool failure', async () => {
    const deny = new GuardrailDeny('after tool blocked', { guardrail: 'loop_detector' });
    const adapter = {
      beforeToolCall: vi.fn(),
      afterToolCall: vi.fn(async () => {
        throw deny;
      }),
    };
    const tool = vi.fn(async () => ({ ok: true }));

    await expect(
      runGuardedToolCall({
        adapter,
        toolName: 'repeat_state',
        toolInput: { value: 'same' },
        execute: tool,
      }),
    ).rejects.toBe(deny);

    expect(tool).toHaveBeenCalledOnce();
    expect(adapter.afterToolCall).toHaveBeenCalledTimes(1);
    expect(adapter.afterToolCall).toHaveBeenCalledWith({
      toolName: 'repeat_state',
      toolInput: { value: 'same' },
      success: true,
      output: JSON.stringify({ ok: true }),
    });
  });

  test('runGuardedToolCall preserves beforeToolCall denial when close also denies', async () => {
    const beforeDeny = new GuardrailDeny('before blocked', { guardrail: 'cost_guard' });
    const closeDeny = new GuardrailDeny('close blocked', { guardrail: 'loop_detector' });
    const adapter = {
      beforeToolCall: vi.fn(async () => {
        throw beforeDeny;
      }),
      afterToolCall: vi.fn(async () => {
        throw closeDeny;
      }),
    };
    const tool = vi.fn(async () => 'should not run');

    await expect(
      runGuardedToolCall({
        adapter,
        toolName: 'write_design_doc',
        toolInput: { content: 'blocked' },
        execute: tool,
      }),
    ).rejects.toBe(beforeDeny);

    expect(tool).not.toHaveBeenCalled();
    expect(adapter.afterToolCall).toHaveBeenCalledTimes(1);
    expect(beforeDeny.metadata.afterToolCallError).toMatchObject({
      reason: 'close blocked',
    });
  });

  test('runRealAgent emits failed afterToolCall for malformed tool-call JSON', async () => {
    const adapter = createFakeAdapter();
    const outputDir = await makeTempDir();
    const chatClient = vi.fn(async () => ({
      content: '',
      toolCalls: [
        {
          id: 'bad-json',
          type: 'function',
          function: {
            name: 'skill_loader',
            arguments: '{bad json',
          },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 3 },
    }));

    await expect(
      runRealAgent({
        taskDescription: '为短链接服务写设计文档',
        chatClient,
        adapter,
        outputDir,
        maxIterations: 1,
      }),
    ).rejects.toThrow(/invalid tool arguments JSON/i);

    expect(adapter.afterToolCall).toHaveBeenCalledWith({
      toolName: 'skill_loader',
      toolInput: {},
      success: false,
      output: expect.stringContaining('invalid tool arguments JSON'),
      metadata: {
        errorMessage: expect.stringContaining('invalid tool arguments JSON'),
      },
    });
  });

  test('defaultChatClient supports OPENAI_API_BASE while keeping OPENAI_BASE_URL alias', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalApiBase = process.env.OPENAI_API_BASE;
    const originalBaseUrl = process.env.OPENAI_BASE_URL;
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"errcode":0}', tool_calls: [] } }],
        usage: {},
      }),
    }));

    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_API_BASE = 'https://openai-compatible.example/v1/';
    delete process.env.OPENAI_BASE_URL;

    try {
      await defaultChatClient({
        messages: [],
        tools: [],
        fetchImpl,
      });

      expect(fetchImpl.mock.calls[0][0]).toBe(
        'https://openai-compatible.example/v1/chat/completions',
      );
    } finally {
      restoreEnv('OPENAI_API_KEY', originalApiKey);
      restoreEnv('OPENAI_API_BASE', originalApiBase);
      restoreEnv('OPENAI_BASE_URL', originalBaseUrl);
    }
  });

  test('parseToolArguments rejects non-object JSON values', () => {
    expect(() => parseToolArguments('null')).toThrow(/tool arguments must be a JSON object/i);
    expect(() => parseToolArguments('[]')).toThrow(/tool arguments must be a JSON object/i);
  });
});

describe('AgentObservabilityAdapter', () => {
  test('dispatches observe and gate events without double-running gate-only strategies', async () => {
    const events = [];
    const registry = {
      dispatch: vi.fn(async (eventType, context) => {
        events.push(['observe', eventType, context]);
      }),
      dispatchGate: vi.fn(async (eventType, context) => {
        events.push(['gate', eventType, context]);
      }),
    };
    const adapter = new AgentObservabilityAdapter({
      registry,
      agentId: 'demo-agent',
      taskName: 'design',
      taskDescription: '为短链接服务写设计文档',
      sessionId: 'session-1',
      model: 'gpt-test',
    });

    await adapter.beforeLlm({
      messages: [{ role: 'user', content: '为短链接服务写设计文档' }],
    });
    await adapter.beforeToolCall({
      toolName: 'skill_loader',
      toolInput: { skill_name: 'sop_design' },
    });
    await adapter.afterToolCall({
      toolName: 'skill_loader',
      toolInput: { skill_name: 'sop_design' },
      success: true,
      output: 'SOP content',
    });
    await adapter.afterTurn({
      output: 'turn output',
      llmResponse: 'llm response',
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    await adapter.taskComplete({ rawOutput: '{"errcode":0}' });
    await adapter.cleanup();
    await adapter.cleanup();

    expect(events.map(([mode, eventType]) => [mode, eventType])).toEqual([
      ['observe', 'before_turn'],
      ['observe', 'before_llm'],
      ['observe', 'before_tool_call'],
      ['gate', 'before_tool_call'],
      ['observe', 'after_tool_call'],
      ['gate', 'after_tool_call'],
      ['observe', 'after_turn'],
      ['gate', 'after_turn'],
      ['observe', 'task_complete'],
      ['observe', 'session_end'],
    ]);
    expect(registry.dispatchGate).not.toHaveBeenCalledWith('before_llm', expect.anything());
    expect(events[1][2].metadata).toMatchObject({
      model: 'gpt-test',
      promptPreview: '为短链接服务写设计文档',
    });
    expect(events[4][2].metadata).toMatchObject({
      toolOutput: 'SOP content',
      guardrailDeny: false,
    });
    expect(events[6][2]).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      metadata: {
        output: 'turn output',
        llmResponse: 'llm response',
        promptPreview: '为短链接服务写设计文档',
      },
    });
    expect(events[8][2].metadata).toMatchObject({
      rawOutput: '{"errcode":0}',
      taskDescription: '为短链接服务写设计文档',
    });
    expect(registry.dispatch).toHaveBeenCalledTimes(7);
    expect(registry.dispatchGate).toHaveBeenCalledTimes(3);
  });

  test('afterTurn resets turn state even when gate denies', async () => {
    const deny = new GuardrailDeny('budget exceeded');
    const registry = {
      dispatch: vi.fn(),
      dispatchGate: vi.fn(async () => {
        throw deny;
      }),
    };
    const adapter = new AgentObservabilityAdapter({
      registry,
      sessionId: 'session-reset',
    });

    await adapter.beforeLlm({
      messages: [{ role: 'user', content: 'first prompt' }],
    });
    await expect(
      adapter.afterTurn({
        output: 'blocked',
        llmResponse: 'blocked',
      }),
    ).rejects.toBe(deny);
    await adapter.beforeLlm({
      messages: [{ role: 'user', content: 'second prompt' }],
    });

    expect(registry.dispatch.mock.calls.map(([eventType]) => eventType)).toEqual([
      'before_turn',
      'before_llm',
      'after_turn',
      'before_turn',
      'before_llm',
    ]);
    expect(registry.dispatch.mock.calls.at(-1)[1].metadata.promptPreview).toBe('second prompt');
  });
});

function toolCall(id, name, args) {
  return {
    id,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-loop-'));
  tempDirs.push(dir);
  return dir;
}

function createFakeAdapter() {
  return {
    beforeLlm: vi.fn(),
    beforeToolCall: vi.fn(),
    afterToolCall: vi.fn(),
    afterTurn: vi.fn(),
    taskComplete: vi.fn(),
    cleanup: vi.fn(),
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
