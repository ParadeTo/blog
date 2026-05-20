import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  DenyReason,
  EventType,
  GuardrailDeny,
  createHookContext,
} from '../src/hook-framework/registry.js'
import {PermissionGate} from '../src/shared-hooks/permission-gate.js'

function ctx(toolName) {
  return createHookContext({
    eventType: EventType.BEFORE_TOOL_CALL,
    toolName,
    senderId: 'ou_test',
  })
}

describe('PermissionGate', () => {
  it('allows explicit allow', async () => {
    const gate = new PermissionGate({tools: {list_skills: 'allow'}, default: 'deny'}, {})
    await gate.beforeToolHandler(ctx('list_skills'))
  })

  it('warns and records audit event', async () => {
    const events = []
    const gate = new PermissionGate(
      {tools: {read_file: 'warn'}, default: 'deny'},
      {audit: {recordEvent: (type, fields) => events.push({type, ...fields})}},
    )
    await gate.beforeToolHandler(ctx('read_file'))
    assert.equal(events[0].type, 'permission_warn')
  })

  it('denies explicit deny', async () => {
    const gate = new PermissionGate({tools: {write_file: 'deny'}, default: 'warn'}, {})
    await assert.rejects(
      gate.beforeToolHandler(ctx('write_file')),
      err => err instanceof GuardrailDeny && err.reasonCode === DenyReason.PERMISSION_DENIED,
    )
  })
})
