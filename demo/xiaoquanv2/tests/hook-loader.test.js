import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {EventType, HookRegistry} from '../src/hook-framework/registry.js'
import {HookLoader} from '../src/hook-framework/loader.js'

function writeFixture(dir, files) {
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content)
  }
}

describe('HookLoader', () => {
  it('loads observer hooks before strategy hooks and injects deps', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-hooks-'))
    writeFixture(dir, {
      'hooks.yaml': `
hooks:
  BEFORE_TOOL_CALL:
    - handler: observer.beforeToolHandler
strategies:
  - name: audit-logger
    class: audit.SecurityAuditLogger
    config: {}
    hooks:
      SESSION_END: sessionEndHandler
  - name: sandbox-guard
    class: sandbox.SandboxGuard
    deps:
      audit: audit-logger
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
`,
      'observer.js': 'export function beforeToolHandler(ctx) { ctx.metadata }',
      'audit.js': 'export class SecurityAuditLogger { sessionEndHandler() {} }',
      'sandbox.js': 'export class SandboxGuard { constructor(config, deps) { this.audit = deps.audit } beforeToolHandler() {} }',
    })

    const registry = new HookRegistry()
    const loader = new HookLoader(registry)
    const instances = await loader.load(dir, {failClosedNames: new Set(['sandbox-guard'])})

    assert.ok(instances.get('audit-logger'))
    assert.equal(instances.get('sandbox-guard').audit, instances.get('audit-logger'))
    assert.deepEqual(registry.summary()[EventType.BEFORE_TOOL_CALL].map(h => h.name), [
      'observer.beforeToolHandler',
      'sandbox-guard.beforeToolHandler',
    ])
    assert.equal(registry.summary()[EventType.BEFORE_TOOL_CALL][1].failClosed, true)
  })

  it('skips disabled hooks and strategies', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-hooks-'))
    writeFixture(dir, {
      'hooks.yaml': `
hooks:
  BEFORE_TURN:
    - handler: missing.beforeTurnHandler
      enabled: false
strategies:
  - name: disabled-guard
    class: missing.DisabledGuard
    enabled: false
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
`,
    })

    const registry = new HookRegistry()
    await new HookLoader(registry).load(dir)

    assert.deepEqual(registry.summary(), {})
  })

  it('fails fast when a required hook cannot be loaded', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-hooks-'))
    writeFixture(dir, {
      'hooks.yaml': `
hooks:
  BEFORE_TURN:
    - handler: missing.beforeTurnHandler
      required: true
`,
    })

    const registry = new HookRegistry()
    await assert.rejects(
      new HookLoader(registry).load(dir),
      /missing\.beforeTurnHandler/,
    )
  })

  it('merges strategy config overrides from the app config', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-hooks-'))
    writeFixture(dir, {
      'hooks.yaml': `
strategies:
  - name: permission-gate
    class: permission.PermissionGate
    config:
      default: warn
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
`,
      'permission.js': 'export class PermissionGate { constructor(config) { this.config = config } beforeToolHandler() {} }',
    })

    const registry = new HookRegistry()
    const instances = await new HookLoader(registry).load(dir, {
      strategyConfig: {
        'permission-gate': {
          default: 'deny',
          tools: {read_file: 'allow'},
        },
      },
    })

    assert.deepEqual(instances.get('permission-gate').config, {
      default: 'deny',
      tools: {read_file: 'allow'},
    })
  })
})
