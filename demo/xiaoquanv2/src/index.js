import {loadConfig} from './config.js'
import {SessionManager} from './session/session-manager.js'
import {FeishuSender} from './feishu/sender.js'
import {FeishuListener, runForever} from './feishu/listener.js'
import {FeishuDownloader} from './feishu/downloader.js'
import {PodmanSandbox} from './sandbox/podman-sandbox.js'
import {Runner} from './runner.js'
import {startTestApi} from './api/test-api.js'
import {runAgent} from './agent/react-loop.js'
import {HookRegistry} from './hook-framework/registry.js'
import {HookLoader} from './hook-framework/loader.js'
import {HookAdapter} from './hook-framework/adapter.js'
import * as lark from '@larksuiteoapi/node-sdk'
import path from 'path'

function applyObservabilityEnv(config) {
  const obs = config.observability || {}
  if (obs.trace_to_langfuse !== undefined) {
    process.env.TRACE_TO_LANGFUSE = obs.trace_to_langfuse ? 'true' : 'false'
  }
  if (obs.langfuse_base_url) process.env.XIAOQUAN_LANGFUSE_BASE_URL = obs.langfuse_base_url
  if (obs.langfuse_public_key) process.env.XIAOQUAN_LANGFUSE_PUBLIC_KEY = obs.langfuse_public_key
  if (obs.langfuse_secret_key) process.env.XIAOQUAN_LANGFUSE_SECRET_KEY = obs.langfuse_secret_key
}

function buildStrategyConfig(config) {
  return {
    'audit-logger': {
      file: config.security?.audit_file || './data/security_audit.jsonl',
    },
    'permission-gate': config.security?.permissions || {},
    'retry-tracker': {
      maxRetries: config.retry?.max_retries ?? 3,
    },
  }
}

async function main() {
  const config = loadConfig()
  const dataDir = config.data_dir || './data'
  const workspaceRoot = path.resolve(config.memory?.workspace_dir || './workspace')
  applyObservabilityEnv(config)

  console.log('=== 小圈 v2 · 单助手 Hook 加固 Demo ===')

  const sessionMgr = new SessionManager(dataDir)
  console.log('[Session] initialized')

  const feishuClient = new lark.Client({
    appId: config.feishu.app_id,
    appSecret: config.feishu.app_secret,
  })

  const sender = new FeishuSender(feishuClient, config.sender)
  const downloader = new FeishuDownloader(feishuClient, dataDir)

  const sandbox = new PodmanSandbox({
    image: config.sandbox?.image,
    timeoutMs: config.sandbox?.timeout_ms,
    dataDir,
    workspaceRoot,
  })
  sandbox.writeCredentials({
    feishu: {app_id: config.feishu.app_id, app_secret: config.feishu.app_secret},
  })
  console.log('[Sandbox] credentials injected')

  const agentFn = (userMessage, history, sessionId, routingKey, rootId, verbose, extra = {}) => runAgent({
    userMessage,
    history,
    sessionId,
    routingKey,
    config,
    sandbox,
    adapter: extra.adapter || null,
  })

  const hookRegistry = new HookRegistry()
  if (config.hooks?.enabled !== false) {
    const hookDir = path.resolve(config.hooks?.dir || './src/shared-hooks')
    const failClosedNames = new Set(config.hooks?.fail_closed || [
      'sandbox-guard',
      'permission-gate',
      'cost-guard',
      'loop-detector',
      'retry-tracker',
    ])
    const instances = await new HookLoader(hookRegistry).load(hookDir, {
      failClosedNames,
      strategyConfig: buildStrategyConfig(config),
    })
    console.log(`[Hooks] loaded ${Object.keys(hookRegistry.summary()).length} event groups, ${instances.size} strategies`)
  }

  const runner = new Runner(sessionMgr, sender, agentFn, {
    idleTimeoutS: config.runner?.idle_timeout_s,
    downloader,
    dbDsn: config.memory?.db_dsn,
    hookRegistry,
    hookAdapterFactory: opts => new HookAdapter(hookRegistry, opts),
  })

  const listener = new FeishuListener({
    appId: config.feishu.app_id,
    appSecret: config.feishu.app_secret,
    onMessage: (inbound) => runner.dispatch(inbound),
    allowedChats: config.feishu.allowed_chats || [],
  })

  console.log('[Feishu] WebSocket connecting...')

  if (config.debug?.enable_test_api) {
    startTestApi(runner, {
      host: config.debug.test_api_host,
      port: config.debug.test_api_port,
    })
  }

  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n[Main] stopping...')
    await runner.shutdown()
    process.exit(0)
  })

  await runForever(listener)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
