import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import {buildSystemPrompt} from '../src/agent/build-team.js'

describe('buildSystemPrompt', () => {
  it('injects role skill index so mandatory skills are visible before tool use', () => {
    const workspaceRoot = path.resolve('workspace')
    const prompt = buildSystemPrompt(workspaceRoot, 'manager')

    assert.match(prompt, /<available_skills role="manager">/)
    assert.match(prompt, /sop_feature_dev/)
    assert.match(prompt, /requirements_guide/)
    assert.match(prompt, /必须先 get_skill/)
  })
})
