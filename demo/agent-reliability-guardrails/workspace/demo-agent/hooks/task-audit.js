import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = path.dirname(fileURLToPath(import.meta.url));
let auditFile = path.resolve(hooksDir, '../output/task-audit.jsonl');

export function setAuditFile(file) {
  auditFile = path.resolve(file);
}

export function writeAuditEntry(ctx = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event: ctx.eventType ?? 'task_complete',
    session_id: ctx.sessionId ?? null,
    output_preview: previewOutput(ctx),
  };

  fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  fs.appendFileSync(auditFile, `${JSON.stringify(entry)}\n`, 'utf8');
}

function previewOutput(ctx) {
  const output = ctx.metadata?.rawOutput ?? ctx.metadata?.output ?? ctx.rawOutput ?? '';
  return String(output).slice(0, 200);
}
