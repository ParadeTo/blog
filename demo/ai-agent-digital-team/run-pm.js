import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'pm')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

/**
 * 检测 PM 当前应执行的任务类型：
 *   retro_trigger  - 自我复盘
 *   retro_approved - 落地改进
 *   retro_rejected - 处理被拒提案
 *   task_assign    - 常规产品设计任务
 */
function detectPhase() {
  const pmInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'pm.json'))
  const pending = m => m.status !== 'done'

  if (pmInbox.find(m => m.type === 'retro_trigger' && pending(m))) return 'retro_trigger'
  if (pmInbox.find(m => m.type === 'retro_approved' && pending(m))) return 'retro_approved'
  if (pmInbox.find(m => m.type === 'retro_rejected' && pending(m))) return 'retro_rejected'
  if (pmInbox.find(m => m.type === 'task_assign' && pending(m))) return 'task_assign'
  return null
}

async function main() {
  fs.mkdirSync(SHARED_DIR, {recursive: true})

  const phase = detectPhase()
  console.log(`\n[PM] 当前阶段: ${phase ?? '无待处理任务'}`)

  let userRequest
  switch (phase) {
    case 'retro_trigger':
      userRequest =
        `你收到了一封 type=retro_trigger 的邮件，请加载 self_retrospective Skill，` +
        `对过去 7 天的工作记录做一次自我复盘，产出结构化复盘报告和改进提案，` +
        `将提案 JSON 写入 /mnt/shared/proposals/ 目录，然后发 retro_report 邮件给 Manager。` +
        `完成后标记 retro_trigger 邮件为 done。`
      break
    case 'retro_approved':
      userRequest =
        `你收到了一封 type=retro_approved 的邮件，里面有已审批通过的改进清单（changes 数组）。` +
        `请按清单里的 before_text → after_text 逐条对目标文件做字符串替换，` +
        `找不到 before_text 时报错，不猜测，不硬改。` +
        `全部替换完成后，发 retro_applied 邮件给 Manager，标记原邮件为 done。`
      break
    case 'retro_rejected':
      userRequest =
        `你收到了一封 type=retro_rejected 的邮件，Manager 或 Human 拒绝了你的改进提案。` +
        `请读取邮件内容，理解拒绝原因，发 retro_acknowledged 邮件给 Manager 确认收到，` +
        `并标记原邮件为 done。`
      break
    case 'task_assign':
      userRequest =
        `请检查邮箱（role=pm），找到 task_assign 邮件，按工作流程完成产品规格文档，` +
        `写入共享工作区后回邮通知 Manager，最后标记原消息为 done。`
      break
    default:
      console.log('[PM] 无待处理任务，退出。')
      process.exit(0)
  }

  const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
  const result = await worker.kickoff(userRequest)
  console.log('\n[PM] 完成\n', result)
}

main().catch(e => {console.error(e); process.exit(1)})
