import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { HookLoader } from '../src/hook-framework/loader.js'
import { EventType, HookRegistry } from '../src/hook-framework/registry.js'

describe('HookLoader', () => {
  it('loads handlers from hooks.yaml', async () => {
    const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-hooks-'))
    const dir = path.join(tmpdir, 'hooks')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'hooks.yaml'),
      ['hooks:', '  BEFORE_TURN:', '    - handler: my-handler.onTurn', ''].join('\n'),
    )
    await fs.writeFile(path.join(dir, 'my-handler.js'), 'export function onTurn(ctx) {}\n')

    const registry = new HookRegistry()
    const loader = new HookLoader(registry)
    await loader.loadFromDirectory(dir, 'test')

    expect(registry.handlerCount(EventType.BEFORE_TURN)).toBe(1)
  })

  it('merges global and workspace layers', async () => {
    const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-hooks-'))
    const globalDir = path.join(tmpdir, 'global')
    const wsHooksDir = path.join(tmpdir, 'workspace', 'hooks')
    await fs.mkdir(globalDir, { recursive: true })
    await fs.mkdir(wsHooksDir, { recursive: true })

    await fs.writeFile(
      path.join(globalDir, 'hooks.yaml'),
      ['hooks:', '  TASK_COMPLETE:', '    - handler: g.onComplete', ''].join('\n'),
    )
    await fs.writeFile(path.join(globalDir, 'g.js'), 'export function onComplete(ctx) {}\n')
    await fs.writeFile(
      path.join(wsHooksDir, 'hooks.yaml'),
      ['hooks:', '  TASK_COMPLETE:', '    - handler: w.onComplete', ''].join('\n'),
    )
    await fs.writeFile(path.join(wsHooksDir, 'w.js'), 'export function onComplete(ctx) {}\n')

    const registry = new HookRegistry()
    const loader = new HookLoader(registry)
    await loader.loadTwoLayers(globalDir, path.join(tmpdir, 'workspace'))

    expect(registry.handlerCount(EventType.TASK_COMPLETE)).toBe(2)
  })

  it('skips missing modules', async () => {
    const logger = vi.fn()
    const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-hooks-'))
    const dir = path.join(tmpdir, 'hooks')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'hooks.yaml'),
      ['hooks:', '  BEFORE_TURN:', '    - handler: missing.onTurn', ''].join('\n'),
    )

    const registry = new HookRegistry()
    const loader = new HookLoader(registry, { logger })
    await loader.loadFromDirectory(dir, 'test')

    expect(registry.handlerCount(EventType.BEFORE_TURN)).toBe(0)
    expect(logger).toHaveBeenCalled()
  })
})
