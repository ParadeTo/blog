import fs from 'fs'
import path from 'path'
import * as mailbox from './mailbox.js'
import * as workspace from './workspace.js'

const MARKER = '__XIAOQUAN_TEST_RESULT_JSON__'

function projectRoot(workspaceRoot, projectId) {
  return path.join(workspaceRoot, 'shared', 'projects', projectId)
}

function mailboxDir(workspaceRoot, projectId) {
  return path.join(projectRoot(workspaceRoot, projectId), 'mailboxes')
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function safeJsonRead(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

function readText(filePath) {
  try {
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function tailLines(text, maxLines = 120, maxChars = 16000) {
  const lines = String(text || '').split('\n')
  return lines.slice(-maxLines).join('\n').slice(-maxChars)
}

function listDefectPaths(workspaceRoot, projectId) {
  const defectsDir = path.join(projectRoot(workspaceRoot, projectId), 'qa', 'defects')
  if (!fs.existsSync(defectsDir)) return []
  return fs.readdirSync(defectsDir)
    .filter(name => !name.startsWith('.') && !name.endsWith('.lock') && !name.endsWith('.tmp'))
    .sort()
    .map(name => `qa/defects/${name}`)
}

function hasRunnableCodeArtifacts(workspaceRoot, projectId) {
  const codeDir = path.join(projectRoot(workspaceRoot, projectId), 'code')
  if (!fs.existsSync(codeDir)) return false
  const checks = [
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'main.py',
    'app.py',
    'src',
    'app',
    'tests',
  ]
  return checks.some(name => fs.existsSync(path.join(codeDir, name)))
}

function latestMtimeMs(paths) {
  let latest = 0
  for (const p of paths) {
    try { latest = Math.max(latest, fs.statSync(p).mtimeMs) } catch {}
  }
  return latest
}

function latestRdTaskDoneAt(workspaceRoot, projectId) {
  const dir = mailboxDir(workspaceRoot, projectId)
  const messages = ['manager', 'qa']
    .flatMap(role => safeJsonRead(path.join(dir, `${role}.json`), []))
  return messages
    .filter(m => m.from === 'rd' && m.type === 'task_done' && m.timestamp)
    .map(m => new Date(m.timestamp).getTime())
    .filter(Number.isFinite)
    .reduce((max, ts) => Math.max(max, ts), 0)
}

function hasOpenMail(workspaceRoot, projectId, role, predicate) {
  const inbox = path.join(mailboxDir(workspaceRoot, projectId), `${role}.json`)
  const messages = safeJsonRead(inbox, [])
  return messages.find(m => m.status !== 'done' && predicate(m)) || null
}

export function extractCoverage(output) {
  const text = String(output || '')
  const totalMatch = text.match(/^TOTAL\s+\d+\s+\d+\s+(\d+)%/m)
  if (totalMatch) return Number(totalMatch[1]) / 100
  const pctMatch = text.match(/(?:coverage|覆盖率)[^\d]*(\d+(?:\.\d+)?)%/i)
  if (pctMatch) return Number(pctMatch[1]) / 100
  return null
}

export function extractTestOutcomeCounts(output) {
  const counts = {}
  const text = String(output || '')
  for (const match of text.matchAll(/(\d+)\s+(passed|failed|error|errors|skipped|xfailed|xpassed|deselected)\b/gi)) {
    const key = match[2].toLowerCase().replace(/errors?/, 'error')
    counts[key] = (counts[key] || 0) + Number(match[1])
  }
  return counts
}

function normalizeOutcomeName(name) {
  return String(name || '').toLowerCase().replace(/errors?/, 'error')
}

function findDisallowedOutcomes(outcome, disallowedOutcomes = []) {
  const disallowed = new Set(disallowedOutcomes.map(normalizeOutcomeName).filter(Boolean))
  return Object.entries(outcome || {})
    .filter(([name, count]) => disallowed.has(normalizeOutcomeName(name)) && Number(count || 0) > 0)
    .map(([name]) => normalizeOutcomeName(name))
}

export function buildProjectTestProbe(projectId) {
  const pid = JSON.stringify(projectId)
  return `
import json
import os
import subprocess
import traceback

pid = ${pid}
code_dir = f"/workspace/shared/projects/{pid}/code"

def run():
    if not os.path.isdir(code_dir):
        return {
            "language": "unknown",
            "command": "missing code directory",
            "returncode": 127,
            "stdout": "",
            "stderr": f"code directory not found: {code_dir}",
        }

    has_package = os.path.exists(os.path.join(code_dir, "package.json"))
    has_requirements = os.path.exists(os.path.join(code_dir, "requirements.txt"))
    has_pyproject = os.path.exists(os.path.join(code_dir, "pyproject.toml"))
    has_python_entry = any(os.path.exists(os.path.join(code_dir, p)) for p in ["app", "src", "main.py", "app.py", "tests"])

    if has_package:
        language = "node"
        command = "npm install --silent && npm test"
    elif has_requirements or has_pyproject or has_python_entry:
        language = "python"
        if os.path.exists(os.path.join(code_dir, "run_tests.sh")):
            test_cmd = "bash run_tests.sh"
        else:
            test_cmd = "python -m pytest -q --cov=app --cov-report=term-missing"
        install_cmd = "python -m pip install -q -r requirements.txt && " if has_requirements else ""
        command = install_cmd + test_cmd
    else:
        entries = sorted(os.listdir(code_dir))
        return {
            "language": "unknown",
            "command": "detect runnable code",
            "returncode": 127,
            "stdout": "\\n".join(entries),
            "stderr": "no runnable code artifacts found under code/: expected package.json, requirements.txt, pyproject.toml, app/, src/, main.py, app.py, or tests/",
        }

    proc = subprocess.run(
        ["bash", "-lc", command],
        cwd=code_dir,
        capture_output=True,
        text=True,
        timeout=240,
    )
    return {
        "language": language,
        "command": command,
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }

try:
    result = run()
except Exception:
    result = {
        "language": "unknown",
        "command": "internal test runner",
        "returncode": 125,
        "stdout": "",
        "stderr": traceback.format_exc(),
    }

print("${MARKER}" + json.dumps(result, ensure_ascii=False))
`.trim()
}

export function parseProbeOutput(rawOutput) {
  const raw = String(rawOutput || '')
  const idx = raw.lastIndexOf(MARKER)
  if (idx < 0) {
    const sandboxError = /^执行失败|^执行超时/.test(raw.trim())
    return {
      language: 'unknown',
      command: 'sandbox execution',
      returncode: 126,
      stdout: raw,
      stderr: `missing ${MARKER} marker`,
      sandboxError,
    }
  }
  const after = raw.slice(idx + MARKER.length).trim()
  const jsonLine = after.split('\n')[0]
  try {
    return JSON.parse(jsonLine)
  } catch (e) {
    return {
      language: 'unknown',
      command: 'sandbox execution',
      returncode: 126,
      stdout: raw,
      stderr: `failed to parse test result JSON: ${e.message}`,
    }
  }
}

function buildReport({projectId, status, result, coverage, defectPaths, outcome = {}, statusReason = '', disallowedOutcomes = []}) {
  const output = tailLines(`${result.stdout || ''}\n${result.stderr || ''}`, 160, 20000)
  return `# 测试报告

- 项目：${projectId}
- 执行方式：沙箱真实运行
- 执行时间：${nowIso()}
- 状态：${status === 'pass' ? 'pass' : 'fail'}
- 语言：${result.language || 'unknown'}
- 命令：\`${result.command || ''}\`
- returncode：${result.returncode}
- 覆盖率：${coverage == null ? 'unknown' : `${Math.round(coverage * 100)}%`}
- pytest outcome：${Object.keys(outcome).length ? JSON.stringify(outcome) : 'unknown'}
- disallowed outcome：${disallowedOutcomes.length ? JSON.stringify(disallowedOutcomes) : '[]'}
- 状态原因：${statusReason || (status === 'pass' ? 'all_tests_passed' : 'test_failed')}

## 缺陷
${defectPaths.length ? defectPaths.map(p => `- ${p}`).join('\n') : '- 无'}

## 原始输出（尾部）

\`\`\`text
${output}
\`\`\`
`
}

function buildDefect({projectId, result, outcome = {}, statusReason = '', disallowedOutcomes = []}) {
  const output = tailLines(`${result.stdout || ''}\n${result.stderr || ''}`, 120, 16000)
  return `# Defect 自动测试失败

- **项目**: ${projectId}
- **优先级**: H
- **来源**: run_project_tests 沙箱真实运行
- **命令**: \`${result.command || ''}\`
- **returncode**: ${result.returncode}
- **语言**: ${result.language || 'unknown'}
- **pytest outcome**: ${Object.keys(outcome).length ? JSON.stringify(outcome) : 'unknown'}
- **disallowed outcome**: ${disallowedOutcomes.length ? JSON.stringify(disallowedOutcomes) : '[]'}
- **状态原因**: ${statusReason || 'test_failed'}

## Reproduce

在项目 code 目录执行：

\`\`\`bash
${result.command || ''}
\`\`\`

## 期望

测试全部通过，且未出现 QA policy 禁止的 pytest outcome，覆盖率满足项目要求。

## 实际

测试命令非 0 退出、沙箱执行异常，或存在 QA policy 禁止的 pytest outcome。

## 原始输出（尾部）

\`\`\`text
${output}
\`\`\`
`
}

export async function runProjectTests({workspaceRoot, projectId, sandbox, round = '', disallowedOutcomes = []}) {
  if (!sandbox) {
    return {errcode: 1, errmsg: 'sandbox not configured'}
  }

  const rawOutput = await sandbox.executeCode(buildProjectTestProbe(projectId), 'python')
  const result = parseProbeOutput(rawOutput)
  const outputText = `${result.stdout || ''}\n${result.stderr || ''}`
  const coverage = extractCoverage(outputText)
  const outcome = extractTestOutcomeCounts(outputText)
  const blockedOutcomes = findDisallowedOutcomes(outcome, disallowedOutcomes)
  const hasDisallowedOutcome = blockedOutcomes.length > 0
  const status = result.sandboxError ? 'blocked' : (result.returncode === 0 && !hasDisallowedOutcome ? 'pass' : 'fail')
  const statusReason = result.sandboxError
    ? 'sandbox_error'
    : (result.returncode !== 0 ? 'nonzero_returncode' : (hasDisallowedOutcome ? `disallowed_outcome:${blockedOutcomes.join(',')}` : 'all_tests_passed'))
  const updatedAt = nowIso()
  const defectPaths = []

  if (status === 'fail') {
    const defectPath = `qa/defects/defect_test_run_${Date.now()}.md`
    await workspace.writeShared(workspaceRoot, {
      projectId,
      role: 'qa',
      relPath: defectPath,
      content: buildDefect({projectId, result, outcome, statusReason, disallowedOutcomes}),
    })
    defectPaths.push(defectPath)
  }

  const statusDoc = {
    status,
    projectId,
    round,
    updatedAt,
    updatedAtMs: Date.now(),
    language: result.language || 'unknown',
    command: result.command || '',
    returncode: result.returncode,
    coverage,
    outcome,
    disallowedOutcomes,
    statusReason,
    defects: defectPaths,
  }

  await workspace.writeShared(workspaceRoot, {
    projectId,
    role: 'qa',
    relPath: 'qa/test_status.json',
    content: JSON.stringify(statusDoc, null, 2),
  })
  await workspace.writeShared(workspaceRoot, {
    projectId,
    role: 'qa',
    relPath: 'qa/test_report.md',
    content: buildReport({projectId, status, result, coverage, defectPaths, outcome, statusReason, disallowedOutcomes}),
  })

  const mbox = mailboxDir(workspaceRoot, projectId)
  const summary = {
    status,
    deliverables: ['qa/test_report.md', 'qa/test_status.json', ...defectPaths],
    metrics: {coverage, returncode: result.returncode, outcome, disallowedOutcomes, statusReason},
    test_command: result.command || '',
    output_tail: tailLines(outputText, 80, 10000),
  }

  const managerMsgId = await mailbox.sendMail(mbox, {
    to: 'manager',
    from: 'qa',
    type: status === 'blocked' ? 'error_alert' : 'task_done',
    subject: status === 'pass' ? '测试执行通过' : (status === 'blocked' ? 'QA沙箱执行失败：需要环境处理' : '测试执行失败：已生成 defect'),
    content: JSON.stringify(summary, null, 2),
    projectId,
  })
  let rdMsgId = null
  if (status === 'fail') {
    rdMsgId = await mailbox.sendMail(mbox, {
      to: 'rd',
      from: 'qa',
      type: 'task_assign',
      subject: `缺陷修复 / fix defects${round ? ` (${round})` : ''}`,
      content: JSON.stringify({
        defects: defectPaths,
        test_command: result.command || '',
        returncode: result.returncode,
        coverage,
        outcome,
        disallowedOutcomes,
        statusReason,
        output_tail: tailLines(outputText, 80, 10000),
      }, null, 2),
      projectId,
    })
  }

  return {
    errcode: 0,
    status,
    managerMsgId,
    rdMsgId,
    wakeMode: 'file_watch',
    artifacts: summary.deliverables,
    coverage,
    returncode: result.returncode,
    outcome,
    disallowedOutcomes,
    statusReason,
  }
}

export function evaluateDeliveryGate(workspaceRoot, {projectId}) {
  const root = projectRoot(workspaceRoot, projectId)
  const reportPath = path.join(root, 'qa', 'test_report.md')
  const statusPath = path.join(root, 'qa', 'test_status.json')
  const status = safeJsonRead(statusPath, null)
  const report = readText(reportPath)
  const reportOutcome = extractTestOutcomeCounts(report)
  const defects = listDefectPaths(workspaceRoot, projectId)
  const defectAbs = defects.map(p => path.join(root, p))
  const latestDefectAt = latestMtimeMs(defectAbs)
  const reportAt = fs.existsSync(reportPath) ? fs.statSync(reportPath).mtimeMs : 0
  const lastRdDoneAt = latestRdTaskDoneAt(workspaceRoot, projectId)

  if (!fs.existsSync(reportPath)) {
    return {ok: false, routeTo: 'qa', reason: 'missing_test_report', defects}
  }
  if (!status) {
    return {ok: false, routeTo: 'qa', reason: 'missing_machine_test_status', defects}
  }
  if (status.status === 'pass') {
    if (!hasRunnableCodeArtifacts(workspaceRoot, projectId)) {
      return {ok: false, routeTo: 'rd', reason: 'missing_code_artifacts', defects}
    }
    if (lastRdDoneAt > Number(status.updatedAtMs || 0)) {
      return {ok: false, routeTo: 'qa', reason: 'rd_changed_after_last_pass', defects}
    }
    if (latestDefectAt > reportAt) {
      return {ok: false, routeTo: 'rd', reason: 'newer_defects_after_report', defects}
    }
    return {ok: true, reason: 'qa_passed', status, defects}
  }
  if (status.status === 'fail') {
    if (lastRdDoneAt > Number(status.updatedAtMs || 0)) {
      return {ok: false, routeTo: 'qa', reason: 'rd_fixed_after_failure_retest_required', defects}
    }
    return {ok: false, routeTo: 'rd', reason: 'qa_failed', defects: status.defects?.length ? status.defects : defects}
  }

  if (/失败[:：]\s*0/.test(report) || /fail(?:ed)?[:：]?\s*0/i.test(report)) {
    return {ok: true, reason: 'qa_report_passed_fallback', defects}
  }
  return {ok: false, routeTo: 'qa', reason: 'unknown_test_status', defects}
}

export async function routeDeliveryBlock({workspaceRoot, projectId, gate}) {
  const mbox = mailboxDir(workspaceRoot, projectId)
  if (gate.routeTo === 'rd') {
    const existing = hasOpenMail(workspaceRoot, projectId, 'rd',
      m => m.type === 'task_assign' && /缺陷修复|fix defects/i.test(m.subject || ''))
    if (existing) {
      return {to: 'rd', reusedMsgId: existing.id, wakeMode: 'file_watch'}
    }
    const msgId = await mailbox.sendMail(mbox, {
      to: 'rd',
      from: 'manager',
      type: 'task_assign',
      subject: gate.reason === 'missing_code_artifacts'
        ? '代码实现 / implement code（交付门禁发现 code 为空）'
        : '缺陷修复 / fix defects（交付门禁自动打回）',
      content: JSON.stringify({
        reason: gate.reason,
        defects: gate.defects || [],
        instruction: gate.reason === 'missing_code_artifacts'
          ? 'code/ 下没有可运行实现。请按 tech/tech_design.md 实现代码、补齐测试与 run_tests.sh；完成后回 task_done。Manager 将自动派 QA 复测，不能直接交付。'
          : '修复后回 task_done；Manager 将按 SOP/skill 派 QA 复测，不能直接交付。',
      }, null, 2),
      projectId,
    })
    return {to: 'rd', msgId, wakeMode: 'file_watch'}
  }

  const existing = hasOpenMail(workspaceRoot, projectId, 'qa',
    m => m.type === 'task_assign' && /测试执行|run tests|retest/i.test(m.subject || ''))
  if (existing) {
    return {to: 'qa', reusedMsgId: existing.id, wakeMode: 'file_watch'}
  }
  const msgId = await mailbox.sendMail(mbox, {
    to: 'qa',
    from: 'manager',
    type: 'task_assign',
    subject: '测试执行 / run tests（交付门禁自动触发）',
    content: JSON.stringify({
      reason: gate.reason,
      instruction: '调用 run_project_tests 真实执行测试；失败时生成 qa/defects 并自动发 RD，全部通过后回 manager。',
    }, null, 2),
    projectId,
  })
  return {to: 'qa', msgId, wakeMode: 'file_watch'}
}
