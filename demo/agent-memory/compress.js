import fs from 'fs'
import path from 'path'
import { generateText } from 'ai'

const COMPRESS_SYSTEM = `你是一个对话压缩器。你只输出 JSON，不输出任何其他内容。`

const COMPRESS_USER_TEMPLATE = `请压缩以下对话历史，完成两个任务：

任务一：压缩成一段简洁的摘要（不超过 500 字）。
- 保留关键事实：人名、数字、决策结论、文件路径
- 保留用户偏好
- 丢弃寒暄、重复确认、中间推理过程

任务二：提取 3-5 条值得长期记住的关键事实。

直接输出 JSON，不要用 markdown 代码块包裹，不要输出任何解释：
{"summary": "摘要", "memories": ["事实1", "事实2"]}

<conversation>
%CONVERSATION%
</conversation>`

function serializeContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return JSON.stringify(content)
  return content
    .map(part => {
      if (typeof part === 'string') return part
      if (part.type === 'text') return part.text
      if (part.type === 'tool-call')
        return `[调用工具 ${part.toolName}(${JSON.stringify(part.args)})]`
      if (part.type === 'tool-result') {
        const result = String(part.result)
        if (result.length <= 200) return `[工具结果] ${result}`
        return `[工具结果] ${result.slice(0, 200)}...(省略${result.length - 200}字符)`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export async function compress(
  messages,
  { keepRecent = 2, model, workspacePath } = {}
) {
  const sessionsDir = path.join(workspacePath, 'sessions')
  fs.mkdirSync(sessionsDir, { recursive: true })

  // 1. 持久化：完整历史写入 raw.jsonl
  const rawPath = path.join(sessionsDir, 'raw.jsonl')
  fs.appendFileSync(rawPath, JSON.stringify(messages) + '\n')
  console.log(
    `  [Compress] Persisting ${messages.length} messages to sessions/raw.jsonl`
  )

  // 2. 切分：保留最近 keepRecent 条，其余压缩
  const toCompress = messages.slice(0, -keepRecent)
  const toKeep = messages.slice(-keepRecent)

  // 3. 用 LLM 生成摘要 + 提取记忆
  const conversationText = toCompress
    .map(m => {
      const content = serializeContent(m.content)
      return `[${m.role}] ${content}`
    })
    .join('\n')

  const { text } = await generateText({
    model,
    system: COMPRESS_SYSTEM,
    prompt: COMPRESS_USER_TEMPLATE.replace('%CONVERSATION%', conversationText),
  })

  let summary, memories
  try {
    const jsonMatch = text.match(/\{[\s\S]*"summary"[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    summary = parsed.summary
    memories = parsed.memories || []
  } catch {
    console.log('  [Compress] Warning: JSON parse failed, using raw text as summary')
    summary = text.slice(0, 500)
    memories = []
  }

  // 4. 更新记忆索引
  if (memories.length > 0) {
    const memoryPath = path.join(workspacePath, 'memory', 'MEMORY.md')
    const today = new Date().toISOString().split('T')[0]
    const newEntries = memories.map(m => `- [${today}] ${m}`).join('\n')

    let existing = ''
    try {
      existing = fs.readFileSync(memoryPath, 'utf-8')
    } catch {
      existing = '# 记忆索引\n'
    }

    // 200 行上限
    const lines = existing.split('\n')
    const entryLines = newEntries.split('\n')
    if (lines.length + entryLines.length > 200) {
      const overflow = lines.length + entryLines.length - 200
      const headerEnd = lines.findIndex(l => l.startsWith('- '))
      if (headerEnd !== -1) {
        lines.splice(headerEnd, overflow)
      }
    }

    fs.writeFileSync(memoryPath, lines.join('\n').trimEnd() + '\n' + newEntries + '\n')
    console.log(
      `  [Compress] Updating memory/MEMORY.md (+${memories.length} entries)`
    )
  }

  // 5. 摘要替换旧消息
  const compressed = [
    { role: 'assistant', content: `[对话摘要]\n${summary}` },
    ...toKeep,
  ]

  // 6. 快照
  const ctxPath = path.join(sessionsDir, 'ctx.json')
  fs.writeFileSync(ctxPath, JSON.stringify(compressed, null, 2))

  return compressed
}
