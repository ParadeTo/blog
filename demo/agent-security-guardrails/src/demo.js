import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { runSecurityScenario } from './agent/real-agent.js';
import { AgentSecurityAdapter } from './hook-framework/agent-adapter.js';
import { HookLoader } from './hook-framework/loader.js';
import { GuardrailDeny, HookRegistry } from './hook-framework/registry.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(moduleDir, '..');
dotenv.config({ path: path.join(demoRoot, '.env'), quiet: true });

process.env.SECURITY_POLICY_PATH ??= path.join(demoRoot, 'workspace/demo-agent/security.yaml');
process.env.SECURITY_AUDIT_FILE ??= path.join(
  demoRoot,
  'workspace/demo-agent/security-audit.jsonl',
);

export async function main({
  scenario = process.env.SECURITY_SCENARIO ?? 'normal',
  logger = console.log,
} = {}) {
  const registry = new HookRegistry();
  const loader = new HookLoader(registry);
  await loader.loadFromDirectory(path.join(demoRoot, 'shared-hooks'), 'global');
  const adapter = new AgentSecurityAdapter({ registry });

  try {
    const result = await runSecurityScenario({ adapter, scenario });
    await adapter.sessionEnd({ result });
    logger(`Scenario: ${scenario}`);
    logger(`Result: ${JSON.stringify(result)}`);
    printMetrics(loader.strategies, logger);
    return { ok: true, result, strategies: loader.strategies };
  } catch (error) {
    await adapter.sessionEnd({ error: error.message });
    if (error instanceof GuardrailDeny) {
      logger(`Scenario: ${scenario}`);
      logger(`Guardrail triggered: ${error.reason}`);
      printMetrics(loader.strategies, logger);
      return { ok: false, denied: true, error, strategies: loader.strategies };
    }
    throw error;
  }
}

export function printMetrics(strategies, logger = console.log) {
  for (const [name, strategy] of Object.entries(strategies ?? {})) {
    if (typeof strategy.getMetrics === 'function') {
      logger(`[${name}] ${JSON.stringify(strategy.getMetrics())}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
