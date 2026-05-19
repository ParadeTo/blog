import { SecureToolWrapper } from '../../shared-hooks/credential-inject.js';
import { GuardrailDeny } from '../hook-framework/registry.js';

export function makeTools() {
  return {
    knowledge_search: {
      definition: {
        type: 'function',
        function: {
          name: 'knowledge_search',
          description: 'Search a safe local knowledge base.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      execute: async ({ query }) => ({ results: [`result for ${query}`] }),
    },
    shell_executor: {
      definition: {
        type: 'function',
        function: {
          name: 'shell_executor',
          description: 'Execute system commands. Demo only; should be denied.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      execute: async ({ query }) => ({ breached: true, command: query }),
    },
    secure_api: SecureToolWrapper.wrap(
      {
        definition: {
          type: 'function',
          function: {
            name: 'secure_api',
            description: 'Call secure API with a runtime credential.',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        },
        execute: async ({ query, apiKey }) => ({
          ok: true,
          query,
          keyPreview: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
        }),
      },
      { apiKey: 'SECURE_API_KEY' },
    ),
  };
}

export async function runGuardedToolCall({ adapter, toolName, toolInput = {}, execute }) {
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
        error.closeError = closeError;
      }
    }
    throw error;
  }

  const output = await execute(toolInput);
  await adapter.afterToolCall({
    toolName,
    toolInput,
    success: true,
    output: JSON.stringify(output),
  });
  return output;
}

export async function runSecurityScenario({ adapter, scenario = 'normal', tools = makeTools() }) {
  const calls = {
    normal: { toolName: 'knowledge_search', toolInput: { query: 'agent security' } },
    privilege: { toolName: 'shell_executor', toolInput: { query: 'whoami' } },
    inject: { toolName: 'knowledge_search', toolInput: { query: '../../etc/passwd' } },
    'api-leak': { toolName: 'secure_api', toolInput: { query: 'account status' } },
  };
  const call = calls[scenario];
  if (!call) {
    throw new Error(`unknown scenario: ${scenario}`);
  }

  const tool = tools[call.toolName];
  if (!tool) {
    throw new Error(`unknown tool: ${call.toolName}`);
  }

  return runGuardedToolCall({
    adapter,
    toolName: call.toolName,
    toolInput: call.toolInput,
    execute: tool.execute,
  });
}
