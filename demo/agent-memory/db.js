import pg from 'pg'
import pgvector from 'pgvector/pg'
import fs from 'fs'

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/agent_memory',
})

export async function initDB() {
  const client = await pool.connect()
  try {
    // 先建 extension，再注册类型（registerTypes 需要 vector 类型已存在）
    const schema = fs.readFileSync(
      new URL('./schema.sql', import.meta.url),
      'utf-8'
    )
    await client.query(schema)
    await pgvector.registerTypes(client)
    console.log('[DB] schema initialized')
  } finally {
    client.release()
  }
}

export async function query(text, params) {
  const client = await pool.connect()
  try {
    await pgvector.registerTypes(client)
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

export async function close() {
  await pool.end()
}
