import {AsyncLocalStorage} from 'node:async_hooks'

const storage = new AsyncLocalStorage()

export function runWithTraceContext(ctx, fn) {
  return storage.run({...ctx}, fn)
}

export function getTraceContext() {
  return storage.getStore() || null
}

export function withChildSpan(parentSpanId, fn) {
  const current = getTraceContext() || {}
  return runWithTraceContext({...current, parentSpanId, spanStack: []}, fn)
}
