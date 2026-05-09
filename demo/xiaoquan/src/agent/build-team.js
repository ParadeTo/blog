/**
 * build-team.js — 团队 Agent 工厂
 *
 * 对齐 Python xiaopaw-team 的 agents/build.py：
 * - buildTeamAgentFn: 为指定角色构造 agentFn（ReAct 循环）
 * - wrapWithLock: Promise 链串行化（防止 4 角色并发污染）
 * - buildAgentFnMap: 为 4 个角色构造 agentFn map，共享一把锁
 */

import fs from 'fs'
import path from 'path'
import {generateText, tool} from 'ai'
import {z} from 'zod'
import {getModel} from '../llm/anthropic-llm.js'
import {pruneToolResults} from '../memory/context-pruner.js'
import {maybeCompress, loadSessionCtx, saveSessionCtx} from '../memory/context-compressor.js'
import {loadRoleScopedSkillRegistry, createScopedSkillTools} from './skill-tools-scoped.js'
import {buildRoleTools} from '../tools/team-tools.js'

export const ROLES = ['manager', 'pm', 'rd', 'qa']

const MAX_ITERATIONS = 10

function buildBootstrapForRole(workspaceRoot, role) {
  const roleDir = path.join(workspaceRoot, role)
  const files = ['soul.md', 'agent.md', 'memory.md', 'user.md']
  return files
    .map(f => path.join(roleDir, f))
    .filter(p => fs.existsSync(p))
    .map(p => fs.readFileSync(p, 'utf-8'))
    .join('\n\n')
}

function buildSystemPrompt(workspaceRoot, role) {
  const bootstrap = buildBootstrapForRole(workspaceRoot, role)
  const protocolPath = path.join(workspaceRoot, 'shared', 'team_protocol.md')
  const protocol = fs.existsSync(protocolPath) ? fs.readFileSync(protocolPath, 'utf-8') : ''

  let prompt = bootstrap
  if (protocol) prompt += `\n\n<team_protocol>\n${protocol}\n</team_protocol>`
  prompt += `\n\n你是小圈团队的 ${role} 角色数字员工。`
  return prompt
}

function buildBaseTools({sessionId, sessionDir, sandbox} = {}) {
  return {
    read_file: tool({
      description: '读取指定路径的文件内容（文本或图片）',
      parameters: z.object({path: z.string().describe('文件路径')}),
      execute: async ({path: filePath}) => {
        try {
          const ext = path.extname(filePath).toLowerCase()
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            const buf = fs.readFileSync(filePath)
            const b64 = buf.toString('base64')
            const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
            return JSON.stringify({type: 'image', mimeType: mime, base64: b64})
          }
          return fs.readFileSync(filePath, 'utf-8')
        } catch (e) { return `读取失败: ${e.message}` }
      },
    }),

    write_file: tool({
      description: '将内容写入指定路径的文件',
      parameters: z.object({
        path: z.string().describe('文件路径'),
        content: z.string().describe('文件内容'),
      }),
      execute: ({path: filePath, content}) => {
        try {
          fs.mkdirSync(path.dirname(filePath), {recursive: true})
          fs.writeFileSync(filePath, content)
          return `已写入 ${filePath}`
        } catch (e) { return `写入失败: ${e.message}` }
      },
    }),

    execute_code: tool({
      description: '在沙箱容器中执行 Python 代码',
      parameters: z.object({code: z.string().describe('Python 代码')}),
      execute: async ({code}) => {
        if (!sandbox) return '沙箱未配置'
        return sandbox.executeCode(code, 'python', {sessionDir})
      },
    }),
  }
}

/**
 * buildTeamAgentFn — 为指定角色构造 agentFn
 */
export function buildTeamAgentFn({
  role,
  workspaceRoot,
  ctxDir,
  sender = null,
  dbDsn = '',
  sandbox = null,
  cronTasksPath = null,
  modelId = null,
  maxIter = MAX_ITERATIONS,
} = {}) {
  const systemPrompt = buildSystemPrompt(workspaceRoot, role)
  const ctxDirResolved = path.resolve(ctxDir)
  fs.mkdirSync(ctxDirResolved, {recursive: true})

  return async function agentFn(userMessage, history = [], sessionId, routingKey = '', rootId = '', verbose = false) {
    const sessionDir = `data/workspace/sessions/${sessionId}`
    const registry = loadRoleScopedSkillRegistry(workspaceRoot, role)

    const skillTools = createScopedSkillTools(registry, {sessionId, historyAll: history, role})
    const teamTools = cronTasksPath
      ? buildRoleTools(workspaceRoot, {role, cronTasksPath, sender})
      : {}
    const baseTools = buildBaseTools({sessionId, sessionDir, sandbox})

    const tools = {...skillTools, ...teamTools, ...baseTools}

    let messages = loadSessionCtx(sessionId, ctxDirResolved)
    if (messages.length === 0) {
      messages = history.map(m => ({role: m.role, content: m.content}))
    }
    messages.push({role: 'user', content: userMessage})

    const pruneKeepTurns = 10
    const compressThreshold = 80000
    let lastPromptTokens = 0

    for (let i = 1; i <= maxIter; i++) {
      pruneToolResults(messages, {keepTurns: pruneKeepTurns})
      if (lastPromptTokens > compressThreshold) {
        messages = await maybeCompress(messages, {threshold: compressThreshold, ctxDir: ctxDirResolved, sessionId})
      }

      const {steps, text, usage, response} = await generateText({
        model: getModel(modelId),
        system: systemPrompt,
        messages,
        tools,
        maxSteps: 1,
      })

      lastPromptTokens = usage?.promptTokens || 0
      const step = steps[0]
      if (!step) { saveSessionCtx(sessionId, messages, ctxDirResolved); return text || '' }

      if (step.toolCalls.length === 0) {
        saveSessionCtx(sessionId, messages, ctxDirResolved)
        return step.text || ''
      }

      messages.push(...response.messages.map(({id, ...m}) => m))
    }

    saveSessionCtx(sessionId, messages, ctxDirResolved)
    return '（达到最大迭代次数）'
  }
}

/**
 * wrapWithLock — 用 Promise 链实现串行化（防止 4 角色并发 LLM 调用时状态污染）
 */
export function wrapWithLock(agentFn) {
  let lock = Promise.resolve()
  return function lockedAgentFn(...args) {
    let resolve
    const prev = lock
    lock = new Promise(r => { resolve = r })
    return prev.then(() => agentFn(...args)).finally(() => resolve())
  }
}

/**
 * buildAgentFnMap — 为 4 个角色构造 agent_fn map，共享一把锁
 */
export function buildAgentFnMap({workspaceRoot, ctxDir, sandbox, cronTasksPath, sender, dbDsn = ''} = {}) {
  const map = {}
  // 所有角色共享同一把锁（防止 JS 单线程内 async 并发时 context 污染）
  let sharedLock = Promise.resolve()

  for (const role of ROLES) {
    const fn = buildTeamAgentFn({role, workspaceRoot, ctxDir, sender, dbDsn, sandbox, cronTasksPath})
    // 套共享锁
    map[role] = function(...args) {
      let resolve
      const prev = sharedLock
      sharedLock = new Promise(r => { resolve = r })
      return prev.then(() => fn(...args)).finally(() => resolve())
    }
  }
  return map
}
