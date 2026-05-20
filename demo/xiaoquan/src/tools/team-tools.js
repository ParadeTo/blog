/**
 * team-tools.js — 8个团队协作工具（AI SDK tool 格式）
 *
 * 对齐 Python xiaopaw-team 的 tools/team_tools.py：
 * - 全角色共有：send_mail / read_inbox / mark_done / read_shared / write_shared
 * - Manager 独占：create_project / append_event / send_to_human
 * - sendMail 发完邮件后由 MailboxWatcher 监听文件变化并唤醒收件方
 */

import {tool} from 'ai'
import {z} from 'zod'
import path from 'path'
import * as mailbox from './mailbox.js'
import * as eventLog from './event-log.js'
import * as workspace from './workspace.js'
import {CheckpointStore} from './feishu-bridge.js'
import {evaluateDeliveryGate, routeDeliveryBlock, runProjectTests} from './qa-automation.js'

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

function normalizeWriteContent({projectId, relPath, content}) {
  if (typeof content !== 'string') return content
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return content
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed &&
        parsed.projectId === projectId &&
        parsed.relPath === relPath &&
        typeof parsed.content === 'string') {
      return parsed.content
    }
  } catch (_) {}
  return content
}

export function buildTeamTools(workspaceRoot, {role, cronTasksPath, sender = null, defaultRoutingKey = '', sandbox = null}) {
  const commonTools = {
    scan_projects: tool({
      description: '列出当前所有活跃项目的 ID 列表。返回 {projects: [projectId, ...]}',
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
      description: '向团队成员（manager/pm/rd/qa）发送一条邮件。发送后由邮箱文件监听自动唤醒收件角色。返回 {errcode, msgId, wakeMode}',
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
          return JSON.stringify({errcode: 0, msgId, wakeMode: 'file_watch', to, type})
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
      description: '写项目共享区文件（Owner 权限校验）。needs/(manager) / design/(pm) / tech/+code/(rd) / qa/(qa)。content 为必填字段，为完整文件正文。**调用时必须同时传 projectId + relPath + content 三个字段，缺一不可。**',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
        relPath: z.string().describe('相对路径（受 owner 约束）'),
        content: z.string().min(1, '❌ content 字段不能为空！请将完整文件正文作为字符串传入 content 参数，不能省略。'),
      }),
      execute: async ({projectId, relPath, content}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        try {
          const normalizedContent = normalizeWriteContent({projectId, relPath, content})
          await workspace.writeShared(workspaceRoot, {projectId, role, relPath, content: normalizedContent})
          return JSON.stringify({errcode: 0, relPath})
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    }),
  }

  const roleTools = {}

  if (role === 'qa') {
    roleTools.run_project_tests = tool({
      description: 'QA 专用：对 shared/projects/{projectId}/code 自动检测语言并在沙箱真实运行测试；写 qa/test_report.md + qa/test_status.json；失败时写 qa/defects 并自动发 RD 修复任务，成功时回 manager。',
      parameters: z.object({
        projectId: z.string().describe('项目 ID'),
        round: z.string().describe('测试轮次标签，例如 round-1/retest-2；不知道传空字符串'),
        disallowedOutcomes: z.array(z.string()).describe('QA policy 禁止的 pytest outcome，例如 ["xfailed","xpassed"]。不知道传空数组。'),
      }),
      execute: async ({projectId, round = '', disallowedOutcomes = []}) => {
        const err = validateProjectId(projectId)
        if (err) return err
        try {
          const result = await runProjectTests({workspaceRoot, projectId, sandbox, round, disallowedOutcomes})
          return JSON.stringify(result)
        } catch (e) {
          return JSON.stringify({errcode: 1, errmsg: e.message})
        }
      },
    })
  }

  if (role !== 'manager') return {...commonTools, ...roleTools}

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
          // 持久化用户 routing key，供后续 team wake 时的 send_to_human 使用
          if (defaultRoutingKey && !defaultRoutingKey.startsWith('team:')) {
            const fs = await import('fs')
            const metaPath = path.join(projectRoot(workspaceRoot, projectId), 'meta.json')
            fs.default.writeFileSync(metaPath, JSON.stringify({userRoutingKey: defaultRoutingKey}))
          }
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
        routingKey: z.string().describe('飞书 routing_key。**不知道用户 routing_key 时必须传 "default"**，系统会自动路由到当前用户。'),
        message: z.string().describe('发送给人类的 Markdown 文本'),
        kind: z.string().describe('消息类型：info/checkpoint_request/proposal_review/delivery/evolution_report/error_alert，默认传 "info"'),
        projectId: z.string().describe('关联项目 ID（可选，不知道传空字符串 ""）'),
        checkpointId: z.string().describe('若 kind=checkpoint_request 必填，否则传空字符串 ""'),
      }),
      execute: async ({routingKey, message, kind = 'info', projectId = '', checkpointId = ''}) => {
        if (!VALID_KINDS.has(kind))
          return JSON.stringify({errcode: 1, errmsg: `invalid kind: ${kind}`})
        if (kind === 'checkpoint_request' && !checkpointId)
          return JSON.stringify({errcode: 1, errmsg: 'checkpoint_request requires checkpointId'})

        if (kind === 'delivery' && projectId && PROJECT_ID_RE.test(projectId)) {
          const gate = evaluateDeliveryGate(workspaceRoot, {projectId})
          if (!gate.ok) {
            const routed = await routeDeliveryBlock({workspaceRoot, projectId, gate})
            const eventsPath = path.join(projectRoot(workspaceRoot, projectId), 'events.jsonl')
            await eventLog.appendEvent(eventsPath, {
              action: 'revision_requested',
              payload: {reason: gate.reason, routeTo: gate.routeTo, routed},
            }).catch(e => console.warn('[send_to_human] delivery gate append_event error:', e.message))
            return JSON.stringify({
              errcode: 2,
              errmsg: 'delivery blocked by QA gate; routed automatically',
              gate,
              routed,
            })
          }
        }

        // "default" 回退到用户 routing key：
        // 1. 优先用当前 session 的 defaultRoutingKey（排除 team:xxx wake）
        // 2. 再从项目 meta.json 读取持久化的 userRoutingKey
        let resolvedKey = (routingKey === 'default' || !routingKey) ? defaultRoutingKey : routingKey
        if ((resolvedKey === 'default' || !resolvedKey || resolvedKey.startsWith('team:')) && projectId && PROJECT_ID_RE.test(projectId)) {
          try {
            const fs = await import('fs')
            const metaPath = path.join(projectRoot(workspaceRoot, projectId), 'meta.json')
            if (fs.default.existsSync(metaPath)) {
              const meta = JSON.parse(fs.default.readFileSync(metaPath, 'utf-8'))
              if (meta.userRoutingKey) resolvedKey = meta.userRoutingKey
            }
          } catch (_) {}
        }

        if (checkpointId) {
          try {
            const dataDir = path.dirname(path.dirname(cronTasksPath))
            const checkpoints = new CheckpointStore({dataDir})
            await checkpoints.register({
              routingKey: resolvedKey,
              projectId,
              kind,
              question: message,
              checkpointId,
            })
          } catch (e) {
            console.warn('[send_to_human] checkpoint register error:', e.message)
          }
        }

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

  return {...commonTools, ...roleTools, ...managerTools}
}

export function buildRoleTools(workspaceRoot, {role, cronTasksPath, sender = null, defaultRoutingKey = '', sandbox = null}) {
  return buildTeamTools(workspaceRoot, {role, cronTasksPath, sender, defaultRoutingKey, sandbox})
}
