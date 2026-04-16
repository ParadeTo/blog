import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {Runner} from '../src/runner.js'
import {SessionManager} from '../src/session/session-manager.js'
import {createInboundMessage} from '../src/models.js'

class CaptureSender {
  constructor() { this.messages = [] }
  async send(routingKey, content) { this.messages.push({routingKey, content}) }
  async sendThinking() { return 'card_123' }
  async updateCard(cardMsgId, content) { this.messages.push({cardMsgId, content}) }
  async sendText(routingKey, content) { this.messages.push({routingKey, content, type: 'text'}) }
}

describe('Runner', () => {
  let tmpDir, mgr, sender, runner

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-runner-'))
    mgr = new SessionManager(tmpDir)
    sender = new CaptureSender()
  })

  it('/help returns help text', async () => {
    const agentFn = async () => 'should not be called'
    runner = new Runner(mgr, sender, agentFn)
    const msg = createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: '/help',
      msgId: 'm1',
      senderId: 'ou_test',
    })
    await runner.dispatch(msg)
    await new Promise(r => setTimeout(r, 100))
    const helpMsg = sender.messages.find(m => m.type === 'text')
    assert.ok(helpMsg)
    assert.ok(helpMsg.content.includes('/new'))
  })

  it('/new creates new session', async () => {
    const agentFn = async () => 'reply'
    runner = new Runner(mgr, sender, agentFn)

    const msg1 = createInboundMessage({routingKey: 'p2p:ou_test', content: 'hi', msgId: 'm1', senderId: 'ou_test'})
    await runner.dispatch(msg1)
    await new Promise(r => setTimeout(r, 200))
    const s1 = await mgr.getOrCreate('p2p:ou_test')

    const msg2 = createInboundMessage({routingKey: 'p2p:ou_test', content: '/new', msgId: 'm2', senderId: 'ou_test'})
    await runner.dispatch(msg2)
    await new Promise(r => setTimeout(r, 200))
    const s2 = await mgr.getOrCreate('p2p:ou_test')
    assert.notEqual(s1.id, s2.id)
  })

  it('dispatches to agent_fn and sends reply', async () => {
    const agentFn = async (userMessage) => `echo: ${userMessage}`
    runner = new Runner(mgr, sender, agentFn)
    const msg = createInboundMessage({routingKey: 'p2p:ou_test', content: 'hello', msgId: 'm1', senderId: 'ou_test'})
    await runner.dispatch(msg)
    await new Promise(r => setTimeout(r, 200))
    const reply = sender.messages.find(m => m.cardMsgId)
    assert.ok(reply)
    assert.equal(reply.content, 'echo: hello')
  })
})
