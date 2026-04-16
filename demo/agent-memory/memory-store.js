import { createHash } from 'crypto'
import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { query } from './db.js'

const openai = createOpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'http://localhost:3001',
  apiKey: process.env.EMBEDDING_API_KEY || process.env.ANTHROPIC_API_KEY || 'no-key',
})

const embeddingModel = openai.embedding('text-embedding-3-small')

function makeId(sessionId, turnTs) {
  return createHash('sha256')
    .update(`${sessionId}:${turnTs}`)
    .digest('hex')
    .slice(0, 16)
}

export async function storeMemory({
  sessionId,
  routingKey,
  userMessage,
  assistantReply,
  summary,
  tags,
  turnTs,
}) {
  const id = makeId(sessionId, turnTs)

  const [{ embedding: summaryVec }, { embedding: messageVec }] =
    await Promise.all([
      embed({ model: embeddingModel, value: summary }),
      embed({ model: embeddingModel, value: userMessage }),
    ])

  const searchText = [userMessage, summary, ...tags].join(' ')

  await query(
    `INSERT INTO memories
       (id, session_id, routing_key, user_message, assistant_reply,
        summary, tags, turn_ts, summary_vec, message_vec, search_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      id, sessionId, routingKey, userMessage, assistantReply,
      summary, tags, turnTs, JSON.stringify(summaryVec), JSON.stringify(messageVec), searchText,
    ]
  )

  return id
}
