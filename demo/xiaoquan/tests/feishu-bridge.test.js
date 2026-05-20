import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {CheckpointStore, classify} from '../src/tools/feishu-bridge.js'

describe('Feishu bridge classify', () => {
  it('treats numeric choices as checkpoint responses when a checkpoint is pending', () => {
    const pendingForRk = [{
      checkpointId: 'urlshortener_dep_decision',
      routingKey: 'p2p:ou_test',
      projectId: 'urlshortener',
      kind: 'checkpoint_request',
      createdAtMs: 100,
    }]

    assert.deepEqual(classify('2', {pendingForRk}), ['checkpoint_response', 'urlshortener_dep_decision'])
    assert.deepEqual(classify('选 1', {pendingForRk}), ['checkpoint_response', 'urlshortener_dep_decision'])
    assert.deepEqual(classify('1 b 2 a', {pendingForRk}), ['checkpoint_response', 'urlshortener_dep_decision'])
  })

  it('does not treat numeric choices as checkpoint responses without pending checkpoints', () => {
    assert.deepEqual(classify('2', {pendingForRk: []}), ['need_discussion', null])
  })

  it('creates checkpoint storage directory before locking', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-ckpt-'))
    const store = new CheckpointStore({dataDir: tmpDir})

    const checkpointId = await store.register({
      routingKey: 'p2p:ou_test',
      projectId: 'demo_001',
      kind: 'checkpoint_request',
      question: '1A or 1B?',
      checkpointId: 'ckpt-demo0001',
    })

    assert.equal(checkpointId, 'ckpt-demo0001')
    assert.ok(fs.existsSync(path.join(tmpDir, 'feishu_bridge', 'pending.jsonl')))
    const pending = await store.pendingForRoutingKey('p2p:ou_test')
    assert.equal(pending.length, 1)
    assert.equal(pending[0].checkpointId, 'ckpt-demo0001')
  })
})
