import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'manager')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')
const DEMO_INPUT = path.join(__dirname, 'demo-input', 'project_requirement.md')

function hasPendingTaskDone() {
  const mailboxPath = path.join(SHARED_DIR, 'mailboxes', 'manager.json')
  if (!fs.existsSync(mailboxPath)) return false
  const messages = JSON.parse(fs.readFileSync(mailboxPath, 'utf-8'))
  return messages.some(m => m.type === 'task_done' && m.status !== 'done')
}

async function main() {
  const worker = await createDigitalWorker({
    workspaceDir: WORKSPACE_DIR,
    sharedDir: SHARED_DIR,
  })

  let userRequest
  if (hasPendingTaskDone()) {
    console.log('\n[Manager] 检测到 task_done，进入验收模式')
    userRequest = `请检查邮箱（role=manager），找到 task_done 消息，读取 PM 的产出文件，` +
      `对照原始需求文档（/mnt/shared/needs/requirements.md）逐项验收，` +
      `将验收报告写入 /workspace/review_result.md，然后标记消息为 done。`
  } else {
    console.log('\n[Manager] 进入任务分配模式')
    const requirement = fs.readFileSync(DEMO_INPUT, 'utf-8')
    userRequest = `请按以下步骤执行：\n` +
      `1. 初始化共享工作区（shared-dir=/mnt/shared，roles=manager,pm）\n` +
      `2. 将下面的需求内容写入 /mnt/shared/needs/requirements.md\n` +
      `3. 给 PM 发 task_assign 邮件，邮件 content 只写路径引用\n\n需求内容：\n\n${requirement}`
  }

  const result = await worker.kickoff(userRequest)
  console.log('\n[Manager] 完成\n', result)
}

main().catch(e => { console.error(e); process.exit(1) })
