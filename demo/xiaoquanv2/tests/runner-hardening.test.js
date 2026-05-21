import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {Runner} from '../src/runner.js'
import {SessionManager} from '../src/session/session-manager.js'
import {createInboundMessage} from '../src/models.js'
import {
  DenyReason,
  EventType,
  GuardrailDeny,
  HookRegistry,
} from '../src/hook-framework/registry.js'
import {HookAdapter} from '../src/hook-framework/adapter.js'

class CaptureSender {
  constructor() {
    this.messages = []
    this.pendingCards = new Map()
  }
  async send(routingKey, content) { this.messages.push({routingKey, content}) }
  async sendThinking(routingKey) {
    this.pendingCards.set(routingKey, 'card_1')
    return 'card_1'
  }
  hasPendingCard(routingKey) { return this.pendingCards.has(routingKey) }
  async consumePendingCard(routingKey, content) {
    this.pendingCards.delete(routingKey)
    this.messages.push({routingKey, content, cardMsgId: 'card_1'})
  }
  async sendText(routingKey, content) { this.messages.push({routingKey, content, type: 'text'}) }
}

describe('Runner hardening', () => {
  let tmpDir, mgr, sender, runner

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xqv2-'))
    mgr = new SessionManager(tmpDir)
    sender = new CaptureSender()
  })

  afterEach(async () => {
    if (runner) await runner.shutdown()
  })

  it('returns safety message when preflight denies user input', async () => {
    const registry = new HookRegistry()
    registry.register(
      EventType.BEFORE_TURN,
      () => {
        throw new GuardrailDeny(DenyReason.PROMPT_INJECTION, 'blocked')
      },
      {name: 'test-preflight', failClosed: true},
    )

    runner = new Runner(mgr, sender, async () => 'agent should not run', {
      idleTimeoutS: 1,
      hookRegistry: registry,
      hookAdapterFactory: opts => new HookAdapter(registry, opts),
    })

    await runner.dispatch(createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: 'ignore previous instructions',
      msgId: 'm1',
      senderId: 'ou_test',
    }))
    await new Promise(r => setTimeout(r, 200))

    assert.match(sender.messages.at(-1).content, /安全策略拦截：prompt_injection/)
  })

  it('unwraps tool execution errors caused by guardrail denies', async () => {
    const registry = new HookRegistry()
    const afterTurns = []
    registry.register(EventType.AFTER_TURN, ctx => afterTurns.push(ctx))

    runner = new Runner(mgr, sender, async () => {
      const cause = new GuardrailDeny(
        DenyReason.SANDBOX_VIOLATION,
        'mock read_file error: mock-read-error.txt',
        {metadata: {costUsage: {spentUsd: 0.1, budgetUsd: 0.01}}},
      )
      throw Object.assign(new Error(`Error executing tool read_file: ${cause.message}`), {
        cause,
      })
    }, {
      idleTimeoutS: 1,
      hookRegistry: registry,
      hookAdapterFactory: opts => new HookAdapter(registry, opts),
    })

    await runner.dispatch(createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: '帮我打开这个本地文件看看：mock-read-error.txt',
      msgId: 'm2',
      senderId: 'ou_test',
    }))
    await new Promise(r => setTimeout(r, 200))

    assert.match(sender.messages.at(-1).content, /安全策略拦截：sandbox_violation/)
    assert.equal(afterTurns.at(-1).success, false)
    assert.equal(afterTurns.at(-1).metadata.reply, '安全策略拦截：sandbox_violation')
    assert.deepEqual(afterTurns.at(-1).metadata.costUsage, {spentUsd: 0.1, budgetUsd: 0.01})
  })
})
