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
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    if (content.length <= MAX_TOOL_RESULT_CHARS) continue
    messages[i] = {
      ...msg,
      content: content.slice(0, KEEP_CHARS) + `\n...(truncated, original: ${content.length} chars)`,
    }
  }
  return messages
}
