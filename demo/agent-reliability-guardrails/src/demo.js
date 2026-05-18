import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import dotenv from 'dotenv';

import { runRealAgent, defaultChatClient } from './agent/real-agent.js';
import { buildBootstrapPrompt, loadSkillRegistry } from './agent/skill-loader.js';
import { AgentObservabilityAdapter } from './hook-framework/agent-adapter.js';
import { HookLoader } from './hook-framework/loader.js';
import { GuardrailDeny, HookRegistry } from './hook-framework/registry.js';
import { shutdownLangfuseSdk, startLangfuseSdk } from './instrumentation.js';

export const DEMO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORKSPACE_DIR = path.join(DEMO_DIR, 'workspace/demo-agent');
export const SKILLS_DIR = path.join(WORKSPACE_DIR, 'skills');
export const SHARED_HOOKS_DIR = path.join(DEMO_DIR, 'shared-hooks');
export const DEFAULT_TASK = '请根据当前上下文写一份简洁的 Agent 护栏可靠性设计文档。';

dotenv.config({
  path: path.join(DEMO_DIR, '.env'),
  override: true,
  quiet: true,
});

export function makeSessionId(date = new Date()) {
  const parts = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ];

  return `sess_${parts.join('')}`;
}

export function resolveLlmConfig(env = process.env) {
  const apiKey = env.OPENAI_API_KEY ?? env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY or ANTHROPIC_API_KEY is required');
  }

  return {
    apiKey,
    baseUrl: env.OPENAI_API_BASE ?? env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: env.AGENT_MODEL ?? env.OPENAI_MODEL ?? 'gpt-4o-mini',
  };
}

export function printMetrics(strategies, logger = console.log) {
  for (const [name, strategy] of Object.entries(strategies ?? {})) {
    if (typeof strategy.getMetrics !== 'function') {
      continue;
    }

    logger(`Metrics: ${name}`);
    logger(JSON.stringify(strategy.getMetrics(), null, 2));
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const task = argv.join(' ').trim() || DEFAULT_TASK;
  const sessionId = makeSessionId();
  let adapter = { cleanup: async () => {} };
  let loader;

  try {
    await startLangfuseSdk(env);

    const registry = new HookRegistry();
    loader = new HookLoader(registry);
    await loader.loadTwoLayers(SHARED_HOOKS_DIR, WORKSPACE_DIR);

    const strategies = loader.strategies;
    const llmConfig = resolveLlmConfig(env);
    const scenario = env.GUARDRAIL_SCENARIO ?? 'default';
    const backstory = await buildBootstrapPrompt(WORKSPACE_DIR);
    const skillRegistry = await loadSkillRegistry(SKILLS_DIR);
    const taskDescription = buildTaskDescription({
      task,
      scenario,
      backstory,
      skillRegistry,
    });

    console.log(`Session: ${sessionId}`);
    console.log(`Handlers: ${countHandlers(registry.summary())}`);
    console.log(`Strategies: ${Object.keys(strategies).join(', ')}`);

    adapter = new AgentObservabilityAdapter({
      registry,
      agentId: 'demo-agent',
      taskName: 'guardrails-demo',
      taskDescription,
      sessionId,
      model: llmConfig.model,
    });

    const { result, designDocPath } = await runRealAgent({
      taskDescription,
      registry,
      adapter,
      model: llmConfig.model,
      workspaceDir: WORKSPACE_DIR,
      skillsDir: SKILLS_DIR,
      chatClient: (request) =>
        defaultChatClient({
          ...request,
          ...llmConfig,
        }),
    });

    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('Design doc:');
    console.log(await fs.readFile(designDocPath, 'utf8'));
  } catch (error) {
    if (error instanceof GuardrailDeny) {
      console.error(`Guardrail triggered: ${error.reason}`);
      return;
    }

    throw error;
  } finally {
    await adapter.cleanup();

    if (loader) {
      printMetrics(loader.strategies);
    }

    console.log(`Langfuse URL: ${langfuseUrl(env)}`);
    await shutdownLangfuseSdk();
  }
}

export function buildTaskDescription({ task, scenario, backstory, skillRegistry }) {
  const skillList = Object.values(skillRegistry)
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join('\n');

  return [
    backstory,
    '',
    '## Skills',
    skillList,
    '',
    '## Scenario',
    scenario,
    '',
    '## Task',
    task,
  ].join('\n');
}

function countHandlers(summary) {
  return Object.values(summary).reduce((count, handlers) => count + handlers.length, 0);
}

function langfuseUrl(env) {
  return env.LANGFUSE_BASE_URL ?? env.LANGFUSE_BASEURL ?? 'https://cloud.langfuse.com';
}

function pad(value) {
  return String(value).padStart(2, '0');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
