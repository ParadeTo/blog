export function resolveRoutingKey(chatType, senderId, chatId, threadId) {
  if (chatType === 'p2p') return `p2p:${senderId}`
  if (threadId) return `thread:${chatId}:${threadId}`
  return `group:${chatId}`
}
