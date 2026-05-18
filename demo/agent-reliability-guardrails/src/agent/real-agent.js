import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OutputSandbox } from './sandbox.js';
import { loadSkillContent, loadSkillRegistry } from './skill-loader.js';
import { AgentObservabilityAdapter } from '../hook-framework/agent-adapter.js';
import { GuardrailDeny, HookRegistry } from '../hook-framework/registry.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(moduleDir, '../..');
const defaultWorkspaceDir = path.join(demoRoot, 'workspace/demo-agent');
const defaultSkillsDir = path.join(defaultWorkspaceDir, 'skills');
const defaultOutputDir = path.join(defaultWorkspaceDir, 'output');

export async function defaultChatClient({
  messages,
  tools,
  model = process.env.AGENT_MODEL ?? 'gpt-4o-mini',
  apiKey = process.env.OPENAI_API_KEY,
  baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is required');
  }

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`chat completion failed: ${response.status} ${detail}`);
  }

  return normalizeChatResponse(await response.json());
}

export async function makeTools({
  skillsDir = defaultSkillsDir,
  outputDir = defaultOutputDir,
} = {}) {
  const skillRegistry = await loadSkillRegistry(skillsDir);
  const outputSandbox = new OutputSandbox({ outputDir });
  let repeatValue = '';
  let flakyAttempts = 0;

  return {
    skill_loader: {
      definition: {
        type: 'function',
        function: {
          name: 'skill_loader',
          description: 'Load a named skill instruction from the controlled skill registry.',
          parameters: {
            type: 'object',
            properties: {
              skill_name: { type: 'string' },
            },
            required: ['skill_name'],
          },
        },
      },
      execute: async ({ skill_name: skillName }) => loadSkillContent(skillsDir, skillRegistry, skillName),
    },
    write_design_doc: {
      definition: {
        type: 'function',
        function: {
          name: 'write_design_doc',
          description: 'Write the final design document into output/design_doc.md.',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string' },
            },
            required: ['content'],
          },
        },
      },
      execute: async ({ content }) => {
        const filePath = await outputSandbox.writeOutput('design_doc.md', String(content ?? ''));
        return {
          errcode: 0,
          file_path: 'output/design_doc.md',
          absolute_path: filePath,
        };
      },
    },
    repeat_state: {
      definition: {
        type: 'function',
        function: {
          name: 'repeat_state',
          description: 'Return a repeated state string for loop guardrail demonstrations.',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          },
        },
      },
      execute: async ({ value = repeatValue }) => {
        repeatValue = String(value ?? repeatValue);
        return { state: repeatValue };
      },
    },
    flaky_tool: {
      definition: {
        type: 'function',
        function: {
          name: 'flaky_tool',
          description: 'Fail once and then recover for retry guardrail demonstrations.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      execute: async () => {
        flakyAttempts += 1;
        if (flakyAttempts === 1) {
          throw new Error('flaky tool failed');
        }
        return { ok: true, attempts: flakyAttempts };
      },
    },
  };
}

export function parseToolArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  if (typeof rawArguments === 'object') {
    return rawArguments;
  }

  try {
    return JSON.parse(rawArguments);
  } catch (error) {
    throw new Error(`invalid tool arguments JSON: ${error.message}`);
  }
}

export async function runGuardedToolCall({
  adapter,
  toolName,
  toolInput = {},
  execute,
}) {
  try {
    await adapter.beforeToolCall({ toolName, toolInput });
  } catch (error) {
    if (error instanceof GuardrailDeny) {
      await adapter.afterToolCall({
        toolName,
        toolInput,
        success: false,
        output: '',
        metadata: {
          guardrailDeny: true,
          denyReason: error.reason,
          deniedBeforeExecution: true,
        },
      });
    }
    throw error;
  }

  try {
    const output = await execute(toolInput);
    await adapter.afterToolCall({
      toolName,
      toolInput,
      success: true,
      output: serializeToolOutput(output),
    });
    return output;
  } catch (error) {
    const metadata = {
      errorMessage: error.message,
      guardrailDeny: error instanceof GuardrailDeny,
      denyReason: error instanceof GuardrailDeny ? error.reason : '',
    };

    await adapter.afterToolCall({
      toolName,
      toolInput,
      success: false,
      output: '',
      metadata,
    });
    throw error;
  }
}

export async function runRealAgent({
  taskDescription,
  chatClient = defaultChatClient,
  registry = new HookRegistry(),
  adapter,
  model = process.env.AGENT_MODEL ?? 'gpt-4o-mini',
  workspaceDir = defaultWorkspaceDir,
  skillsDir = path.join(workspaceDir, 'skills'),
  outputDir = path.join(workspaceDir, 'output'),
  maxIterations = 8,
} = {}) {
  if (!taskDescription) {
    throw new Error('taskDescription is required');
  }

  const agentAdapter =
    adapter ??
    new AgentObservabilityAdapter({
      registry,
      model,
      taskDescription,
      taskName: 'real-agent',
    });
  const tools = await makeTools({ skillsDir, outputDir });
  const messages = [
    {
      role: 'system',
      content:
        '你是一个受护栏保护的设计文档代理。需要先加载 sop_design，再写 output/design_doc.md，最后只返回 JSON。',
    },
    {
      role: 'user',
      content: taskDescription,
    },
  ];
  const toolDefinitions = Object.values(tools).map((tool) => tool.definition);
  let finalContent = '';

  try {
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      await agentAdapter.beforeLlm({ messages });
      const response = normalizeChatResponse(
        await chatClient({
          model,
          messages: cloneMessages(messages),
          tools: toolDefinitions,
          tool_choice: 'auto',
        }),
      );
      finalContent = response.content ?? '';

      messages.push({
        role: 'assistant',
        content: finalContent,
        tool_calls: response.toolCalls,
      });

      if (response.toolCalls.length === 0) {
        await agentAdapter.afterTurn({
          output: finalContent,
          llmResponse: finalContent,
          usage: response.usage,
        });
        await agentAdapter.taskComplete({ rawOutput: finalContent, taskDescription });

        const result = parseFinalResult(finalContent);
        return {
          result,
          designDocPath: path.join(outputDir, 'design_doc.md'),
        };
      }

      for (const call of response.toolCalls) {
        const toolName = call.function?.name ?? call.name;
        const tool = tools[toolName];

        if (!tool) {
          throw new Error(`unknown tool: ${toolName}`);
        }

        const toolInput = parseToolArguments(call.function?.arguments ?? call.arguments);
        const toolOutput = await runGuardedToolCall({
          adapter: agentAdapter,
          toolName,
          toolInput,
          execute: tool.execute,
        });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: serializeToolOutput(toolOutput),
        });
      }

      await agentAdapter.afterTurn({
        output: finalContent,
        llmResponse: finalContent,
        usage: response.usage,
      });
    }

    throw new Error(`max iterations exceeded: ${maxIterations}`);
  } finally {
    await agentAdapter.cleanup();
  }
}

function normalizeChatResponse(response) {
  const choice = response?.choices?.[0];
  const message = choice?.message;

  if (message) {
    return {
      content: message.content ?? '',
      toolCalls: message.tool_calls ?? [],
      usage: response.usage ?? {},
    };
  }

  return {
    content: response?.content ?? '',
    toolCalls: response?.toolCalls ?? response?.tool_calls ?? [],
    usage: response?.usage ?? {},
  };
}

function parseFinalResult(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`final response is not valid JSON: ${error.message}`);
  }
}

function serializeToolOutput(output) {
  if (typeof output === 'string') {
    return output;
  }

  return JSON.stringify(output);
}

function cloneMessages(messages) {
  return messages.map((message) => {
    if (!message.tool_calls) {
      return { ...message };
    }

    return {
      ...message,
      tool_calls: message.tool_calls.map((toolCall) => ({ ...toolCall })),
    };
  });
}
