import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'manager')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')
const DEMO_INPUT = path.join(__dirname, 'demo-input', 'project_requirement.md')

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

/**
 * 通过检查邮箱状态判断当前处于哪个阶段：
 *   1 - 需求澄清（needs_confirm 未发送或未确认）
 *   2 - SOP 选择（needs_confirm 已确认，sop_confirm 未确认）
 *   3 - 任务分配（sop_confirm 已确认，PM 无 task_assign）
 *   4 - 等待 PM（PM 有 task_assign，Manager 无 task_done）
 *   5 - 验收（Manager 有待处理的 task_done）
 */
function detectPhase() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const managerInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'manager.json'))
  const pmInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'pm.json'))

  const taskDone = managerInbox.find(m => m.type === 'task_done' && m.status !== 'done')
  if (taskDone) return 5

  const taskAssign = pmInbox.find(m => m.type === 'task_assign' && m.status !== 'done')
  if (taskAssign) return 4

  const sopConfirm = humanInbox.filter(m => m.type === 'sop_confirm').pop()
  if (sopConfirm && sopConfirm.read && !sopConfirm.rejected) return 3

  const needsConfirm = humanInbox.filter(m => m.type === 'needs_confirm').pop()
  if (needsConfirm && needsConfirm.read && !needsConfirm.rejected) return 2

  return 1
}

async function main() {
  fs.mkdirSync(SHARED_DIR, {recursive: true})

  const phase = detectPhase()
  console.log(`\n[Manager] 当前阶段: ${phase}`)

  let userRequest

  switch (phase) {
    case 1: {
      const requirement = fs.readFileSync(DEMO_INPUT, 'utf-8')
      userRequest =
        `请执行以下步骤：\n` +
        `1. 初始化共享工作区（run_script "init_project/scripts/init_workspace.js" ` +
        `["--shared-dir", "/mnt/shared", "--roles", "manager,pm"]）\n` +
        `2. 使用 requirements_discovery Skill 分析以下需求，` +
        `将需求文档写入宿主机路径 ${SHARED_DIR}/needs/requirements.md\n` +
        `3. 使用 notify_human Skill 发送 needs_confirm 消息\n\n` +
        `需求内容：\n\n${requirement}`
      break
    }
    case 2:
      userRequest =
        `需求文档已被 Human 确认。请执行以下步骤：\n` +
        `1. 使用 sop_selector Skill，从宿主机路径 ${SHARED_DIR}/sop/ 中选出最匹配的 SOP\n` +
        `2. 将选中模板内容写入 ${SHARED_DIR}/sop/active_sop.md\n` +
        `3. 使用 notify_human Skill 发送 sop_confirm 消息`
      break
    case 3:
      userRequest =
        `SOP 已被 Human 确认。请给 PM 发送 task_assign 邮件，` +
        `邮件 content 只写路径引用：\n` +
        `- 需求文档：/mnt/shared/needs/requirements.md\n` +
        `- 产出写入：/mnt/shared/design/product_spec.md\n` +
        `- SOP 参考：/mnt/shared/sop/active_sop.md`
      break
    case 4:
      console.log('[Manager] 等待 PM 完成任务，请运行：node run-pm.js')
      process.exit(0)
      break
    case 5:
      userRequest =
        `请检查邮箱（role=manager），找到 task_done 消息，读取 PM 的产出文件，` +
        `对照原始需求文档（/mnt/shared/needs/requirements.md）逐项验收，` +
        `将验收报告写入宿主机路径 ${WORKSPACE_DIR}/review_result.md，然后标记消息为 done。`
      break
  }

  const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
  const result = await worker.kickoff(userRequest)
  console.log('\n[Manager] 完成\n', result)
}

main().catch(e => {console.error(e); process.exit(1)})
