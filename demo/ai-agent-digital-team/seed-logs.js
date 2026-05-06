// demo/ai-agent-digital-team/seed-logs.js
import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {writeL2, writeL3Step, writeL1, appendSessionMessages} from './log-ops.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = path.join(__dirname, 'workspace')
const LOGS_DIR = path.join(WORKSPACE, 'shared', 'logs')
const PM_SESSIONS_DIR = path.join(WORKSPACE, 'pm', 'sessions')

function daysAgo(n) {
  return new Date(Date.now() - n * 86400_000)
}

// 清空旧数据
;[LOGS_DIR, PM_SESSIONS_DIR].forEach(dir => {
  if (fs.existsSync(dir)) fs.rmSync(dir, {recursive: true})
  fs.mkdirSync(dir, {recursive: true})
})

// ── L2 日志：PM 8 条任务（3 条低质量）───────────────────────────────────────
const pmTasks = [
  ['t001', '用户登录功能产品设计文档',    0.40, 180, 'checkpoint_rejected', 6],
  ['t002', '用户注册流程产品设计文档',    0.85, 120, null,                  5],
  ['t003', '产品设计文档v2（用户登录）',  0.42, 200, 'checkpoint_rejected', 5],
  ['t004', '支付流程产品规格说明',        0.90, 150, null,                  4],
  ['t005', '数据看板产品设计文档',        0.88, 130, null,                  3],
  ['t006', '用户注册设计迭代（移动端）',  0.38, 220, 'checkpoint_rejected', 2],
  ['t007', '搜索功能产品需求文档',        0.82, 110, null,                  2],
  ['t008', '消息通知产品设计文档',        0.79, 140, null,                  1],
]
for (const [taskId, taskDesc, resultQuality, durationSec, errorType, n] of pmTasks) {
  writeL2(LOGS_DIR, {agentId: 'pm', taskId, taskDesc, resultQuality, durationSec, errorType,
    timestamp: daysAgo(n).toISOString()})
}
console.log(`[SEED] PM L2 日志已写入：${pmTasks.length} 条`)

// ── L2 日志：Manager 3 条（质量正常）────────────────────────────────────────
const managerTasks = [
  ['m001', '需求澄清：用户注册功能', 0.92, 90,  null, 6],
  ['m002', '任务分配：产品设计文档', 0.88, 60,  null, 5],
  ['m003', '验收：用户注册产品文档', 0.85, 75,  null, 4],
]
for (const [taskId, taskDesc, resultQuality, durationSec, errorType, n] of managerTasks) {
  writeL2(LOGS_DIR, {agentId: 'manager', taskId, taskDesc, resultQuality, durationSec, errorType,
    timestamp: daysAgo(n).toISOString()})
}
console.log(`[SEED] Manager L2 日志已写入：${managerTasks.length} 条`)

// ── L3 旧格式：3 个失败任务的步骤日志 ──────────────────────────────────────
const l3Data = [
  {taskId: 't001', daysBack: 6, steps: [
    [0, '读取需求文档，了解登录功能要求', 'read_requirements', '已读取，要求：邮箱登录+密码', true],
    [1, '开始撰写产品规格文档',          'write_document',    '已写入基本结构',              true],
    [2, '文档完成，发送完成通知',        'send_mail',         '已发送 task_done 给 manager', true],
  ]},
  {taskId: 't003', daysBack: 5, steps: [
    [0, '读取需求文档和前一版设计文档',    'read_requirements', '已读取',                true],
    [1, '撰写v2文档，修改登录页面描述',    'write_document',    '已更新产品文档',          true],
    [2, '检查是否覆盖所有需求点',         'read_document',     'Error: 发现缺少错误状态处理', false],
    [3, '补充错误处理，但未完整覆盖',      'write_document',    '部分补充',               true],
    [4, '发送完成通知',                   'send_mail',         '已发送 task_done',        true],
  ]},
  {taskId: 't006', daysBack: 2, steps: [
    [0, '读取需求文档',                   'read_requirements', '需求：注册流程+移动端优先', true],
    [1, '撰写产品设计文档（桌面端视角）',  'write_document',    '已完成桌面端设计',         true],
    [2, 'Fail: 未考虑移动端适配，直接提交', 'send_mail',        '已发送',                  true],
  ]},
]
for (const {taskId, daysBack, steps} of l3Data) {
  const base = daysAgo(daysBack)
  for (const [stepIdx, thought, action, observation, converged] of steps) {
    const ts = new Date(base.getTime() + stepIdx * 5 * 60_000).toISOString()
    writeL3Step(LOGS_DIR, {agentId: 'pm', taskId, stepIdx, thought, action, observation, converged, timestamp: ts})
  }
}
console.log('[SEED] PM L3 步骤日志已写入：3 个失败任务')

// ── L3 v6 格式：sessions/*_raw.jsonl + index.jsonl ────────────────────────
const sessionData = [
  {taskId: 't001', daysBack: 6, messages: [
    {role: 'assistant', content: '读取需求文档，了解登录功能要求'},
    {role: 'tool',      content: '已读取，要求：邮箱登录+密码'},
    {role: 'assistant', content: '开始撰写产品规格文档'},
    {role: 'tool',      content: '已写入基本结构'},
    {role: 'assistant', content: '文档完成，发送完成通知'},
    {role: 'tool',      content: '已发送 task_done 给 manager'},
  ]},
  {taskId: 't003', daysBack: 5, messages: [
    {role: 'assistant', content: '读取需求文档和前一版设计文档'},
    {role: 'tool',      content: '已读取'},
    {role: 'assistant', content: '撰写v2文档，修改登录页面描述'},
    {role: 'tool',      content: '已更新产品文档'},
    {role: 'assistant', content: '检查是否覆盖所有需求点'},
    {role: 'tool',      content: 'Error: 发现缺少错误状态处理，表单验证逻辑缺失'},
    {role: 'assistant', content: '补充错误处理，但未完整覆盖'},
    {role: 'tool',      content: '部分补充'},
  ]},
  {taskId: 't006', daysBack: 2, messages: [
    {role: 'assistant', content: '读取需求文档'},
    {role: 'tool',      content: '需求：注册流程+移动端优先'},
    {role: 'assistant', content: '撰写产品设计文档（桌面端视角）'},
    {role: 'tool',      content: '已完成桌面端设计'},
    {role: 'assistant', content: 'Fail: 未考虑移动端适配，直接提交'},
    {role: 'tool',      content: '已发送'},
  ]},
]
for (const {taskId, daysBack, messages} of sessionData) {
  appendSessionMessages(PM_SESSIONS_DIR, 'demo_article3', 'pm', taskId, messages, daysAgo(daysBack))
}
console.log('[SEED] PM session L3 日志已写入（v6 格式）')

// ── L1 日志：3 条人类纠正记录 ────────────────────────────────────────────────
const l1Data = [
  ['l1_001', 'checkpoint_rejected', '设计文档退回：t001', '缺少移动端适配方案，请重新设计',         5],
  ['l1_002', 'checkpoint_rejected', '设计文档退回：t003', '交互细节不足，表单验证逻辑缺失',         4],
  ['l1_003', 'checkpoint_rejected', '设计文档退回：t006', '未考虑桌面端/移动端差异，需补充多端设计', 1],
]
for (const [msgId, type_, subject, content, n] of l1Data) {
  writeL1(LOGS_DIR, {msgId, from_: 'manager', to: 'human', type_,
    subject, content, timestamp: daysAgo(n).toISOString()})
}
console.log(`[SEED] L1 人类纠正日志已写入：${l1Data.length} 条`)

// ── 重置 PM product_design SKILL.md 到 baseline ──────────────────────────
const baseline = path.join(WORKSPACE, 'pm', 'baselines', 'product_design_skill.md')
const target   = path.join(WORKSPACE, 'pm', 'skills', 'product_design', 'SKILL.md')
if (fs.existsSync(baseline)) {
  fs.copyFileSync(baseline, target)
  console.log('[SEED] product_design SKILL.md 已重置到 baseline')
} else {
  console.warn('[SEED] baseline 文件不存在，跳过重置')
}

console.log('[SEED] 完成！')
