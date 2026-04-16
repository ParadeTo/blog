import {describe, it, before, after, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {SessionManager} from '../src/session/session-manager.js'

describe('SessionManager', () => {
  let tmpDir
  let mgr

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-test-'))
    mgr = new SessionManager(tmpDir)
  })

  after(() => {
    // cleanup handled by OS
  })

  it('getOrCreate returns new session for unknown routing_key', async () => {
    const session = await mgr.getOrCreate('p2p:ou_test001')
    assert.ok(session.id.startsWith('s-'))
    assert.equal(session.id.length, 14)
    assert.equal(session.verbose, false)
    assert.equal(session.messageCount, 0)
  })

  it('getOrCreate returns same session on second call', async () => {
    const s1 = await mgr.getOrCreate('p2p:ou_test001')
    const s2 = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(s1.id, s2.id)
  })

  it('different routing_keys get different sessions', async () => {
    const s1 = await mgr.getOrCreate('p2p:ou_a')
    const s2 = await mgr.getOrCreate('p2p:ou_b')
    assert.notEqual(s1.id, s2.id)
  })

  it('reset creates new session, preserves old JSONL', async () => {
    const s1 = await mgr.getOrCreate('p2p:ou_test001')
    await mgr.append(s1.id, {user: 'hello', feishuMsgId: 'm1', assistant: 'hi'})
    const s2 = await mgr.reset('p2p:ou_test001')
    assert.notEqual(s1.id, s2.id)
    assert.ok(fs.existsSync(path.join(tmpDir, 'sessions', `${s1.id}.jsonl`)))
  })

  it('append and loadHistory round-trip', async () => {
    const session = await mgr.getOrCreate('p2p:ou_test001')
    await mgr.append(session.id, {user: 'hello', feishuMsgId: 'm1', assistant: 'hi there'})
    await mgr.append(session.id, {user: 'bye', feishuMsgId: 'm2', assistant: 'goodbye'})
    const history = await mgr.loadHistory(session.id)
    assert.equal(history.length, 4)
    assert.equal(history[0].role, 'user')
    assert.equal(history[0].content, 'hello')
    assert.equal(history[1].role, 'assistant')
    assert.equal(history[1].content, 'hi there')
  })

  it('loadHistory respects maxTurns', async () => {
    const session = await mgr.getOrCreate('p2p:ou_test001')
    for (let i = 0; i < 30; i++) {
      await mgr.append(session.id, {user: `msg${i}`, feishuMsgId: `m${i}`, assistant: `reply${i}`})
    }
    const history = await mgr.loadHistory(session.id, 5)
    assert.equal(history.length, 5)
  })

  it('updateVerbose toggles verbose flag', async () => {
    await mgr.getOrCreate('p2p:ou_test001')
    await mgr.updateVerbose('p2p:ou_test001', true)
    const session = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(session.verbose, true)
  })

  it('append increments messageCount', async () => {
    const s = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(s.messageCount, 0)
    await mgr.append(s.id, {user: 'a', feishuMsgId: 'm1', assistant: 'b'})
    const s2 = await mgr.getOrCreate('p2p:ou_test001')
    assert.equal(s2.messageCount, 2)
  })
})
