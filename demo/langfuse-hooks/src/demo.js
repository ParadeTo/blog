import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { AgentObservabilityAdapter } from './hook-framework/agent-adapter.js'
import { HookLoader } from './hook-framework/loader.js'
import { HookRegistry } from './hook-framework/registry.js'
import { shutdownLangfuseSdk, startLangfuseSdk } from './instrumentation.js'
import { buildBootstrapPrompt, loadSkillRegistry, resolveLlmConfig, runRealAgent } from './agent/real-agent.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEMO_DIR = path.resolve(__dirname, '..')
const WORKSPACE_DIR = path.join(DEMO_DIR, 'workspace', 'demo_agent')
const SHARED_HOOKS_DIR = path.join(DEMO_DIR, 'shared-hooks')
const SKILLS_DIR = path.join(WORKSPACE_DIR, 'skills')
const DEFAULT_TASK = '为一个用户注册功能产出技术设计文档'

function loadXiaoquanApiKey() {
  const result = dotenv.config({
    path: path.resolve(DEMO_DIR, '..', 'xiaoquan', '.env'),
    processEnv: {},
    quiet: true,
  })
  const apiKey = result.parsed?.ANTHROPIC_API_KEY
  if (apiKey) {
    process.env.ANTHROPIC_API_KEY = apiKey
  }
}

loadXiaoquanApiKey()
dotenv.config({ path: path.join(DEMO_DIR, '.env'), override: true, quiet: true })

function makeSessionId() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  return `sess_${stamp}`
}

async function main() {
  const taskDesc = process.argv.slice(2).join(' ').trim() || DEFAULT_TASK
  const llmConfig = resolveLlmConfig()
  const langfuseStarted = startLangfuseSdk()

  const registry = new HookRegistry()
  const loader = new HookLoader(registry)
  await loader.loadTwoLayers(SHARED_HOOKS_DIR, WORKSPACE_DIR)

  const summary = registry.summary()
  const total = Object.values(summary).reduce((acc, handlers) => acc + handlers.length, 0)
  const sessionId = makeSessionId()

  console.log(`Session: ${sessionId}`)
  console.log(`Langfuse: ${langfuseStarted ? 'enabled' : 'disabled, set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable'}`)
  console.log(`LLM: ${llmConfig.model} @ ${llmConfig.baseUrl}`)
  console.log(`HookRegistry: ${total} handlers loaded`)
  for (const [event, handlers] of Object.entries(summary)) {
    for (const handler of handlers) {
      console.log(`  ${handler} -> ${event}`)
    }
  }
  console.log('')

  const adapter = new AgentObservabilityAdapter(registry, { sessionId })

  try {
    const backstory = await buildBootstrapPrompt(WORKSPACE_DIR)
    const skills = await loadSkillRegistry(SKILLS_DIR)
    const { result, designDocPath } = await runRealAgent({
      adapter,
      workspaceDir: WORKSPACE_DIR,
      taskDesc,
      backstory,
      skills,
      llmConfig,
    })

    console.log('Result:')
    console.log(JSON.stringify(result, null, 2))
    console.log(`Design doc: ${designDocPath}`)
  } finally {
    await adapter.cleanup()
    await shutdownLangfuseSdk()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
