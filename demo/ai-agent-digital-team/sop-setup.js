/**
 * SOP 共创入口（项目初始化前运行一次）
 *
 * 运行流程：
 *   第1次运行：Manager 生成 SOP 草稿 → 发 sop_draft_confirm → 退出
 *   Human 确认：node human-cli.js
 *   第2次运行：检测到草稿已确认 → 重命名为正式模板 → 完成
 */

import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'manager')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function getSopDraftConfirmStatus() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const msg = humanInbox.filter(m => m.type === 'sop_draft_confirm').pop()
  if (!msg) return 'not_sent'
  if (!msg.read) return 'pending'
  if (msg.rejected) return 'rejected'
  return 'confirmed'
}

async function main() {
  fs.mkdirSync(path.join(SHARED_DIR, 'mailboxes'), {recursive: true})
  fs.mkdirSync(path.join(SHARED_DIR, 'sop'), {recursive: true})

  const humanInboxPath = path.join(SHARED_DIR, 'mailboxes', 'human.json')
  if (!fs.existsSync(humanInboxPath)) fs.writeFileSync(humanInboxPath, '[]', 'utf-8')

  const status = getSopDraftConfirmStatus()

  if (status === 'confirmed') {
    console.log('\n[SOP Setup] 草稿已确认，正在重命名为正式模板...')
    const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
    const result = await worker.kickoff(
      `Human 已确认 SOP 草稿。请执行以下步骤：\n` +
      `1. 用 listDir 列出宿主机路径 ${SHARED_DIR}/sop/ 下的文件\n` +
      `2. 找到所有 draft_ 前缀的文件\n` +
      `3. 用 readFile 读取每个草稿内容，用 writeFile 写入去掉 draft_ 前缀的新文件名\n` +
      `4. 输出最终模板文件路径列表`
    )
    console.log('\n[SOP Setup] 完成\n', result)
  } else if (status === 'pending') {
    console.log('\n[SOP Setup] SOP 草稿已发送，等待 Human 确认。')
    console.log('请运行：node human-cli.js')
  } else if (status === 'rejected') {
    console.log('\n[SOP Setup] Human 拒绝了 SOP 草稿，正在重新生成...')
    const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
    const result = await worker.kickoff(
      `Human 拒绝了上一版 SOP 草稿。请用 sop_creator Skill 重新设计一版，` +
      `并用 notify_human Skill 发送新的 sop_draft_confirm 消息。`
    )
    console.log('\n[SOP Setup] 新草稿已生成\n', result)
  } else {
    console.log('\n[SOP Setup] 开始创建产品设计 SOP 模板...')
    const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
    const result = await worker.kickoff(
      `请使用 sop_creator Skill，为"产品设计"场景创建一个 SOP 模板。\n` +
      `场景：接收需求 → PM 完成产品规格文档 → Manager 验收。\n` +
      `完成后用 notify_human Skill 发送 sop_draft_confirm 消息。\n` +
      `注意：writeFile 使用宿主机路径，sop 目录位于 ${SHARED_DIR}/sop/`
    )
    console.log('\n[SOP Setup] SOP 草稿已生成\n', result)
  }
}

main().catch(e => {console.error(e); process.exit(1)})
