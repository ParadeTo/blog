import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as workspace from '../src/tools/workspace.js'
import * as mailbox from '../src/tools/mailbox.js'
import {
  evaluateDeliveryGate,
  extractCoverage,
  extractTestOutcomeCounts,
  parseProbeOutput,
  routeDeliveryBlock,
  runProjectTests,
} from '../src/tools/qa-automation.js'

describe('QA automation', () => {
  let tmpDir, workspaceRoot, projectId

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaoquan-qa-auto-'))
    workspaceRoot = path.join(tmpDir, 'workspace')
    projectId = 'demo_001'
    workspace.initProjectTree(workspaceRoot, {projectId})
  })

  it('extracts pytest coverage from TOTAL line', () => {
    assert.equal(extractCoverage('TOTAL 204 36 82%'), 0.82)
  })

  it('extracts pytest xfail/xpass outcome counts', () => {
    const counts = extractTestOutcomeCounts('x...... [100%]\n6 passed, 1 xfailed, 2 skipped, 1 xpassed in 0.69s')
    assert.equal(counts.passed, 6)
    assert.equal(counts.xfailed, 1)
    assert.equal(counts.xpassed, 1)
    assert.equal(counts.skipped, 2)
  })

  it('parses marked sandbox output', () => {
    const parsed = parseProbeOutput('noise\n__XIAOQUAN_TEST_RESULT_JSON__{"returncode":0,"command":"pytest"}\n')
    assert.equal(parsed.returncode, 0)
    assert.equal(parsed.command, 'pytest')
  })

  it('blocks delivery when machine-readable QA status is missing', async () => {
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_report.md',
      content: '# 测试报告\n\n- 状态：pass\n',
    })

    const gate = evaluateDeliveryGate(workspaceRoot, {projectId})

    assert.equal(gate.ok, false)
    assert.equal(gate.routeTo, 'qa')
    assert.equal(gate.reason, 'missing_machine_test_status')
  })

  it('routes failed QA status to RD until RD fixes after the failure', async () => {
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_report.md',
      content: '# 测试报告\n\n- 状态：fail\n',
    })
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_status.json',
      content: JSON.stringify({status: 'fail', updatedAtMs: Date.now() + 60_000, defects: ['qa/defects/d1.md']}),
    })

    let gate = evaluateDeliveryGate(workspaceRoot, {projectId})
    assert.equal(gate.ok, false)
    assert.equal(gate.routeTo, 'rd')
    assert.equal(gate.reason, 'qa_failed')

    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_status.json',
      content: JSON.stringify({status: 'fail', updatedAtMs: 1, defects: ['qa/defects/d1.md']}),
    })
    await mailbox.sendMail(path.join(workspaceRoot, 'shared', 'projects', projectId, 'mailboxes'), {
      to: 'manager',
      from: 'rd',
      type: 'task_done',
      subject: '缺陷修复交付',
      content: '{}',
      projectId,
    })

    gate = evaluateDeliveryGate(workspaceRoot, {projectId})
    assert.equal(gate.ok, false)
    assert.equal(gate.routeTo, 'qa')
    assert.equal(gate.reason, 'rd_fixed_after_failure_retest_required')
  })

  it('blocks pass reports when code artifacts are missing', async () => {
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_report.md',
      content: '# 测试报告\n\n- 状态：pass\n',
    })
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_status.json',
      content: JSON.stringify({status: 'pass', updatedAtMs: Date.now()}),
    })

    const gate = evaluateDeliveryGate(workspaceRoot, {projectId})

    assert.equal(gate.ok, false)
    assert.equal(gate.routeTo, 'rd')
    assert.equal(gate.reason, 'missing_code_artifacts')
  })

  it('does not hard-code xfail policy in delivery gate when QA status says pass', async () => {
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'rd',
      relPath: 'code/requirements.txt',
      content: 'pytest\n',
    })
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_report.md',
      content: '# 测试报告\n\n6 passed, 1 xfailed in 0.69s\n',
    })
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_status.json',
      content: JSON.stringify({
        status: 'pass',
        updatedAtMs: Date.now(),
        outcome: {passed: 6, xfailed: 1},
      }),
    })

    const gate = evaluateDeliveryGate(workspaceRoot, {projectId})

    assert.equal(gate.ok, true)
    assert.equal(gate.reason, 'qa_passed')
  })

  it('routes stale QA pass to QA after RD reports a fix', async () => {
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'rd',
      relPath: 'code/requirements.txt',
      content: 'pytest\n',
    })
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_report.md',
      content: '# 测试报告\n\n6 passed, 1 xfailed in 0.69s\n',
    })
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: 'qa/test_status.json',
      content: JSON.stringify({
        status: 'pass',
        updatedAtMs: 1,
        outcome: {passed: 6, xfailed: 1},
      }),
    })
    await mailbox.sendMail(path.join(workspaceRoot, 'shared', 'projects', projectId, 'mailboxes'), {
      to: 'manager',
      from: 'rd',
      type: 'task_done',
      subject: '缺陷修复完成',
      content: '{}',
      projectId,
    })

    const gate = evaluateDeliveryGate(workspaceRoot, {projectId})

    assert.equal(gate.ok, false)
    assert.equal(gate.routeTo, 'qa')
    assert.equal(gate.reason, 'rd_changed_after_last_pass')
  })

  it('lets QA policy mark configured pytest outcomes as failures', async () => {
    const sandbox = {
      async executeCode() {
        return [
          'noise',
          '__XIAOQUAN_TEST_RESULT_JSON__' + JSON.stringify({
            language: 'python',
            command: 'pytest',
            returncode: 0,
            stdout: 'x...... [100%]\n6 passed, 1 xfailed in 0.69s',
            stderr: '',
          }),
        ].join('\n')
      },
    }

    const result = await runProjectTests({
      workspaceRoot,
      projectId,
      sandbox,
      round: 'round-x',
      disallowedOutcomes: ['xfailed', 'xpassed'],
    })

    assert.equal(result.status, 'fail')
    assert.equal(result.statusReason, 'disallowed_outcome:xfailed')
    assert.equal(result.outcome.xfailed, 1)
    assert.ok(result.rdMsgId)

    const status = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'shared', 'projects', projectId, 'qa', 'test_status.json'), 'utf-8'))
    assert.equal(status.status, 'fail')
    assert.equal(status.statusReason, 'disallowed_outcome:xfailed')
    assert.equal(status.defects.length, 1)
  })

  it('treats xfail as pass when QA policy does not disallow it', async () => {
    const sandbox = {
      async executeCode() {
        return [
          'noise',
          '__XIAOQUAN_TEST_RESULT_JSON__' + JSON.stringify({
            language: 'python',
            command: 'pytest',
            returncode: 0,
            stdout: 'x...... [100%]\n6 passed, 1 xfailed in 0.69s',
            stderr: '',
          }),
        ].join('\n')
      },
    }

    const result = await runProjectTests({workspaceRoot, projectId, sandbox, round: 'round-x'})

    assert.equal(result.status, 'pass')
    assert.equal(result.statusReason, 'all_tests_passed')
    assert.equal(result.rdMsgId, null)
  })

  it('auto-routes a blocked delivery to QA and dedupes open test tasks', async () => {
    const tasksPath = path.join(tmpDir, 'data', 'cron', 'tasks.json')
    const gate = evaluateDeliveryGate(workspaceRoot, {projectId})

    const first = await routeDeliveryBlock({workspaceRoot, projectId, gate, cronTasksPath: tasksPath})
    const second = await routeDeliveryBlock({workspaceRoot, projectId, gate, cronTasksPath: tasksPath})

    assert.equal(first.to, 'qa')
    assert.ok(first.msgId)
    assert.equal(second.to, 'qa')
    assert.equal(second.reusedMsgId, first.msgId)

    const qaInbox = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'shared', 'projects', projectId, 'mailboxes', 'qa.json'), 'utf-8'))
    assert.equal(qaInbox.length, 1)
    assert.match(qaInbox[0].subject, /测试执行/)
  })
})
