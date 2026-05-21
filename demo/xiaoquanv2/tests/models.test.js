import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {createInboundMessage} from '../src/models.js'

describe('InboundMessage', () => {
  it('assigns one trace id per inbound message', () => {
    const a = createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: 'hello',
      msgId: 'm1',
      senderId: 'ou_test',
    })
    const b = createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: 'hello again',
      msgId: 'm2',
      senderId: 'ou_test',
    })

    assert.match(a.traceId, /^[a-f0-9]{16}$/)
    assert.match(b.traceId, /^[a-f0-9]{16}$/)
    assert.notEqual(a.traceId, b.traceId)
  })

  it('keeps an explicit trace id from the caller', () => {
    const inbound = createInboundMessage({
      routingKey: 'p2p:ou_test',
      content: 'hello',
      msgId: 'm1',
      senderId: 'ou_test',
      traceId: 'trace-from-test',
    })

    assert.equal(inbound.traceId, 'trace-from-test')
  })
})
