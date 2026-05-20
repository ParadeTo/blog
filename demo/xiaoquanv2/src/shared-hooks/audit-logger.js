import fs from 'fs'
import path from 'path'

export class SecurityAuditLogger {
  constructor(config = {}) {
    this.file = config.file || './data/security_audit.jsonl'
  }

  recordEvent(type, fields = {}) {
    fs.mkdirSync(path.dirname(this.file), {recursive: true})
    const entry = {
      ts: new Date().toISOString(),
      type,
      ...fields,
    }
    fs.appendFileSync(this.file, `${JSON.stringify(entry)}\n`)
    return entry
  }

  sessionEndHandler(ctx) {
    this.recordEvent('session_end', {
      sessionId: ctx.sessionId,
      success: ctx.success,
    })
  }
}
