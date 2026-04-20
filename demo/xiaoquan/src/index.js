import {loadConfig} from './config.js'
import {SessionManager} from './session/session-manager.js'
import {FeishuSender} from './feishu/sender.js'
import {FeishuListener, runForever} from './feishu/listener.js'
import {FeishuDownloader} from './feishu/downloader.js'
import {PodmanSandbox} from './sandbox/podman-sandbox.js'
import {Runner} from './runner.js'
import {runAgent} from './agent/react-loop.js'
import {startTestApi} from './api/test-api.js'
import * as lark from '@larksuiteoapi/node-sdk'

async function main() {
  const config = loadConfig()
  const dataDir = config.data_dir || './data'

  console.log('=== 小圈 · 飞书工作助手 ===')

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

  const agentFn = async (userMessage, history, sessionId, routingKey, rootId, verbose) => {
    const onStep = verbose
      ? ({step, toolName, args, result}) => {
          sender.send(routingKey, `💭 [Step ${step}] ${toolName}(${JSON.stringify(args)})\n${result}`, rootId)
            .catch(() => {})
        }
      : null

    return runAgent({
      userMessage,
      history,
      sessionId,
      routingKey,
      config,
      onStep,
      sandbox,
    })
  }

  const runner = new Runner(sessionMgr, sender, agentFn, {
    idleTimeoutS: config.runner?.idle_timeout_s,
    downloader,
    dbDsn: config.memory?.db_dsn,
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

  await runForever(listener)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
