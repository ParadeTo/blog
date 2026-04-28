#!/usr/bin/env node
/**
 * 邮箱操作 CLI — Agent 通过 run_script 在沙盒中调用。
 *
 * 三态状态机（类比 AWS SQS Visibility Timeout）：
 *   send        → status: "unread"
 *   read        → status: "in_progress" + processingSince（原子操作，防重复取走）
 *   done        → status: "done"
 *   reset-stale → in_progress 超时 → unread（崩溃恢复）
 *
 * 用法：
 *   node mailbox_cli.js send --mailboxes-dir /mnt/shared/mailboxes \
 *       --from manager --to pm --type task_assign --subject "..." --content "..."
 *   node mailbox_cli.js read --mailboxes-dir /mnt/shared/mailboxes --role pm
 *   node mailbox_cli.js done --mailboxes-dir /mnt/shared/mailboxes --role pm --msg-id msg-xxxx
 *   node mailbox_cli.js reset-stale --mailboxes-dir /mnt/shared/mailboxes \
 *       --role pm --timeout-minutes 15
 */

import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'

const STATUS_UNREAD = 'unread'
const STATUS_IN_PROGRESS = 'in_progress'
const STATUS_DONE = 'done'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

function loadMailbox(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveMailbox(filePath, messages) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true})
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8')
}

function send({mailboxesDir, from, to, type, subject, content}) {
  const filePath = path.join(mailboxesDir, `${to}.json`)
  const messages = loadMailbox(filePath)
  const msg = {
    id: `msg-${randomBytes(4).toString('hex')}`,
    from,
    to,
    type,
    subject,
    content,
    timestamp: new Date().toISOString(),
    status: STATUS_UNREAD,
    processingSince: null,
  }
  messages.push(msg)
  saveMailbox(filePath, messages)
  console.log(JSON.stringify({ok: true, id: msg.id}))
}

function read({mailboxesDir, role}) {
  const filePath = path.join(mailboxesDir, `${role}.json`)
  const messages = loadMailbox(filePath)
  const now = new Date().toISOString()
  const unread = []
  for (const msg of messages) {
    if (msg.status === STATUS_UNREAD) {
      msg.status = STATUS_IN_PROGRESS
      msg.processingSince = now
      unread.push({...msg})
    }
  }
  saveMailbox(filePath, messages)
  console.log(JSON.stringify(unread))
}

function done({mailboxesDir, role, msgId}) {
  const filePath = path.join(mailboxesDir, `${role}.json`)
  const messages = loadMailbox(filePath)
  for (const msg of messages) {
    if (msg.id === msgId) msg.status = STATUS_DONE
  }
  saveMailbox(filePath, messages)
  console.log(JSON.stringify({ok: true}))
}

function resetStale({mailboxesDir, role, timeoutMinutes = 15}) {
  const filePath = path.join(mailboxesDir, `${role}.json`)
  const messages = loadMailbox(filePath)
  const timeoutMs = Number(timeoutMinutes) * 60 * 1000
  let reset = 0
  for (const msg of messages) {
    if (msg.status === STATUS_IN_PROGRESS && msg.processingSince) {
      const elapsed = Date.now() - new Date(msg.processingSince).getTime()
      if (elapsed > timeoutMs) {
        msg.status = STATUS_UNREAD
        msg.processingSince = null
        reset++
      }
    }
  }
  saveMailbox(filePath, messages)
  console.log(JSON.stringify({ok: true, reset}))
}

function checkHuman({mailboxesDir, type}) {
  const filePath = path.join(mailboxesDir, 'human.json')
  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({confirmed: false, reason: 'no_file'}))
    return
  }
  const messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const msg = messages.filter(m => m.type === type).pop()
  if (!msg) {
    console.log(JSON.stringify({confirmed: false, reason: 'no_message'}))
  } else if (!msg.read) {
    console.log(JSON.stringify({confirmed: false, reason: 'not_read'}))
  } else if (msg.rejected) {
    console.log(JSON.stringify({confirmed: false, reason: 'rejected', human_feedback: msg.human_feedback || null}))
  } else {
    console.log(JSON.stringify({confirmed: true}))
  }
}

const [,, command, ...rest] = process.argv
const args = parseArgs(rest)

switch (command) {
  case 'send': {
    if (args.to === 'human' && args.from !== 'manager') {
      console.log(JSON.stringify({errcode: 1, errmsg: '权限拒绝：只有 manager 可以向 human 发消息'}))
      process.exit(1)
    }
    send({
      mailboxesDir: args['mailboxes-dir'],
      from: args.from,
      to: args.to,
      type: args.type,
      subject: args.subject,
      content: args.content,
    })
    break
  }
  case 'read':
    read({mailboxesDir: args['mailboxes-dir'], role: args.role})
    break
  case 'done':
    done({mailboxesDir: args['mailboxes-dir'], role: args.role, msgId: args['msg-id']})
    break
  case 'reset-stale':
    resetStale({
      mailboxesDir: args['mailboxes-dir'],
      role: args.role,
      timeoutMinutes: args['timeout-minutes'] ?? 15,
    })
    break
  case 'check-human':
    checkHuman({mailboxesDir: args['mailboxes-dir'], type: args.type})
    break
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
