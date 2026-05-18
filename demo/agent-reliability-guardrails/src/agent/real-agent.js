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
  baseUrl = process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
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
        const contentText = String(content ?? '');
        await outputSandbox.writeOutput('design_doc.md', contentText);
        return {
          errcode: 0,
          file_path: 'output/design_doc.md',
          bytes: Buffer.byteLength(contentText, 'utf8'),
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
    assertPlainArgumentsObject(rawArguments);
    return rawArguments;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawArguments);
  } catch (error) {
    throw new Error(`invalid tool arguments JSON: ${error.message}`);
  }

  assertPlainArgumentsObject(parsed);
  return parsed;
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
      try {
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
      } catch (closeError) {
        attachCloseError(error, closeError);
      }
    }
    throw error;
  }

  let output;
  try {
    output = await execute(toolInput);
  } catch (error) {
    const metadata = {
      errorMessage: error.message,
      guardrailDeny: error instanceof GuardrailDeny,
      denyReason: error instanceof GuardrailDeny ? error.reason : '',
    };

    try {
      await adapter.afterToolCall({
        toolName,
        toolInput,
        success: false,
        output: error.message,
        metadata,
      });
    } catch (closeError) {
      attachCloseError(error, closeError);
    }
    throw error;
  }

  await adapter.afterToolCall({
    toolName,
    toolInput,
    success: true,
    output: serializeToolOutput(output),
  });
  return output;
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

        let toolInput;
        try {
          toolInput = parseToolArguments(call.function?.arguments ?? call.arguments);
        } catch (error) {
          await emitFailedToolParse(agentAdapter, toolName, error);
          throw error;
        }

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

function assertPlainArgumentsObject(value) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('tool arguments must be a JSON object');
  }
}

async function emitFailedToolParse(adapter, toolName, error) {
  try {
    await adapter.afterToolCall({
      toolName,
      toolInput: {},
      success: false,
      output: error.message,
      metadata: {
        errorMessage: error.message,
      },
    });
  } catch (closeError) {
    attachCloseError(error, closeError);
  }
}

function attachCloseError(originalError, closeError) {
  originalError.metadata = {
    ...(originalError.metadata ?? {}),
    afterToolCallError: summarizeError(closeError),
  };
  if (!originalError.cause) {
    originalError.cause = closeError;
  }
}

function summarizeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    reason: error?.reason,
    metadata: error?.metadata,
  };
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
