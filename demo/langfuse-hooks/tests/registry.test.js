import { describe, expect, it, vi } from 'vitest'
import { EventType, HookRegistry, createHookContext } from '../src/hook-framework/registry.js'

describe('HookRegistry', () => {
  it('registers and dispatches handlers', async () => {
    const registry = new HookRegistry()
    const handler = vi.fn()

    registry.register(EventType.BEFORE_TURN, handler)
    await registry.dispatch(
      EventType.BEFORE_TURN,
      createHookContext({ eventType: EventType.BEFORE_TURN, sessionId: 'test' }),
    )

    expect(handler).toHaveBeenCalledOnce()
  })

  it('keeps dispatching after a handler throws', async () => {
    const logger = vi.fn()
    const registry = new HookRegistry({ logger })
    const good = vi.fn()

    registry.register(EventType.BEFORE_TURN, () => {
      throw new Error('boom')
    })
    registry.register(EventType.BEFORE_TURN, good)

    await registry.dispatch(
      EventType.BEFORE_TURN,
      createHookContext({ eventType: EventType.BEFORE_TURN }),
    )

    expect(good).toHaveBeenCalledOnce()
    expect(logger).toHaveBeenCalledOnce()
  })

  it('returns summaries and handler counts', () => {
    const registry = new HookRegistry()
    registry.register(EventType.AFTER_TURN, () => {}, 'h1')
    registry.register(EventType.AFTER_TURN, () => {}, 'h2')

    expect(registry.handlerCount(EventType.AFTER_TURN)).toBe(2)
    expect(registry.summary().after_turn).toEqual(['h1', 'h2'])
  })
})
