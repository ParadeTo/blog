#!/usr/bin/env node
/**
 * Human 端消息中心
 *
 * 用法：
 *   node human-cli.js                     # 交互式模式（推荐）
 *   node human-cli.js check               # 检查未读消息（JSON 输出）
 *   node human-cli.js respond <id> y      # 确认
 *   node human-cli.js respond <id> n "意见" # 拒绝 + 反馈
 *
 * human.json 二态设计：read: false/true
 * Human 不是 Agent，不需要 in_progress 状态。
 */

import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import enquirer from 'enquirer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HUMAN_INBOX = path.join(__dirname, 'workspace', 'shared', 'mailboxes', 'human.json')

const TYPE_LABELS = {
  needs_confirm: '需求文档确认',
  sop_draft_confirm: 'SOP 草稿确认',
  sop_confirm: 'SOP 选择确认',
  checkpoint_request: '阶段交付审核',
  error_alert: '异常上报',
}

function loadInbox() {
  if (!fs.existsSync(HUMAN_INBOX)) return []
  return JSON.parse(fs.readFileSync(HUMAN_INBOX, 'utf-8'))
}

function saveInbox(messages) {
  fs.mkdirSync(path.dirname(HUMAN_INBOX), {recursive: true})
  fs.writeFileSync(HUMAN_INBOX, JSON.stringify(messages, null, 2), 'utf-8')
}

function getUnread() {
  return loadInbox().filter(m => !m.read)
}

function respond(msgId, confirmed, feedback = null) {
  const messages = loadInbox()
  let found = false
  for (const msg of messages) {
    if (msg.id === msgId) {
      msg.read = true
      if (!confirmed) {
        msg.rejected = true
        if (feedback) msg.human_feedback = feedback
      }
      found = true
      break
    }
  }
  if (found) saveInbox(messages)
  return found
}

function printMessage(msg) {
  const divider = '─'.repeat(50)
  console.log(`\n${divider}`)
  console.log(`  消息 ID : ${msg.id}`)
  console.log(`  类型    : ${TYPE_LABELS[msg.type] || msg.type}`)
  console.log(`  主题    : ${msg.subject}`)
  console.log(`  内容    : ${msg.content}`)
  console.log(`  时间    : ${msg.timestamp}`)
  console.log(divider)
}

async function interactive() {
  console.log('\n' + '='.repeat(60))
  console.log('  Human 端消息中心（异步确认模式）')
  console.log('='.repeat(60))
  console.log(`  监听: ${HUMAN_INBOX}`)
  console.log('  按 Ctrl+C 退出')
  console.log('='.repeat(60) + '\n')

  while (true) {
    const unread = getUnread()
    if (unread.length === 0) {
      process.stdout.write('  📭 没有新消息，5秒后重新检查... (Ctrl+C 退出)\r')
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    process.stdout.write('\n')
    console.log(`  📬 收到 ${unread.length} 条新消息：`)

    for (const msg of unread) {
      printMessage(msg)
      try {
        const {decision} = await enquirer.prompt({
          type: 'select',
          name: 'decision',
          message: '你的决定',
          choices: ['✅ 确认 (y)', '❌ 拒绝 (n)'],
        })

        const confirmed = decision.startsWith('✅')
        let feedback = null

        if (!confirmed) {
          const {fb} = await enquirer.prompt({
            type: 'input',
            name: 'fb',
            message: '修改意见（直接回车跳过）',
          })
          feedback = fb.trim() || null
        }

        const ok = respond(msg.id, confirmed, feedback)
        if (ok) {
          if (confirmed) {
            console.log(`  ✅ 已确认：${msg.subject}`)
          } else {
            console.log(`  ↩️  已拒绝：${msg.subject}${feedback ? `（${feedback}）` : ''}`)
          }
        }
      } catch (e) {
        if (e.message === '') {
          console.log('\n\n  已退出 Human 端')
          process.exit(0)
        }
        throw e
      }
    }
  }
}

function cmdCheck() {
  const unread = getUnread()
  if (unread.length === 0) {
    console.log(JSON.stringify({status: 'no_unread', count: 0}))
    return
  }
  console.log(JSON.stringify({
    status: 'has_unread',
    count: unread.length,
    messages: unread.map(m => ({id: m.id, type: m.type, subject: m.subject})),
  }, null, 2))
}

function cmdRespond(msgId, decision, feedback) {
  const confirmed = decision === 'y'
  const ok = respond(msgId, confirmed, feedback || null)
  if (ok) {
    console.log(JSON.stringify({errcode: 0, msg_id: msgId, confirmed, feedback: feedback || null}))
  } else {
    console.log(JSON.stringify({errcode: 1, errmsg: `消息 ${msgId} 不存在或已被处理`}))
    process.exit(1)
  }
}

const [,, command, ...rest] = process.argv

if (command === 'check') {
  cmdCheck()
} else if (command === 'respond') {
  const [msgId, decision, feedback] = rest
  if (!msgId || !['y', 'n'].includes(decision)) {
    console.error('用法：node human-cli.js respond <msg_id> y/n [feedback]')
    process.exit(1)
  }
  cmdRespond(msgId, decision, feedback)
} else {
  interactive().catch(e => {console.error(e); process.exit(1)})
}
