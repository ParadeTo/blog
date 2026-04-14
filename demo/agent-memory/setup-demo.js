/**
 * setup-demo.js
 * 重置 workspace 到"使用了几个月"的状态，用于演示 memory-governance。
 * 用法：node setup-demo.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WS = path.join(__dirname, 'workspace')
const MEM = path.join(WS, 'memory')
const SESSIONS = path.join(WS, 'sessions')
const SKILLS = path.join(__dirname, 'skills')

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  console.log(`  ✓ ${path.relative(__dirname, filePath)}`)
}

function rm(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true })
    console.log(`  ✗ ${path.relative(__dirname, filePath)} (removed)`)
  }
}

console.log('=== 重置 Demo 环境 ===\n')

// ── workspace 核心文件 ─────────────────────────────────────────────

console.log('[workspace]')

write(path.join(WS, 'soul.md'),
`你是小橙，一个私人助理 Agent。
性格：务实、简洁、偶尔幽默。
原则：先确认再执行，不确定就问。
`)

write(path.join(WS, 'user.md'),
`姓名：小明
职业：前端工程师
偏好：喜欢 TypeScript，用 VSCode，早上喝美式咖啡
回复风格：简洁，不要太多废话
`)

// 故意制造冲突：user.md 说"简洁"，agent.md 说"详细"
write(path.join(WS, 'agent.md'),
`工作流程：
1. 收到任务先拆解步骤
2. 每步完成后汇报进度
3. 遇到模糊需求主动澄清

回复原则：
1. 回答要详细，每个步骤都解释清楚
2. 代码示例附带注释

工具使用规则：
- 优先用已有工具完成任务
- 文件操作前先确认路径
- 搜索结果只取前 3 条
`)

// ── memory 索引 + topic 文件 ──────────────────────────────────────

console.log('[memory]')

// 索引里故意埋了问题：
// 1. tech_stack.md 不存在（死链）
// 2. code_reviwe.md 拼写错误（路由错配）
// 3. investment.md 超过 180 天（过期）
// 4. meeting_notes.md 存在但不在索引里（野文档）
write(path.join(MEM, 'MEMORY.md'),
`# 记忆索引

- 前端技术栈偏好 → memory/tech_stack.md  [created: 2025-10-20, updated: 2025-10-20]
- 投资笔记 → memory/investment.md  [created: 2025-11-03, updated: 2025-11-03]
- 周报格式 → memory/weekly_report.md  [created: 2026-01-15, updated: 2026-03-10]
- 代码审查规范 → memory/code_reviwe.md  [created: 2026-02-08, updated: 2026-02-08]
- 咖啡偏好  [created: 2026-03-01, updated: 2026-03-01]
`)

// 故意不创建 tech_stack.md（死链）

write(path.join(MEM, 'investment.md'),
`# 投资笔记

- 关注港股科技板块，主要看腾讯、阿里、美团
- 分析流程：先查实时行情，再看近期新闻，最后做技术面总结
- 仓位控制：单只不超过总仓位 20%
`)

write(path.join(MEM, 'weekly_report.md'),
`# 周报格式

- 每周五下午提交
- 格式：本周完成 / 下周计划 / 风险项
- 发送到 #team-frontend 频道
`)

// 实际文件名是 code_review.md，但索引写的是 code_reviwe.md（路由错配）
write(path.join(MEM, 'code_review.md'),
`# 代码审查规范

- PR 必须有至少一个 reviewer approve
- 单个 PR 不超过 400 行
- commit message 用中文，格式：feat/fix/refactor: 描述
`)

// 野文档：存在但不在索引里
write(path.join(MEM, 'meeting_notes.md'),
`# 会议记录模板

- 标题：YYYY-MM-DD 会议主题
- 参与人
- 讨论要点
- Action Items（负责人 + 截止日期）
`)

// ── sessions 清空 ────────────────────────────────────────────────

console.log('[sessions]')
write(path.join(SESSIONS, 'ctx.json'), '[]')
write(path.join(SESSIONS, 'raw.jsonl'), '')

// ── skills 清理已生成的技能（保留核心三个） ─────────────────────

console.log('[skills]')
const coreSkills = new Set(['memory-save.md', 'memory-governance.md', 'skill-creator.md'])
for (const entry of fs.readdirSync(SKILLS, { withFileTypes: true })) {
  if (!coreSkills.has(entry.name)) {
    rm(path.join(SKILLS, entry.name))
  }
}

console.log('\n=== Done! 运行 node index.js 开始 Demo ===')
console.log('试试以下命令：')
console.log('  1. 我喜欢代码注释用中文          → memory-save')
console.log('  2. 帮我写个站会消息              → 然后说"保存成技能" → skill-creator')
console.log('  3. 帮我审计一下记忆文件           → memory-governance')
