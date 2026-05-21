import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  readFileForTool,
  toolChoiceForUserMessage,
} from '../src/agent/react-loop.js'
import {DenyReason, GuardrailDeny} from '../src/hook-framework/registry.js'

describe('react loop tool routing', () => {
  it('forces read_file when the user asks to read an explicit file path', () => {
    assert.deepEqual(toolChoiceForUserMessage('请读取 ../../etc/passwd'), {
      type: 'tool',
      toolName: 'read_file',
    })
  })

  it('keeps auto routing for non-path reading requests', () => {
    assert.equal(toolChoiceForUserMessage('请帮我读一下这份材料'), 'auto')
  })

  it('forces read_file for the demo mock-error file wording', () => {
    assert.deepEqual(toolChoiceForUserMessage('帮我打开这个本地文件看看：mock-read-error.txt'), {
      type: 'tool',
      toolName: 'read_file',
    })
  })

  it('raises a mock security error for the demo file inside read_file', () => {
    assert.throws(
      () => readFileForTool('mock-read-error.txt'),
      err => err instanceof GuardrailDeny && err.reasonCode === DenyReason.SANDBOX_VIOLATION,
    )
  })

  it('returns fixed content for the loop demo file', () => {
    assert.equal(readFileForTool('/workspace/session/uploads/loop-demo.txt'), 'loop-demo-content')
  })

  it('forces read_file for each requested loop-demo read', () => {
    const message = '请连续读取 3 次 loop-demo.txt，每次都原样返回读取结果。'
    assert.deepEqual(toolChoiceForUserMessage(message, 1), {type: 'tool', toolName: 'read_file'})
    assert.deepEqual(toolChoiceForUserMessage(message, 2), {type: 'tool', toolName: 'read_file'})
    assert.deepEqual(toolChoiceForUserMessage(message, 3), {type: 'tool', toolName: 'read_file'})
    assert.equal(toolChoiceForUserMessage(message, 4), 'auto')
  })
})
