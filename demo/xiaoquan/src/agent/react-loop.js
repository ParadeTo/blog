import {generateText, tool} from 'ai'
import {z} from 'zod'
import fs from 'fs'
import path from 'path'
import {getModel} from '../llm/anthropic-llm.js'
import {buildBootstrapPrompt} from '../memory/bootstrap.js'
import {pruneToolResults} from '../memory/context-pruner.js'
import {maybeCompress, loadSessionCtx, saveSessionCtx} from '../memory/context-compressor.js'
import {loadSkillRegistry, createSkillTools} from './skill-tools.js'

const MAX_ITERATIONS = 10

function buildTools(skillRegistry, {sessionId, historyAll, sandbox, sessionDir, routingKey} = {}) {
  const skillTools = createSkillTools(skillRegistry, {sessionId, historyAll})

  const utilityTools = {
    run_script: tool({
      description: '在沙箱容器中执行 Skill 脚本（Python）。scriptPath 是相对于 skills/ 目录的路径，如 "xlsx/scripts/create.py"',
      parameters: z.object({
        scriptPath: z.string().describe('脚本路径，相对于 skills/ 目录'),
        args: z.string().optional().describe('传给脚本的命令行参数'),
      }),
      execute: async ({scriptPath, args}) => {
        if (!sandbox) return '沙箱未配置'
        const fullPath = path.resolve('skills', scriptPath)
        return sandbox.execute(fullPath, args || '', {sessionDir})
      },
    }),
    execute_code: tool({
      description: '在沙箱容器中执行 Python 代码。用于运行 Skill 指令中的脚本片段，如创建 Excel、处理数据等。输出文件写到 /workspace/session/outputs/，输入文件在 /workspace/session/uploads/',
      parameters: z.object({
        code: z.string().describe('要执行的 Python 代码'),
      }),
      execute: async ({code}) => {
        if (!sandbox) return '沙箱未配置'
        return sandbox.executeCode(code, 'python', {sessionDir})
      },
    }),
    read_file: tool({
      description: '读取指定路径的文件内容。支持文本文件和图片文件（jpg/png/gif/webp），图片会返回 base64 编码供视觉分析',
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
        } catch (e) {
          return `读取失败: ${e.message}`
        }
      },
    }),
    write_file: tool({
      description: '将内容写入指定路径的文件',
      parameters: z.object({
        path: z.string().describe('文件路径'),
        content: z.string().describe('文件内容'),
      }),
      execute: async ({path: filePath, content}) => {
        try {
          fs.mkdirSync(path.dirname(filePath), {recursive: true})
          fs.writeFileSync(filePath, content)
          return `已写入 ${filePath}`
        } catch (e) {
          return `写入失败: ${e.message}`
        }
      },
    }),
    memory_search: tool({
      description: '搜索长期记忆库，按语义相似度返回相关的历史对话',
      parameters: z.object({
        query: z.string().describe('搜索关键词或自然语言描述'),
      }),
      execute: async ({query}) => {
        try {
          const {searchMemory} = await import('../memory/rag-memory.js')
          const {getConfig} = await import('../config.js')
          const config = getConfig()
          const results = await searchMemory({
            queryText: query,
            routingKey,
            topK: 5,
            dbDsn: config.memory?.db_dsn,
          })
          if (results.length === 0) return '未找到相关记忆'
          return results.map(r => `[${r.created_at}] ${r.summary}\n用户: ${r.user_message}\n助手: ${r.assistant_reply}`).join('\n---\n')
        } catch (e) {
          return '记忆库暂不可用'
        }
      },
    }),
  }

  return {...skillTools, ...utilityTools}
}

export async function runAgent({
  userMessage,
  history = [],
  sessionId,
  routingKey,
  config,
  onStep = null,
  sandbox = null,
}) {
  const workspaceDir = config.memory?.workspace_dir || './workspace'
  const ctxDir = config.memory?.ctx_dir || './data/ctx'
  const modelId = config.llm?.model
  const maxIter = config.llm?.max_iter || MAX_ITERATIONS
  const pruneKeepTurns = config.memory?.prune_keep_turns || 10
  const compressThreshold = config.memory?.token_threshold || 80000
  const sessionDir = `data/workspace/sessions/${sessionId}`

  const bootstrapPrompt = buildBootstrapPrompt(workspaceDir)
  const systemPrompt = `${bootstrapPrompt}

你是小圈，一个飞书上的私人工作助手。
你拥有一组 Skill（专项能力），需要时用 list_skills 查看可用列表，用 get_skill 获取详细指令。
根据用户需求，自主决定每一步该做什么。

当需要执行代码时（如创建 Excel、处理数据），使用 execute_code 在沙箱中运行 Python 代码。
沙箱中的文件路径：输出写到 /workspace/session/outputs/，输入在 /workspace/session/uploads/。`

  let messages = loadSessionCtx(sessionId, ctxDir)
  if (messages.length === 0) {
    messages = history.map(m => ({role: m.role, content: m.content}))
  }
  messages.push({role: 'user', content: userMessage})

  const skillRegistry = loadSkillRegistry()
  const tools = buildTools(skillRegistry, {sessionId, historyAll: history, sandbox, sessionDir, routingKey})

  let lastPromptTokens = 0

  for (let i = 1; i <= maxIter; i++) {
    pruneToolResults(messages, {keepTurns: pruneKeepTurns})
    if (lastPromptTokens > compressThreshold) {
      messages = await maybeCompress(messages, {
        threshold: compressThreshold,
        ctxDir,
        sessionId,
      })
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
    if (!step) {
      saveSessionCtx(sessionId, messages, ctxDir)
      return text || ''
    }

    if (step.toolCalls.length === 0) {
      saveSessionCtx(sessionId, messages, ctxDir)
      return step.text || ''
    }

    for (const tc of step.toolCalls) {
      const result = step.toolResults.find(r => r.toolCallId === tc.toolCallId)
      if (onStep) {
        onStep({
          step: i,
          toolName: tc.toolName,
          args: tc.args,
          result: result ? String(result.result).slice(0, 120) : '',
        })
      }
    }

    messages.push(...response.messages)
  }

  saveSessionCtx(sessionId, messages, ctxDir)
  return '（达到最大迭代次数）'
}
