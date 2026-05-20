import {loadConfig} from './config.js'
import {SessionManager} from './session/session-manager.js'
import {FeishuSender} from './feishu/sender.js'
import {FeishuListener, runForever} from './feishu/listener.js'
import {FeishuDownloader} from './feishu/downloader.js'
import {PodmanSandbox} from './sandbox/podman-sandbox.js'
import {Runner} from './runner.js'
import {startTestApi} from './api/test-api.js'
import {MailboxWatcher} from './watch/mailbox-watcher.js'
import {buildAgentFnMap} from './agent/build-team.js'
import {CheckpointStore} from './tools/feishu-bridge.js'
import * as lark from '@larksuiteoapi/node-sdk'
import path from 'path'

async function main() {
  const config = loadConfig()
  const dataDir = config.data_dir || './data'
  const workspaceRoot = path.resolve(config.memory?.workspace_dir || './workspace')

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
    workspaceRoot,
  })
  sandbox.writeCredentials({
    feishu: {app_id: config.feishu.app_id, app_secret: config.feishu.app_secret},
  })
  console.log('[Sandbox] credentials injected')

  // 29 课：构建 4 角色 agentFnMap
  const ctxDir = path.resolve(config.memory?.ctx_dir || './data/ctx')
  const cronTasksPath = path.resolve(path.join(dataDir, 'cron', 'tasks.json'))
  const checkpointStore = new CheckpointStore({dataDir: path.resolve(dataDir)})

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
    checkpointStore,
  })

  const mailboxWatcher = new MailboxWatcher({
    workspaceRoot,
    dispatchFn: runner.dispatch.bind(runner),
  })
  await mailboxWatcher.start()
  console.log('[MailboxWatcher] started')

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
    await mailboxWatcher.stop()
    process.exit(0)
  })

  await runForever(listener)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
