import {generateText} from 'ai'
import {getModel} from '../llm/anthropic-llm.js'
import fs from 'fs'
import path from 'path'

const COMPRESS_PROMPT = `你是一个对话压缩器。把下面的对话历史压缩成一段简洁的摘要。

规则：
- 保留所有关键事实（人名、数字、决策结论、文件路径）
- 保留用户表达过的偏好
- 丢弃寒暄、重复确认、中间推理过程
- 不超过 500 字
- 直接输出摘要文本，不要输出其他内容`

function estimateTokens(messages) {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return sum + Math.ceil(content.length / 2)
  }, 0)
}

export async function maybeCompress(messages, {
  threshold = 80000,
  freshKeepTurns = 10,
  ctxDir = null,
  sessionId = null,
  promptTokens = null,
} = {}) {
  const tokenCount = promptTokens || estimateTokens(messages)
  if (tokenCount < threshold) return messages

  const systemMsgs = messages.filter(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const userIndices = nonSystem.map((m, i) => m.role === 'user' ? i : -1).filter(i => i !== -1)
  if (userIndices.length <= freshKeepTurns) return messages

  const cutoff = userIndices[userIndices.length - freshKeepTurns]

  const oldMsgs = nonSystem.slice(0, cutoff)
  const freshMsgs = nonSystem.slice(cutoff)

  if (ctxDir && sessionId) {
    const rawPath = path.join(ctxDir, `${sessionId}_raw.jsonl`)
    fs.mkdirSync(ctxDir, {recursive: true})
    for (const m of oldMsgs) {
      fs.appendFileSync(rawPath, JSON.stringify({...m, ts: Date.now()}) + '\n')
    }
  }

  const conversationText = oldMsgs
    .map(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return `[${m.role}] ${content}`
    })
    .join('\n')

  let summary
  try {
    const result = await generateText({
      model: getModel(),
      messages: [{role: 'user', content: `${COMPRESS_PROMPT}\n\n${conversationText}`}],
    })
    summary = result.text
  } catch {
    summary = '[压缩失败，内容省略]'
  }

  const summaryMsg = {
    role: 'user',
    content: `<context_summary>\n${summary}\n</context_summary>`,
  }

  const compressed = [...systemMsgs, summaryMsg, ...freshMsgs]

  if (ctxDir && sessionId) {
    const ctxPath = path.join(ctxDir, `${sessionId}_ctx.json`)
    fs.writeFileSync(ctxPath, JSON.stringify(compressed, null, 2))
  }

  return compressed
}

export function loadSessionCtx(sessionId, ctxDir) {
  const ctxPath = path.join(ctxDir, `${sessionId}_ctx.json`)
  if (!fs.existsSync(ctxPath)) return []
  return JSON.parse(fs.readFileSync(ctxPath, 'utf-8'))
}

export function saveSessionCtx(sessionId, messages, ctxDir) {
  fs.mkdirSync(ctxDir, {recursive: true})
  const ctxPath = path.join(ctxDir, `${sessionId}_ctx.json`)
  fs.writeFileSync(ctxPath, JSON.stringify(messages, null, 2))
}
