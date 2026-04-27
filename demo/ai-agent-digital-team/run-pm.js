import path from 'path'
import {fileURLToPath} from 'url'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'pm')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')

async function main() {
  const worker = await createDigitalWorker({
    workspaceDir: WORKSPACE_DIR,
    sharedDir: SHARED_DIR,
  })

  console.log('\n[PM] 启动，检查邮箱...')
  const result = await worker.kickoff(
    `请检查邮箱（role=pm），如有 task_assign 任务，按工作流程完成产品规格文档，` +
    `写入共享工作区后回邮通知 Manager，最后标记原消息为 done。`
  )
  console.log('\n[PM] 完成\n', result)
}

main().catch(e => { console.error(e); process.exit(1) })
