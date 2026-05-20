import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {PodmanSandbox} from '../src/sandbox/podman-sandbox.js'

describe('PodmanSandbox', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-sandbox-'))
  })

  it('mounts shared workspace into the execution container', () => {
    const workspaceRoot = path.join(tmpDir, 'workspace')
    const dataDir = path.join(tmpDir, 'data')
    const sandbox = new PodmanSandbox({workspaceRoot, dataDir})

    const mounts = sandbox._buildMounts(path.join(dataDir, 'workspace', 'sessions', 's-test'))

    assert.ok(mounts.includes('-v'))
    assert.ok(mounts.includes(`${path.join(workspaceRoot, 'shared')}:/workspace/shared:rw`))
    assert.ok(fs.existsSync(path.join(workspaceRoot, 'shared')))
  })
})
