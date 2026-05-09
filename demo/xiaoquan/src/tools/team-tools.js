/**
 * team-tools.js — 8个团队协作工具（AI SDK tool 格式）
 *
 * 对齐 Python xiaopaw-team 的 tools/team_tools.py：
 * - 全角色共有：send_mail / read_inbox / mark_done / read_shared / write_shared
 * - Manager 独占：create_project / append_event / send_to_human
 * - sendMail 发完邮件自动注册 at=now+1s cron wake
 */

import {tool} from 'ai'
import {z} from 'zod'
import path from 'path'
import * as mailbox from './mailbox.js'
import * as eventLog from './event-log.js'
import * as workspace from './workspace.js'
import * as tasksStore from '../cron/tasks-store.js'

const PROJECT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
const VALID_KINDS = new Set(['info', 'checkpoint_request', 'proposal_review', 'delivery', 'evolution_report', 'error_alert'])
const KIND_TO_EVENT = {
  info: 'info_sent', checkpoint_request: 'checkpoint_request_sent',
  proposal_review: 'proposal_review_sent', delivery: 'delivery_sent',
  evolution_report: 'evolution_report_sent', error_alert: 'error_alert_sent',
}

function projectRoot(workspaceRoot, projectId) {
  return path.join(workspaceRoot, 'shared', 'projects', projectId)
}

function validateProjectId(projectId) {
  if (!PROJECT_ID_RE.test(projectId))
    return JSON.stringify({errcode: 1, errmsg: `invalid project_id: ${projectId}`})
  return null
}

export function buildTeamTools(workspaceRoot, {role, cronTasksPath, sender = null, defaultRoutingKey = ''}) {
  const commonTools = {
    scan_projects: tool({
      description: '列出当前所有活跃项目的 ID 列表，用于在 heartbeat 时发现有未读邮件的项目。返回 {projects: [projectId, ...]}',
      parameters: z.object({}),
      execute: async () => {
        try {
          const projectsDir = path.join(workspaceRoot, 'shared', 'projects')
          const fs = await import('fs')
          if (!fs.default.existsSync(projectsDir)) return JSON.stringify({projects: []})
          const entries = fs.default.readdirSync(projectsDir, {withFileTypes: true})
          const projects = entries.filter(e => e.isDirectory()).map(e => e.name)
          return JSON.stringify({projects})
        } catch (e) {
          return JSON.stringify({projects: [], errmsg: e.message})
        }
      },
    }),

    send_mail: tool({
      description: '向团队成员（manager/pm/rd/qa）发送一条邮件。发送后自动唤醒收件角色。返回 {errcode, msgId, scheduledWake}',
      parameters: z.object({
        to: z.string().describe('收件角色：manager/pm/rd/qa'),
        type: z.string().describe('邮件类型：task_assign/task_done/review_request/...'),
        subject: z.string().describe('一行标题'),
        content: z.string().describe('正文（建议 JSON 格式）'),
        projectId: z.string().describe('项目 ID（小写字母+数字+下划线+中划线）'),
      }),
      execute: async ({to, type, subject, content, projectId}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        const mailboxDir = path.join(projectRoot(workspaceRoot, projectId), 'mailboxes')
        try {
          const msgId = await mailbox.sendMail(mailboxDir, {to, from: role, type, subject, content, projectId})
          const jobId = await tasksStore.scheduleWake(cronTasksPath, {role: to, reason: 'new_mail', delayMs: 1000, projectId})
          return JSON.stringify({errcode: 0, msgId, scheduledWake: jobId, to, type})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),

    read_inbox: tool({
      description: '读取当前角色收件箱中未读消息（自动转 in_progress 并返回快照）。每次被唤醒后先调用。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
      }),
      execute: async ({projectId}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        const mailboxDir = path.join(projectRoot(workspaceRoot, projectId), 'mailboxes')
        try {
          const messages = await mailbox.readInbox(mailboxDir, {role})
          return JSON.stringify({errcode: 0, role, count: messages.length, messages})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),

    mark_done: tool({
      description: '把收件箱中一条 in_progress 消息标记为 done。处理完邮件后调用。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
        msgId: z.string().describe('消息 id（msg-xxxxxxxx）'),
      }),
      execute: async ({projectId, msgId}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        const mailboxDir = path.join(projectRoot(workspaceRoot, projectId), 'mailboxes')
        try {
          await mailbox.markDone(mailboxDir, {role, msgId})
          return JSON.stringify({errcode: 0, msgId, status: 'done'})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),

    read_shared: tool({
      description: '读取项目共享区文件内容。relPath 相对 shared/projects/{projectId}/ 根。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
        relPath: z.string().describe('相对路径，如 design/product_spec.md'),
      }),
      execute: ({projectId, relPath}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        try {
          const content = workspace.readShared(workspaceRoot, {projectId, role, relPath})
          return JSON.stringify({errcode: 0, relPath, content})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),

    write_shared: tool({
      description: '写项目共享区文件（Owner 权限校验）。needs/(manager) / design/(pm) / tech/+code/(rd) / qa/(qa)。content 为必填字段，为完整文件正文。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
        relPath: z.string().describe('相对路径（受 owner 约束）'),
        content: z.string().describe('文件完整正文（必填）'),
      }),
      execute: async ({projectId, relPath, content}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        try {
          await workspace.writeShared(workspaceRoot, {projectId, role, relPath, content})
          return JSON.stringify({errcode: 0, relPath})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),
  }

  if (role !== 'manager') return commonTools

  const managerTools = {
    create_project: tool({
      description: 'Manager 专用：创建新项目完整目录树，初始化邮箱、events.jsonl，写入需求文档。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID：小写字母开头，仅 [a-z0-9_-]'),
        projectName: z.string().describe('项目名'),
        needsContent: z.string().describe('需求文档正文（写入 needs/requirements.md）'),
      }),
      execute: async ({projectId, projectName, needsContent}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        try {
          workspace.initProjectTree(workspaceRoot, {projectId})
          await workspace.writeShared(workspaceRoot, {projectId, role: 'manager', relPath: 'needs/requirements.md', content: needsContent})
          const eventsPath = path.join(projectRoot(workspaceRoot, projectId), 'events.jsonl')
          const seq = await eventLog.appendEvent(eventsPath, {action: 'project_created', payload: {projectId, projectName}})
          return JSON.stringify({errcode: 0, projectId, eventSeq: seq})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),

    append_event: tool({
      description: 'Manager 专用：向项目 events.jsonl 追加一条事件。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
        action: z.string().describe('事件类型（附录 A.3 枚举）'),
        payload: z.string().describe('事件 payload（JSON 字符串）'),
      }),
      execute: async ({projectId, action, payload}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        try {
          const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload
          const eventsPath = path.join(projectRoot(workspaceRoot, projectId), 'events.jsonl')
          const seq = await eventLog.appendEvent(eventsPath, {action, payload: payloadObj})
          return JSON.stringify({errcode: 0, seq})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),

    send_to_human: tool({
      description: 'Manager 专用：把一条消息发给人类（通过飞书）。kind: info/checkpoint_request/proposal_review/delivery/evolution_report/error_alert。',
      parameters: z.object({
        routingKey: z.string().describe('飞书 routing_key，如 p2p:{open_id}'),
        message: z.string().describe('发送给人类的 Markdown 文本'),
        kind: z.string().default('info').describe('消息类型'),
        projectId: z.string().default('').describe('关联项目 ID（可选）'),
        checkpointId: z.string().default('').describe('若 kind=checkpoint_request 必填'),
      }),
      execute: async ({routingKey, message, kind = 'info', projectId = '', checkpointId = ''}) => {
        if (!VALID_KINDS.has(kind))
          return JSON.stringify({errcode: 1, errmsg: `invalid kind: ${kind}`})
        if (kind === 'checkpoint_request' && !checkpointId)
          return JSON.stringify({errcode: 1, errmsg: 'checkpoint_request requires checkpointId'})

        // "default" 回退到当前用户的 inbound routingKey
        const resolvedKey = (routingKey === 'default' || !routingKey) ? defaultRoutingKey : routingKey

        // 有思考中卡片就更新它，没有就发新消息
        if (sender) {
          setImmediate(() => {
            sender.send(resolvedKey, message, '').catch(e => console.error('[send_to_human] feishu send error:', e.message))
          })
        }

        // 写 event（若有 projectId）
        if (projectId && PROJECT_ID_RE.test(projectId)) {
          const eventsPath = path.join(projectRoot(workspaceRoot, projectId), 'events.jsonl')
          const payload = {routingKey, kind}
          if (checkpointId) payload.checkpointId = checkpointId
          await eventLog.appendEvent(eventsPath, {action: KIND_TO_EVENT[kind], payload}).catch(e =>
            console.warn('[send_to_human] append_event error:', e.message))
        }

        return JSON.stringify({errcode: 0, routingKey, kind, checkpointId})
      },
    }),
  }

  return {...commonTools, ...managerTools}
}

export function buildRoleTools(workspaceRoot, {role, cronTasksPath, sender = null, defaultRoutingKey = ''}) {
  return buildTeamTools(workspaceRoot, {role, cronTasksPath, sender, defaultRoutingKey})
}
