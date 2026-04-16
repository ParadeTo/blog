import pg from 'pg'
import crypto from 'crypto'
import {embedText, embedMany} from '../llm/anthropic-llm.js'
import {generateText} from 'ai'
import {getModel} from '../llm/anthropic-llm.js'

let _pool = null

function getPool(dbDsn) {
  if (!_pool) _pool = new pg.Pool({connectionString: dbDsn})
  return _pool
}

function vecToSql(vec) {
  return '[' + vec.join(',') + ']'
}

async function extractSummaryAndTags(userMessage, assistantReply) {
  const prompt = `从以下对话中提取一行摘要和标签。
用户：${userMessage.slice(0, 500)}
助手：${assistantReply.slice(0, 500)}

请用 JSON 格式回复，不要输出其他内容：
{"summary": "一句话摘要", "tags": ["tag1", "tag2"]}`

  try {
    const {text} = await generateText({
      model: getModel(),
      messages: [{role: 'user', content: prompt}],
      maxTokens: 200,
    })
    return JSON.parse(text)
  } catch {
    return {summary: userMessage.slice(0, 100), tags: []}
  }
}

export async function storeMemory({sessionId, routingKey, userMessage, assistantReply, turnTs, dbDsn}) {
  if (!dbDsn) return

  const turnId = crypto.createHash('sha256')
    .update(`${sessionId}_${turnTs}_${userMessage.slice(0, 32)}`)
    .digest('hex')
    .slice(0, 16)

  const {summary, tags} = await extractSummaryAndTags(userMessage, assistantReply)
  const combined = `用户:${userMessage}\n助手:${assistantReply}`

  const [summaryVec, messageVec] = await embedMany([summary, combined])

  const searchText = [userMessage, summary, ...tags].join(' ')
  const pool = getPool(dbDsn)
  await pool.query(
    `INSERT INTO memories (id, session_id, routing_key, user_message, assistant_reply,
     summary, tags, turn_ts, summary_vec, message_vec, search_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10::vector,$11)
     ON CONFLICT (id) DO NOTHING`,
    [turnId, sessionId, routingKey, userMessage, assistantReply,
     summary, tags, turnTs, vecToSql(summaryVec), vecToSql(messageVec), searchText]
  )
}

export async function searchMemory({queryText, routingKey, topK = 5, dbDsn}) {
  if (!dbDsn) return []

  const queryVec = await embedText(queryText)
  const pool = getPool(dbDsn)

  const {rows} = await pool.query(
    `WITH scored AS (
      SELECT *,
        1 - (summary_vec <=> $1::vector) AS vec_score,
        ts_rank(search_tsv, plainto_tsquery('simple', $2)) AS text_score
      FROM memories
      WHERE routing_key = $3
    )
    SELECT *, (vec_score * 0.7 + text_score * 0.3) AS score
    FROM scored ORDER BY score DESC LIMIT $4`,
    [vecToSql(queryVec), queryText, routingKey, topK]
  )
  return rows
}

export async function closePool() {
  if (_pool) await _pool.end()
}
