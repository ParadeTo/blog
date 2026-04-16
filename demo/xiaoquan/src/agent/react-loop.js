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

function buildTools(skillRegistry, {sessionId, historyAll, sandbox} = {}) {
  const skillTools = createSkillTools(skillRegistry, {sessionId, historyAll})

  const utilityTools = {
    read_file: tool({
      description: '读取指定路径的文件内容',
      parameters: z.object({path: z.string().describe('文件路径')}),
      execute: async ({path: filePath}) => {
        try {
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
        const {searchMemory} = await import('../memory/rag-memory.js')
        const {getConfig} = await import('../config.js')
        const config = getConfig()
        const results = await searchMemory({
          queryText: query,
          routingKey: '',
          topK: 5,
          dbDsn: config.memory?.db_dsn,
        })
        if (results.length === 0) return '未找到相关记忆'
        return results.map(r => `[${r.created_at}] ${r.summary}\n用户: ${r.user_message}\n助手: ${r.assistant_reply}`).join('\n---\n')
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
}) {
  const workspaceDir = config.memory?.workspace_dir || './workspace'
  const ctxDir = config.memory?.ctx_dir || './data/ctx'
  const modelId = config.llm?.model
  const maxIter = config.llm?.max_iter || MAX_ITERATIONS
  const pruneKeepTurns = config.memory?.prune_keep_turns || 10
  const compressThreshold = config.memory?.token_threshold || 80000

  const bootstrapPrompt = buildBootstrapPrompt(workspaceDir)
  const systemPrompt = `${bootstrapPrompt}

你是小圈，一个飞书上的私人工作助手。
你拥有一组 Skill（专项能力），需要时用 list_skills 查看可用列表，用 get_skill 获取详细指令。
根据用户需求，自主决定每一步该做什么。`

  let messages = loadSessionCtx(sessionId, ctxDir)
  if (messages.length === 0) {
    messages = history.map(m => ({role: m.role, content: m.content}))
  }
  messages.push({role: 'user', content: userMessage})

  const skillRegistry = loadSkillRegistry()
  const tools = buildTools(skillRegistry, {sessionId, historyAll: history})

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
