import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  getTraceContext,
  runWithTraceContext,
  withChildSpan,
} from '../src/hook-framework/trace-context.js'
import {runSubAgentDemo} from '../src/agent/react-loop.js'

describe('trace context inheritance', () => {
  it('passes parent trace id into child span scope', async () => {
    await runWithTraceContext({traceId: 'trace-a', parentSpanId: 'span-parent', spanStack: []}, async () => {
      await withChildSpan('span-tool', async () => {
        const ctx = getTraceContext()
        assert.equal(ctx.traceId, 'trace-a')
        assert.equal(ctx.parentSpanId, 'span-tool')
      })
    })
  })

  it('isolates concurrent sessions', async () => {
    const [a, b] = await Promise.all([
      runWithTraceContext({traceId: 'trace-a', parentSpanId: 'span-a'}, async () => getTraceContext().traceId),
      runWithTraceContext({traceId: 'trace-b', parentSpanId: 'span-b'}, async () => getTraceContext().traceId),
    ])
    assert.equal(a, 'trace-a')
    assert.equal(b, 'trace-b')
  })

  it('runs sub-agent demo under the supplied parent span', async () => {
    const parentSpanIds = []
    const adapter = {
      isDeny: () => false,
      beforeLlm: async () => parentSpanIds.push(getTraceContext().parentSpanId),
      beforeToolCall: async () => parentSpanIds.push(getTraceContext().parentSpanId),
      afterToolCall: async () => parentSpanIds.push(getTraceContext().parentSpanId),
    }

    const result = await runWithTraceContext({
      traceId: 'trace-a',
      parentSpanId: 'root-span',
    }, () => runSubAgentDemo({
      parentSpanId: 'tool-parent',
      task: 'summarize child task',
      adapter,
    }))

    assert.equal(result, 'sub-agent-demo: summarize child task')
    assert.deepEqual(parentSpanIds, ['tool-parent', 'tool-parent', 'tool-parent'])
  })
})
