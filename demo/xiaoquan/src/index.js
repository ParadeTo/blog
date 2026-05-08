import {loadConfig} from './config.js'
import {SessionManager} from './session/session-manager.js'
import {FeishuSender} from './feishu/sender.js'
import {FeishuListener, runForever} from './feishu/listener.js'
import {FeishuDownloader} from './feishu/downloader.js'
import {PodmanSandbox} from './sandbox/podman-sandbox.js'
import {Runner} from './runner.js'
import {startTestApi} from './api/test-api.js'
import {CronService} from './cron/service.js'
import {scheduleHeartbeat} from './cron/tasks-store.js'
import {buildAgentFnMap, ROLES} from './agent/build-team.js'
import * as lark from '@larksuiteoapi/node-sdk'
import path from 'path'

const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_STAGGER_MS = [0, 7_000, 14_000, 21_000]

async function registerHeartbeats(cronTasksPath, {intervalMs = HEARTBEAT_INTERVAL_MS} = {}) {
  for (let i = 0; i < ROLES.length; i++) {
    const role = ROLES[i]
    const firstDelayMs = HEARTBEAT_STAGGER_MS[i % HEARTBEAT_STAGGER_MS.length]
    await scheduleHeartbeat(cronTasksPath, {role, intervalMs, firstDelayMs})
    console.log(`[Heartbeat] registered ${role} every=${intervalMs}ms first_delay=${firstDelayMs}ms`)
  }
}

async function main() {
  const config = loadConfig()
  const dataDir = config.data_dir || './data'

  console.log('=== 小圈小队 · 飞书工作助手（Team 模式）===')

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
  })
  sandbox.writeCredentials({
    feishu: {app_id: config.feishu.app_id, app_secret: config.feishu.app_secret},
  })
  console.log('[Sandbox] credentials injected')

  // 29 课：构建 4 角色 agentFnMap
  const workspaceRoot = path.resolve(config.memory?.workspace_dir || './workspace')
  const ctxDir = path.resolve(config.memory?.ctx_dir || './data/ctx')
  const cronTasksPath = path.resolve(path.join(dataDir, 'cron', 'tasks.json'))

  const agentFnMap = buildAgentFnMap({
    workspaceRoot,
    ctxDir,
    sandbox,
    cronTasksPath,
    sender,
    dbDsn: config.memory?.db_dsn || '',
  })

  const runner = new Runner(sessionMgr, sender, null, {
    idleTimeoutS: config.runner?.idle_timeout_s,
    downloader,
    dbDsn: config.memory?.db_dsn,
    agentFnMap,
  })

  // 注册 4 个角色的 heartbeat，错峰启动
  await registerHeartbeats(cronTasksPath)
  console.log('[Heartbeat] all roles registered')

  // 启动 CronService
  const cronSvc = new CronService({dataDir: path.resolve(dataDir), dispatchFn: runner.dispatch.bind(runner)})
  await cronSvc.start()
  console.log('[CronService] started')

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
    await cronSvc.stop()
    process.exit(0)
  })

  await runForever(listener)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
