import {test} from 'node:test'
import assert from 'node:assert/strict'

test('local Langfuse is reachable when enabled', async t => {
  if (process.env.TRACE_TO_LANGFUSE !== 'true') {
    t.skip('TRACE_TO_LANGFUSE is not true')
    return
  }

  const baseUrl = process.env.XIAOQUAN_LANGFUSE_BASE_URL ||
    process.env.LANGFUSE_BASE_URL ||
    'http://localhost:3010'
  let resp
  try {
    resp = await fetch(baseUrl, {signal: AbortSignal.timeout(5000)})
  } catch (err) {
    throw new Error(`Local Langfuse not reachable at ${baseUrl}: ${err.name || err.message}`)
  }
  assert.ok(resp.status < 500)
})
