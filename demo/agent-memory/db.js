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
    await pgvector.registerTypes(client)
    const schema = fs.readFileSync(
      new URL('./schema.sql', import.meta.url),
      'utf-8'
    )
    await client.query(schema)
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
