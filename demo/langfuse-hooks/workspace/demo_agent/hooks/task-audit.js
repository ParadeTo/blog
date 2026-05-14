import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export let auditFile = path.join(__dirname, '..', 'audit.log')

export function setAuditFile(filePath) {
  auditFile = filePath
}

export async function writeAuditEntry(ctx) {
  const entry = {
    timestamp: new Date().toISOString(),
    session_id: ctx.sessionId,
    event: 'task_complete',
    output_preview: String(ctx.metadata?.rawOutput ?? '').slice(0, 200),
  }

  try {
    await fs.appendFile(auditFile, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch (error) {
    console.error(`[TaskAudit] write error: ${error.message}`)
  }
}
