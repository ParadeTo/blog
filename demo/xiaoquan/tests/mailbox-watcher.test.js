import {describe, it, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as workspace from '../src/tools/workspace.js'
import * as mailbox from '../src/tools/mailbox.js'
import {MailboxWatcher} from '../src/watch/mailbox-watcher.js'

async function waitFor(predicate, {timeoutMs = 2000, intervalMs = 25} = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('timeout waiting for condition')
}

describe('MailboxWatcher', () => {
  let watcher

  afterEach(async () => {
    if (watcher) await watcher.stop()
    watcher = null
  })

  it('dispatches a role wake when a mailbox file gets unread mail', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-mailbox-watch-'))
    const workspaceRoot = path.join(tmpDir, 'workspace')
    const projectId = 'demo_001'
    const seen = []

    watcher = new MailboxWatcher({
      workspaceRoot,
      dispatchFn: async (inbound) => { seen.push(inbound) },
      debounceMs: 20,
    })
    await watcher.start()

    workspace.initProjectTree(workspaceRoot, {projectId})
    await watcher.scanNow()
    await mailbox.sendMail(path.join(workspaceRoot, 'shared', 'projects', projectId, 'mailboxes'), {
      to: 'pm',
      from: 'manager',
      type: 'task_assign',
      subject: '产品设计',
      content: '{}',
      projectId,
    })

    await waitFor(() => seen.length === 1)
    assert.equal(seen[0].routingKey, 'team:pm')
    assert.equal(seen[0].content, `__wake__:new_mail:${projectId}`)
    assert.equal(seen[0].meta.wakeReason, 'new_mail')
    assert.equal(seen[0].meta.projectId, projectId)

    await new Promise(r => setTimeout(r, 120))
    assert.equal(seen.length, 1)
  })
})
