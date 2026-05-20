const MAX_TOOL_RESULT_CHARS = 300
const KEEP_CHARS = 200

export function pruneToolResults(messages, {keepTurns = 10} = {}) {
  const userIndices = messages
    .map((m, i) => (m.role === 'user' ? i : -1))
    .filter(i => i !== -1)

  if (userIndices.length <= keepTurns) return messages

  const cutoff = userIndices[userIndices.length - keepTurns]

  for (let i = 0; i < cutoff; i++) {
    const msg = messages[i]
    if (msg.role !== 'tool') continue
    if (!Array.isArray(msg.content)) continue

    const pruned = msg.content.map(part => {
      if (part.type !== 'tool-result') return part
      const resultStr = typeof part.result === 'string' ? part.result : JSON.stringify(part.result)
      if (resultStr.length <= MAX_TOOL_RESULT_CHARS) return part
      return {
        ...part,
        result: resultStr.slice(0, KEEP_CHARS) + `\n...(truncated, original: ${resultStr.length} chars)`,
      }
    })
    messages[i] = {...msg, content: pruned}
  }
  return messages
}
