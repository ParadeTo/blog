const MAX_TOOL_RESULT_CHARS = 300
const KEEP_CHARS = 200

function extractKeyFields(text) {
  try {
    const obj = JSON.parse(text)
    const keys = ['id', 'name', 'status', 'title', 'error', 'code', 'path']
    const found = keys
      .filter(k => obj[k] !== undefined)
      .map(k => `${k}: ${JSON.stringify(obj[k])}`)
    if (found.length > 0) return `[Key fields] ${found.join(', ')}`
  } catch {
    // not JSON, skip extraction
  }
  return ''
}

function getToolContent(msg) {
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    return msg.content
      .map(part => {
        if (typeof part === 'string') return part
        if (part.type === 'text') return part.text
        if (part.result !== undefined) return String(part.result)
        return JSON.stringify(part)
      })
      .join('\n')
  }
  return JSON.stringify(msg.content)
}

export function prune(messages, { recentKeep = 2 } = {}) {
  const toolIndices = messages
    .map((m, i) => (m.role === 'tool' ? i : -1))
    .filter(i => i !== -1)
  const safeSet = new Set(toolIndices.slice(-recentKeep))

  let pruneCount = 0

  const result = messages.map((msg, idx) => {
    if (msg.role !== 'tool') return msg
    if (safeSet.has(idx)) return msg

    const content = getToolContent(msg)
    if (content.length <= MAX_TOOL_RESULT_CHARS) return msg

    const originalLen = content.length
    const keyInfo = extractKeyFields(content)
    const truncated = content.slice(0, KEEP_CHARS)
    const newContent = [
      keyInfo,
      truncated,
      `\n...(truncated, original: ${originalLen} chars)`,
    ]
      .filter(Boolean)
      .join('\n')

    pruneCount++
    console.log(
      `  [Prune] Tool result truncated: ${originalLen} → ${newContent.length} chars`
    )

    return { ...msg, content: newContent }
  })

  return result
}
