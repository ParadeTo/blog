import fs from 'node:fs';
import path from 'node:path';

export class SecurityAuditLogger {
  constructor({ auditFile = process.env.SECURITY_AUDIT_FILE ?? '' } = {}) {
    this.auditFile = auditFile;
    this.events = [];
  }

  recordEvent(type, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      security_event: type,
      ...details,
    };

    this.events.push(entry);
    if (this.auditFile) {
      fs.mkdirSync(path.dirname(this.auditFile), { recursive: true });
      fs.appendFileSync(this.auditFile, `${JSON.stringify(entry)}\n`);
    }
  }

  sessionEndHandler(ctx) {
    this.recordEvent('session_summary', {
      session_id: ctx.sessionId,
      total_security_events: this.events.length,
      events_by_type: this.eventsByType(),
    });
  }

  getMetrics() {
    return {
      total_security_events: this.events.length,
      events_by_type: this.eventsByType(),
    };
  }

  eventsByType() {
    return this.events.reduce((acc, event) => {
      acc[event.security_event] = (acc[event.security_event] ?? 0) + 1;
      return acc;
    }, {});
  }
}
