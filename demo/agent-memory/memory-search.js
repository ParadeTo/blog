import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { query } from './db.js'

const openai = createOpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL || process.env.ANTHROPIC_BASE_URL || 'http://localhost:3001',
  apiKey: process.env.EMBEDDING_API_KEY || process.env.ANTHROPIC_API_KEY || 'no-key',
})

const embeddingModel = openai.embedding('text-embedding-3-small')

export async function searchMemory({
  queryText,
  routingKey,
  topK = 5,
  tags = null,
  afterDate = null,
  vectorWeight = 0.7,
  textWeight = 0.3,
}) {
  const { embedding: queryVec } = await embed({
    model: embeddingModel,
    value: queryText,
  })

  const conditions = ['routing_key = $2']
  const params = [JSON.stringify(queryVec), routingKey]
  let paramIdx = 3

  if (tags && tags.length > 0) {
    conditions.push(`tags @> $${paramIdx}`)
    params.push(tags)
    paramIdx++
  }

  if (afterDate) {
    conditions.push(`created_at > $${paramIdx}`)
    params.push(afterDate)
    paramIdx++
  }

  const whereClause = conditions.join(' AND ')

  const sql = `
    WITH scored AS (
      SELECT *,
        1 - (summary_vec <=> $1::vector) AS vec_score,
        ts_rank(search_tsv, plainto_tsquery('simple', $${paramIdx})) AS text_score
      FROM memories
      WHERE ${whereClause}
    )
    SELECT *,
      (vec_score * ${vectorWeight} + text_score * ${textWeight}) AS score
    FROM scored
    ORDER BY score DESC
    LIMIT ${topK}
  `

  params.push(queryText)

  const result = await query(sql, params)
  return result.rows
}
