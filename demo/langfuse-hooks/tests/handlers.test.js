import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { EventType, createHookContext } from '../src/hook-framework/registry.js'
import { beforeTurnHandler } from '../shared-hooks/structured-log.js'
import { setAuditFile, writeAuditEntry } from '../workspace/demo_agent/hooks/task-audit.js'

describe('handlers', () => {
  it('emits structured JSON logs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    beforeTurnHandler(
      createHookContext({
        eventType: EventType.BEFORE_TURN,
        sessionId: 's1',
        turnNumber: 1,
        agentId: 'analyst',
      }),
    )

    const record = JSON.parse(spy.mock.calls[0][0])
    expect(record.event).toBe('before_turn')
    expect(record.session_id).toBe('s1')
    expect(record.agent_id).toBe('analyst')

    spy.mockRestore()
  })

  it('writes task audit entries', async () => {
    const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-hooks-'))
    const file = path.join(tmpdir, 'audit.log')
    setAuditFile(file)

    await writeAuditEntry(
      createHookContext({
        eventType: EventType.TASK_COMPLETE,
        sessionId: 's1',
        metadata: { rawOutput: 'some result text' },
      }),
    )

    const entry = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(entry.session_id).toBe('s1')
    expect(entry.event).toBe('task_complete')
    expect(entry.output_preview).toContain('some result')
  })
})
