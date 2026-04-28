# ai-agent-digital-team-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 JS demo 上扩展 Human 介入机制，并写一篇配套博客文章。

**Architecture:** 在 `demo/ai-agent-digital-team/` 目录上直接扩展，新增 `human-cli.js`（Human 端异步 CLI）、`sop-setup.js`（SOP 共创入口），将 `run-manager.js` 改造为五阶段状态机，新增四个 Manager Skill（SKILL.md），扩展 `mailbox_cli.js` 支持 `check-human` 子命令和 human.json 权限校验。

**Tech Stack:** Node.js (ESM), enquirer（交互式 CLI），ai-sdk/anthropic，现有 Podman sandbox

---

## File Map

| 操作 | 文件 |
|------|------|
| 修改 | `demo/ai-agent-digital-team/package.json` |
| 修改 | `demo/ai-agent-digital-team/digital-worker.js` |
| 修改 | `demo/ai-agent-digital-team/run-manager.js` |
| 修改 | `demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js` |
| 修改 | `demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts/init_workspace.js` |
| 修改 | `demo/ai-agent-digital-team/workspace/manager/agent.md` |
| 新增 | `demo/ai-agent-digital-team/human-cli.js` |
| 新增 | `demo/ai-agent-digital-team/sop-setup.js` |
| 新增 | `demo/ai-agent-digital-team/workspace/shared/mailboxes/human.json` |
| 新增 | `demo/ai-agent-digital-team/workspace/manager/skills/notify_human/SKILL.md` |
| 新增 | `demo/ai-agent-digital-team/workspace/manager/skills/requirements_discovery/SKILL.md` |
| 新增 | `demo/ai-agent-digital-team/workspace/manager/skills/sop_creator/SKILL.md` |
| 新增 | `demo/ai-agent-digital-team/workspace/manager/skills/sop_selector/SKILL.md` |
| 新增 | `source/_posts/ai-agent-digital-team-2.md`（博客文章） |

---

## Task 1: 安装新依赖

**Files:**
- Modify: `demo/ai-agent-digital-team/package.json`

- [ ] **Step 1: 在 package.json 中添加 enquirer 依赖**

将 `package.json` 改为：

```json
{
  "name": "ai-agent-digital-team-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "manager": "node run-manager.js",
    "pm": "node run-pm.js",
    "sop-setup": "node sop-setup.js",
    "human": "node human-cli.js",
    "build": "podman build -f Dockerfile.sandbox -t digital-team-sandbox ."
  },
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "zod": "^3.23.0",
    "enquirer": "^2.4.1"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd demo/ai-agent-digital-team
pnpm install
```

预期输出：包含 `enquirer` 的安装确认。

- [ ] **Step 3: 提交**

```bash
git add demo/ai-agent-digital-team/package.json demo/ai-agent-digital-team/pnpm-lock.yaml
git commit -m "feat(digital-team): add enquirer dependency"
```

---

## Task 2: 扩展 digital-worker.js（新增 listDir 工具 + SKILL.md 自动加载）

**Files:**
- Modify: `demo/ai-agent-digital-team/digital-worker.js`

- [ ] **Step 1: 更新 loadWorkspaceContext，自动加载 SKILL.md 文件**

将 `digital-worker.js` 的 `loadWorkspaceContext` 函数替换为：

```javascript
function loadWorkspaceContext(workspaceDir) {
  const files = ['soul.md', 'agent.md', 'user.md', 'memory.md']
  const parts = []
  for (const file of files) {
    const filePath = path.join(workspaceDir, file)
    if (fs.existsSync(filePath)) {
      parts.push(`## ${file}\n\n${fs.readFileSync(filePath, 'utf-8')}`)
    }
  }

  const skillsDir = path.join(workspaceDir, 'skills')
  if (fs.existsSync(skillsDir)) {
    const skillFiles = []
    function findSkills(dir) {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) findSkills(fullPath)
        else if (entry.name === 'SKILL.md') skillFiles.push(fullPath)
      }
    }
    findSkills(skillsDir)
    for (const skillFile of skillFiles.sort()) {
      const skillName = path.basename(path.dirname(skillFile))
      parts.push(`## Skill: ${skillName}\n\n${fs.readFileSync(skillFile, 'utf-8')}`)
    }
  }

  return parts.join('\n\n---\n\n')
}
```

- [ ] **Step 2: 在 createDigitalWorker 的 tools 对象中新增 listDir 工具**

在 `tools` 对象中，在 `writeFile` 之后添加：

```javascript
    listDir: tool({
      description: '列出目录中的文件名（使用宿主机绝对路径）',
      parameters: z.object({
        dirPath: z.string().describe('目录的绝对路径（宿主机路径）'),
      }),
      execute: async ({dirPath}) => {
        try {
          if (!fs.existsSync(dirPath)) return JSON.stringify([])
          return JSON.stringify(fs.readdirSync(dirPath))
        } catch (e) {
          return `读取目录失败: ${e.message}`
        }
      },
    }),
```

- [ ] **Step 3: 在 kickoff 的 system prompt 路径说明中加上 listDir**

将 system prompt 中的路径说明部分更新为：

```javascript
        system: `你是一名数字员工。以下是你的身份、工作规范和记忆：\n\n${context}\n\n---\n\n## 路径说明\n\n**readFile / writeFile / listDir** 使用宿主机绝对路径：\n- 你的私有工作区：${workspaceDir}（容器内对应 /workspace）\n- 共享工作区：${sharedDir}（容器内对应 /mnt/shared）\n\n**run_script 的参数**使用容器内路径（/mnt/shared/...）`,
```

- [ ] **Step 4: 验证加载逻辑**

```bash
cd demo/ai-agent-digital-team
node --check digital-worker.js && echo "语法检查通过"
```

预期输出：`语法检查通过`

- [ ] **Step 5: 提交**

```bash
git add demo/ai-agent-digital-team/digital-worker.js
git commit -m "feat(digital-team): add listDir tool and auto-load SKILL.md files"
```

---

## Task 3: 扩展 mailbox_cli.js（check-human 子命令 + human.json 权限校验）

**Files:**
- Modify: `demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js`

- [ ] **Step 1: 在 send case 顶部添加 human.json 权限校验**

在 `switch (command)` 的 `case 'send':` 开始处（调用 `send(...)` 之前）插入：

```javascript
  case 'send': {
    if (args.to === 'human' && args.from !== 'manager') {
      console.log(JSON.stringify({errcode: 1, errmsg: '权限拒绝：只有 manager 可以向 human 发消息'}))
      process.exit(1)
    }
    send({
      mailboxesDir: args['mailboxes-dir'],
      from: args.from,
      to: args.to,
      type: args.type,
      subject: args.subject,
      content: args.content,
    })
    break
  }
```

注意：原来的 `case 'send':` 没有花括号，需要同时将其包裹为 `case 'send': { ... break }` 的形式。

- [ ] **Step 2: 添加 checkHuman 函数**

在 `resetStale` 函数之后、`const [,, command, ...rest] = process.argv` 之前添加：

```javascript
function checkHuman({mailboxesDir, type}) {
  const filePath = path.join(mailboxesDir, 'human.json')
  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({confirmed: false, reason: 'no_file'}))
    return
  }
  const messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const msg = messages.filter(m => m.type === type).pop()
  if (!msg) {
    console.log(JSON.stringify({confirmed: false, reason: 'no_message'}))
  } else if (!msg.read) {
    console.log(JSON.stringify({confirmed: false, reason: 'not_read'}))
  } else if (msg.rejected) {
    console.log(JSON.stringify({confirmed: false, reason: 'rejected', human_feedback: msg.human_feedback || null}))
  } else {
    console.log(JSON.stringify({confirmed: true}))
  }
}
```

- [ ] **Step 3: 在 switch 中添加 check-human case**

在 `default:` 之前添加：

```javascript
  case 'check-human':
    checkHuman({mailboxesDir: args['mailboxes-dir'], type: args.type})
    break
```

- [ ] **Step 4: 手动验证（无 human.json 时应返回 confirmed: false）**

```bash
cd demo/ai-agent-digital-team
node workspace/manager/skills/mailbox/scripts/mailbox_cli.js \
  check-human \
  --mailboxes-dir workspace/shared/mailboxes \
  --type needs_confirm
```

预期输出：`{"confirmed":false,"reason":"no_file"}` 或 `{"confirmed":false,"reason":"no_message"}`

- [ ] **Step 5: 提交**

```bash
git add demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js
git commit -m "feat(digital-team): add check-human subcommand and human.json permission check"
```

---

## Task 4: 更新 init_workspace.js（新增 sop/ 目录 + human.json）

**Files:**
- Modify: `demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts/init_workspace.js`

- [ ] **Step 1: 在 init_workspace.js 中新增 sop/ 目录初始化**

在 `mkdirIfAbsent(path.join(sharedDir, 'mailboxes'))` 之后添加：

```javascript
mkdirIfAbsent(path.join(sharedDir, 'sop'))
```

同时在 mailboxes 初始化循环之后添加 human.json 初始化：

```javascript
writeIfAbsent(path.join(sharedDir, 'mailboxes', 'human.json'), '[]')
```

完整修改后的文件：

```javascript
#!/usr/bin/env node
/**
 * 初始化共享工作区目录结构（幂等）
 *
 * 用法：
 *   node init_workspace.js --shared-dir /mnt/shared --roles manager,pm
 */

import fs from 'fs'
import path from 'path'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    args[argv[i].slice(2)] = argv[i + 1]
    i++
  }
}

const sharedDir = args['shared-dir']
const roles = (args.roles || 'manager,pm').split(',').filter(r => r !== 'human')
const created = []

function mkdirIfAbsent(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true})
    created.push(dir)
  }
}

function writeIfAbsent(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, content, 'utf-8')
    created.push(filePath)
  }
}

mkdirIfAbsent(path.join(sharedDir, 'needs'))
mkdirIfAbsent(path.join(sharedDir, 'design'))
mkdirIfAbsent(path.join(sharedDir, 'sop'))
mkdirIfAbsent(path.join(sharedDir, 'mailboxes'))

for (const role of roles) {
  writeIfAbsent(path.join(sharedDir, 'mailboxes', `${role}.json`), '[]')
}
writeIfAbsent(path.join(sharedDir, 'mailboxes', 'human.json'), '[]')

console.log(JSON.stringify({ok: true, created}))
```

- [ ] **Step 2: 验证**

```bash
cd demo/ai-agent-digital-team
node workspace/manager/skills/init_project/scripts/init_workspace.js \
  --shared-dir /tmp/test-shared \
  --roles manager,pm
ls /tmp/test-shared/
```

预期输出包含：`design  mailboxes  needs  sop`

```bash
ls /tmp/test-shared/mailboxes/
```

预期输出包含：`human.json  manager.json  pm.json`

```bash
rm -rf /tmp/test-shared
```

- [ ] **Step 3: 提交**

```bash
git add demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts/init_workspace.js
git commit -m "feat(digital-team): init sop/ dir and human.json in workspace setup"
```

---

## Task 5: 创建四个 Manager SKILL.md 文件

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/manager/skills/notify_human/SKILL.md`
- Create: `demo/ai-agent-digital-team/workspace/manager/skills/requirements_discovery/SKILL.md`
- Create: `demo/ai-agent-digital-team/workspace/manager/skills/sop_creator/SKILL.md`
- Create: `demo/ai-agent-digital-team/workspace/manager/skills/sop_selector/SKILL.md`

- [ ] **Step 1: 创建 notify_human/SKILL.md**

```markdown
---
name: notify_human
type: reference
description: 通知 Human 在关键节点介入确认。规定何时通知、何时不通知、通知类型和内容格式。
---

# 通知 Human

## 单一接口原则

**只有 Manager 可以向 human.json 发消息**。PM 不能直接联系 Human——mailbox_cli.js 会校验 --from 字段，非 manager 发送会被拒绝（errcode=1）。

## 通知类型

| type | 触发时机 |
|------|---------|
| needs_confirm | 需求文档写好后，请 Human 确认 |
| sop_draft_confirm | SOP 草稿完成后，请 Human 审阅 |
| sop_confirm | SOP 选定后，请 Human 确认 |
| checkpoint_request | 关键交付物完成后，请 Human 审阅 |
| error_alert | 遇到无法自行处理的异常 |

## 何时通知（必须通知）

- 需求文档写好后（needs_confirm）
- SOP 选定后（sop_confirm）
- 遇到连续工具失败、超出授权操作等异常（error_alert）

## 何时不通知（禁止打扰）

- Manager ↔ PM 之间的常规邮件往来
- 不需要决策的常规进度步骤

## 发送方式

```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "manager",
  "--to", "human",
  "--type", "{type}",
  "--subject", "{简洁主题，不超过15字}",
  "--content", "{文件路径 + 1-2句说明}"
])
```

## 检查 Human 是否已确认

```
run_script("mailbox/scripts/mailbox_cli.js", [
  "check-human",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--type", "{type}"
])
```

返回 `{"confirmed": true}` 表示已确认可继续推进；`{"confirmed": false}` 表示未确认，本轮结束等待。

## 发送后

**不要阻塞等待**。发完消息后完成当前能做的事然后结束本轮。Human 会通过 human-cli.js 回复，下次运行时再检查确认状态。
```

- [ ] **Step 2: 创建 requirements_discovery/SKILL.md**

```markdown
---
name: requirements_discovery
type: reference
description: 需求澄清框架（四维度）。收到新项目需求时，主动识别缺失信息，写入 requirements.md，通知 Human 确认。
---

# 需求澄清

收到新项目需求时，先澄清再分配任务。**没有 Human 确认的需求文档，不分配任何任务。**

## 四维框架

分析需求，识别哪些信息缺失：

1. **目标**：要解决什么问题？成功标准是什么？
2. **边界**：哪些在范围内？哪些明确不做？
3. **约束**：时间、技术、资源限制？
4. **风险**：已知风险或不确定性？

## 工作流程

### Step 1 — 分析需求并写入 requirements.md

用 `writeFile` 写入宿主机路径（{sharedDir}/needs/requirements.md）：

```markdown
# 项目需求文档

## 项目背景
（描述用户原始需求）

## 目标
（要解决的问题和成功标准）

## 边界
### 范围内
- （功能列表）

### 范围外
- （明确不做的内容）

## 约束
（时间、技术、资源限制）

## 风险
（已知风险或不确定性）

## 待澄清（需 Human 确认）
1. （缺失信息较多时填写；需求已明确则写"无"）
```

### Step 2 — 通知 Human

调用 notify_human Skill，发送 needs_confirm 消息：
- 主题：「需求文档待确认」
- 内容：需求文档路径

## 注意事项

- 有歧义的点必须标注，不要自行猜测填充
- 澄清轮次上限 3 轮，超过后标注「已达最大轮次，依当前理解推进」
```

- [ ] **Step 3: 创建 sop_creator/SKILL.md**

```markdown
---
name: sop_creator
type: reference
description: 与 Human 共同设计 SOP 模板。基于四要素框架生成草稿，通知 Human 审阅。
---

# SOP 创建

## SOP 四要素框架

| 要素 | 说明 |
|------|------|
| 角色分工 | 哪些角色参与？各自职责边界 |
| 执行步骤 | 按顺序列出，每步有明确输入/输出 |
| Checkpoint | 哪些环节需要 Human 确认才能继续 |
| 质量标准 | 每步的验收标准 |

## 工作流程

### Step 1 — 生成 SOP 草稿

用 `writeFile` 写入宿主机路径 `{sharedDir}/sop/draft_{名称}_sop.md`：

```markdown
# {名称} 标准操作流程（SOP）

## 角色分工
| 角色 | 职责 |
|------|------|
| Manager | 初始化工作区，澄清需求，分配任务，验收产出 |
| PM | 读取需求，产出产品规格文档，回邮通知 |
| Human | 确认需求文档，审阅关键交付物 |

## 执行步骤
| 步骤 | 执行者 | 操作 | 输入 | 输出 |
|------|--------|------|------|------|
| 1 | Manager | 初始化工作区 + 需求澄清 | 用户原始需求 | requirements.md |
| 2 | Human | 确认需求文档 | requirements.md | 确认/拒绝 |
| 3 | Manager | 选 SOP 并确认 | SOP 模板库 | active_sop.md |
| 4 | Human | 确认 SOP 选择 | active_sop.md | 确认/拒绝 |
| 5 | Manager | 分配任务给 PM | requirements.md | task_assign 邮件 |
| 6 | PM | 产出产品规格文档 | requirements.md | product_spec.md |
| 7 | Manager | 验收 PM 产出 | product_spec.md | review_result.md |

## Checkpoint
| Checkpoint | 触发时机 | 确认内容 |
|------------|---------|---------|
| CP1 | 需求文档完成后 | 需求是否准确完整 |
| CP2 | SOP 选定后 | 流程设计是否合理 |

## 质量标准
| 交付物 | 验收标准 |
|--------|---------|
| 需求文档 | 包含目标/边界/约束/风险四维度 |
| 产品文档 | 包含用户故事和验收标准 |
```

### Step 2 — 通知 Human 审阅

用 notify_human Skill 发送 sop_draft_confirm 消息：
- 主题：「SOP 草稿待审阅」
- 内容：草稿路径

## 草稿命名规范

- 草稿：`draft_{名称}_sop.md`（如 `draft_product_design_sop.md`）
- Human 确认后重命名：`{名称}_sop.md`（如 `product_design_sop.md`）
```

- [ ] **Step 4: 创建 sop_selector/SKILL.md**

```markdown
---
name: sop_selector
type: task
description: 从 SOP 模板库中选出最匹配当前任务的 SOP，复制为 active_sop.md，通知 Human 确认。
---

# SOP 选择

## 步骤

### Step 1 — 读取需求文档

用 `readFile` 读取宿主机路径 `{sharedDir}/needs/requirements.md`

### Step 2 — 列出可用 SOP 模板

用 `listDir` 列出宿主机路径 `{sharedDir}/sop/` 下的文件。

过滤规则（以下文件不参与选择）：
- `draft_` 前缀的文件（未确认的草稿）
- `active_sop.md`（当前任务副本，非模板）

如果过滤后没有可用模板，输出错误并终止：「SOP 库为空，请先运行 node sop-setup.js」。

用 `readFile` 逐一读取可用模板内容：`{sharedDir}/sop/{模板名}`

### Step 3 — 评分选出最匹配 SOP

对每个可用模板评分（0-10分），说明理由，选出得分最高的。

### Step 4 — 写入 active_sop.md

用 `readFile` 读取选中模板，用 `writeFile` 写入 `{sharedDir}/sop/active_sop.md`

### Step 5 — 通知 Human 确认

用 notify_human Skill 发送 sop_confirm 消息：
- 主题：「SOP 已选定，请确认」
- 内容：选定模板名 + 选择理由 + 路径
```

- [ ] **Step 5: 验证 SKILL.md 文件被自动加载**

在所有四个 SKILL.md 创建完之后，验证文件存在：

```bash
find demo/ai-agent-digital-team/workspace/manager/skills -name "SKILL.md" | sort
```

预期输出包含四行：
```
demo/ai-agent-digital-team/workspace/manager/skills/notify_human/SKILL.md
demo/ai-agent-digital-team/workspace/manager/skills/requirements_discovery/SKILL.md
demo/ai-agent-digital-team/workspace/manager/skills/sop_creator/SKILL.md
demo/ai-agent-digital-team/workspace/manager/skills/sop_selector/SKILL.md
```

- [ ] **Step 6: 提交**

```bash
git add demo/ai-agent-digital-team/workspace/manager/skills/notify_human/ \
        demo/ai-agent-digital-team/workspace/manager/skills/requirements_discovery/ \
        demo/ai-agent-digital-team/workspace/manager/skills/sop_creator/ \
        demo/ai-agent-digital-team/workspace/manager/skills/sop_selector/
git commit -m "feat(digital-team): add Manager skills for human intervention (notify_human, requirements_discovery, sop_creator, sop_selector)"
```

---

## Task 6: 更新 manager/agent.md（新增工具 + 新增工作场景）

**Files:**
- Modify: `demo/ai-agent-digital-team/workspace/manager/agent.md`

- [ ] **Step 1: 更新 agent.md 全文**

将 `workspace/manager/agent.md` 替换为：

```markdown
# Manager 工作规范

## 工具

| 工具 | 用途 |
|------|------|
| `readFile(filePath)` | 读取文件内容（宿主机绝对路径） |
| `writeFile(filePath, content)` | 写入文件（宿主机绝对路径） |
| `listDir(dirPath)` | 列出目录中的文件名（宿主机绝对路径） |
| `run_script(scriptPath, args)` | 在沙盒中执行脚本（容器内路径） |

## 邮箱操作（通过 run_script）

脚本路径（相对于 workspace/skills/）：`mailbox/scripts/mailbox_cli.js`

**发送邮件（Agent 之间）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "manager",
  "--to", "pm",
  "--type", "task_assign",
  "--subject", "产品文档设计任务",
  "--content", "请阅读 /mnt/shared/needs/requirements.md，产出写入 /mnt/shared/design/product_spec.md"
])
```

**发送消息给 Human（只有 Manager 可以）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "manager",
  "--to", "human",
  "--type", "needs_confirm",
  "--subject", "需求文档待确认",
  "--content", "/mnt/shared/needs/requirements.md"
])
```

**检查 Human 是否已确认：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "check-human",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--type", "needs_confirm"
])
```
返回 `{"confirmed": true}` 表示已确认。

**读取邮箱：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "read",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager"
])
```

**标记完成：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "done",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager",
  "--msg-id", "msg-xxxxxxxx"
])
```

**崩溃恢复（每次启动先调用一次）：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "reset-stale",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager",
  "--timeout-minutes", "15"
])
```

## 技能（Skills）

以下 Skill 已自动加载，按需调用：

| Skill | 用途 |
|-------|------|
| notify_human | 向 Human 发通知、检查 Human 是否已确认 |
| requirements_discovery | 四维需求澄清 → 写 requirements.md → 通知 Human |
| sop_selector | 从模板库选 SOP → 写 active_sop.md → 通知 Human |
| sop_creator | 生成 SOP 草稿 → 通知 Human 审阅 |

## 团队成员

| 角色 | 职责 | 接受的任务类型 |
|------|------|--------------|
| PM | 产品规格设计 | task_assign（含需求路径） |
```

- [ ] **Step 2: 提交**

```bash
git add demo/ai-agent-digital-team/workspace/manager/agent.md
git commit -m "feat(digital-team): update manager agent.md with listDir tool and new skills reference"
```

---

## Task 7: 创建 human-cli.js

**Files:**
- Create: `demo/ai-agent-digital-team/human-cli.js`

- [ ] **Step 1: 创建 human-cli.js 全文**

```javascript
#!/usr/bin/env node
/**
 * Human 端消息中心
 *
 * 用法：
 *   node human-cli.js                     # 交互式模式（推荐）
 *   node human-cli.js check               # 检查未读消息（JSON 输出）
 *   node human-cli.js respond <id> y      # 确认
 *   node human-cli.js respond <id> n "意见" # 拒绝 + 反馈
 *
 * human.json 二态设计：read: false/true
 * Human 不是 Agent，不需要 in_progress 状态。
 */

import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import enquirer from 'enquirer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HUMAN_INBOX = path.join(__dirname, 'workspace', 'shared', 'mailboxes', 'human.json')

const TYPE_LABELS = {
  needs_confirm: '需求文档确认',
  sop_draft_confirm: 'SOP 草稿确认',
  sop_confirm: 'SOP 选择确认',
  checkpoint_request: '阶段交付审核',
  error_alert: '异常上报',
}

function loadInbox() {
  if (!fs.existsSync(HUMAN_INBOX)) return []
  return JSON.parse(fs.readFileSync(HUMAN_INBOX, 'utf-8'))
}

function saveInbox(messages) {
  fs.mkdirSync(path.dirname(HUMAN_INBOX), {recursive: true})
  fs.writeFileSync(HUMAN_INBOX, JSON.stringify(messages, null, 2), 'utf-8')
}

function getUnread() {
  return loadInbox().filter(m => !m.read)
}

function respond(msgId, confirmed, feedback = null) {
  const messages = loadInbox()
  let found = false
  for (const msg of messages) {
    if (msg.id === msgId) {
      msg.read = true
      if (!confirmed) {
        msg.rejected = true
        if (feedback) msg.human_feedback = feedback
      }
      found = true
      break
    }
  }
  if (found) saveInbox(messages)
  return found
}

function printMessage(msg) {
  const divider = '─'.repeat(50)
  console.log(`\n${divider}`)
  console.log(`  消息 ID : ${msg.id}`)
  console.log(`  类型    : ${TYPE_LABELS[msg.type] || msg.type}`)
  console.log(`  主题    : ${msg.subject}`)
  console.log(`  内容    : ${msg.content}`)
  console.log(`  时间    : ${msg.timestamp}`)
  console.log(divider)
}

async function interactive() {
  console.log('\n' + '='.repeat(60))
  console.log('  Human 端消息中心（异步确认模式）')
  console.log('='.repeat(60))
  console.log(`  监听: ${HUMAN_INBOX}`)
  console.log('  按 Ctrl+C 退出')
  console.log('='.repeat(60) + '\n')

  while (true) {
    const unread = getUnread()
    if (unread.length === 0) {
      process.stdout.write('  📭 没有新消息，5秒后重新检查... (Ctrl+C 退出)\r')
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    process.stdout.write('\n')
    console.log(`  📬 收到 ${unread.length} 条新消息：`)

    for (const msg of unread) {
      printMessage(msg)
      try {
        const {decision} = await enquirer.prompt({
          type: 'select',
          name: 'decision',
          message: '你的决定',
          choices: ['✅ 确认 (y)', '❌ 拒绝 (n)'],
        })

        const confirmed = decision.startsWith('✅')
        let feedback = null

        if (!confirmed) {
          const {fb} = await enquirer.prompt({
            type: 'input',
            name: 'fb',
            message: '修改意见（直接回车跳过）',
          })
          feedback = fb.trim() || null
        }

        const ok = respond(msg.id, confirmed, feedback)
        if (ok) {
          if (confirmed) {
            console.log(`  ✅ 已确认：${msg.subject}`)
          } else {
            console.log(`  ↩️  已拒绝：${msg.subject}${feedback ? `（${feedback}）` : ''}`)
          }
        }
      } catch (e) {
        if (e.message === '') {
          console.log('\n\n  已退出 Human 端')
          process.exit(0)
        }
        throw e
      }
    }
  }
}

function cmdCheck() {
  const unread = getUnread()
  if (unread.length === 0) {
    console.log(JSON.stringify({status: 'no_unread', count: 0}))
    return
  }
  console.log(JSON.stringify({
    status: 'has_unread',
    count: unread.length,
    messages: unread.map(m => ({id: m.id, type: m.type, subject: m.subject})),
  }, null, 2))
}

function cmdRespond(msgId, decision, feedback) {
  const confirmed = decision === 'y'
  const ok = respond(msgId, confirmed, feedback || null)
  if (ok) {
    console.log(JSON.stringify({errcode: 0, msg_id: msgId, confirmed, feedback: feedback || null}))
  } else {
    console.log(JSON.stringify({errcode: 1, errmsg: `消息 ${msgId} 不存在或已被处理`}))
    process.exit(1)
  }
}

const [,, command, ...rest] = process.argv

if (command === 'check') {
  cmdCheck()
} else if (command === 'respond') {
  const [msgId, decision, feedback] = rest
  if (!msgId || !['y', 'n'].includes(decision)) {
    console.error('用法：node human-cli.js respond <msg_id> y/n [feedback]')
    process.exit(1)
  }
  cmdRespond(msgId, decision, feedback)
} else {
  interactive().catch(e => {console.error(e); process.exit(1)})
}
```

- [ ] **Step 2: 验证 check 模式（无消息时）**

```bash
cd demo/ai-agent-digital-team
node human-cli.js check
```

预期输出：`{"status":"no_unread","count":0}`

- [ ] **Step 3: 验证 respond 模式（消息不存在时）**

```bash
node human-cli.js respond msg-0000 y
```

预期输出：`{"errcode":1,"errmsg":"消息 msg-0000 不存在或已被处理"}`

- [ ] **Step 4: 提交**

```bash
git add demo/ai-agent-digital-team/human-cli.js
git commit -m "feat(digital-team): add human-cli.js with enquirer interactive mode"
```

---

## Task 8: 创建 sop-setup.js

**Files:**
- Create: `demo/ai-agent-digital-team/sop-setup.js`

- [ ] **Step 1: 创建 sop-setup.js 全文**

```javascript
/**
 * SOP 共创入口（项目初始化前运行一次）
 *
 * 运行流程：
 *   第1次运行：Manager 生成 SOP 草稿 → 发 sop_draft_confirm → 退出
 *   Human 确认：node human-cli.js
 *   第2次运行：检测到草稿已确认 → 重命名为正式模板 → 完成
 */

import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'manager')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function getSopDraftConfirmStatus() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const msg = humanInbox.filter(m => m.type === 'sop_draft_confirm').pop()
  if (!msg) return 'not_sent'
  if (!msg.read) return 'pending'
  if (msg.rejected) return 'rejected'
  return 'confirmed'
}

async function main() {
  fs.mkdirSync(path.join(SHARED_DIR, 'mailboxes'), {recursive: true})
  fs.mkdirSync(path.join(SHARED_DIR, 'sop'), {recursive: true})

  const humanInboxPath = path.join(SHARED_DIR, 'mailboxes', 'human.json')
  if (!fs.existsSync(humanInboxPath)) fs.writeFileSync(humanInboxPath, '[]', 'utf-8')

  const status = getSopDraftConfirmStatus()

  if (status === 'confirmed') {
    console.log('\n[SOP Setup] 草稿已确认，正在重命名为正式模板...')
    const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
    const result = await worker.kickoff(
      `Human 已确认 SOP 草稿。请执行以下步骤：\n` +
      `1. 用 listDir 列出宿主机路径 ${SHARED_DIR}/sop/ 下的文件\n` +
      `2. 找到所有 draft_ 前缀的文件\n` +
      `3. 用 readFile 读取每个草稿内容，用 writeFile 写入去掉 draft_ 前缀的新文件名\n` +
      `4. 输出最终模板文件路径列表`
    )
    console.log('\n[SOP Setup] 完成\n', result)
  } else if (status === 'pending') {
    console.log('\n[SOP Setup] SOP 草稿已发送，等待 Human 确认。')
    console.log('请运行：node human-cli.js')
  } else if (status === 'rejected') {
    console.log('\n[SOP Setup] Human 拒绝了 SOP 草稿，正在重新生成...')
    const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
    const result = await worker.kickoff(
      `Human 拒绝了上一版 SOP 草稿。请用 sop_creator Skill 重新设计一版，` +
      `并用 notify_human Skill 发送新的 sop_draft_confirm 消息。`
    )
    console.log('\n[SOP Setup] 新草稿已生成\n', result)
  } else {
    console.log('\n[SOP Setup] 开始创建产品设计 SOP 模板...')
    const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
    const result = await worker.kickoff(
      `请使用 sop_creator Skill，为"产品设计"场景创建一个 SOP 模板。\n` +
      `场景：接收需求 → PM 完成产品规格文档 → Manager 验收。\n` +
      `完成后用 notify_human Skill 发送 sop_draft_confirm 消息。\n` +
      `注意：writeFile 使用宿主机路径，sop 目录位于 ${SHARED_DIR}/sop/`
    )
    console.log('\n[SOP Setup] SOP 草稿已生成\n', result)
  }
}

main().catch(e => {console.error(e); process.exit(1)})
```

- [ ] **Step 2: 验证（语法检查）**

```bash
cd demo/ai-agent-digital-team
node --check sop-setup.js && echo "语法检查通过"
```

预期输出：`语法检查通过`

- [ ] **Step 3: 提交**

```bash
git add demo/ai-agent-digital-team/sop-setup.js
git commit -m "feat(digital-team): add sop-setup.js for SOP co-creation workflow"
```

---

## Task 9: 更新 run-manager.js（五阶段状态机）

**Files:**
- Modify: `demo/ai-agent-digital-team/run-manager.js`

- [ ] **Step 1: 用五阶段状态机替换 run-manager.js 全文**

```javascript
import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'manager')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')
const DEMO_INPUT = path.join(__dirname, 'demo-input', 'project_requirement.md')

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

/**
 * 通过检查邮箱状态判断当前处于哪个阶段：
 *   1 - 需求澄清（needs_confirm 未发送或未确认）
 *   2 - SOP 选择（needs_confirm 已确认，sop_confirm 未确认）
 *   3 - 任务分配（sop_confirm 已确认，PM 无 task_assign）
 *   4 - 等待 PM（PM 有 task_assign，Manager 无 task_done）
 *   5 - 验收（Manager 有待处理的 task_done）
 */
function detectPhase() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const managerInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'manager.json'))
  const pmInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'pm.json'))

  const taskDone = managerInbox.find(m => m.type === 'task_done' && m.status !== 'done')
  if (taskDone) return 5

  const taskAssign = pmInbox.find(m => m.type === 'task_assign' && m.status !== 'done')
  if (taskAssign) return 4

  const sopConfirm = humanInbox.filter(m => m.type === 'sop_confirm').pop()
  if (sopConfirm && sopConfirm.read && !sopConfirm.rejected) return 3

  const needsConfirm = humanInbox.filter(m => m.type === 'needs_confirm').pop()
  if (needsConfirm && needsConfirm.read && !needsConfirm.rejected) return 2

  return 1
}

async function main() {
  fs.mkdirSync(SHARED_DIR, {recursive: true})

  const phase = detectPhase()
  console.log(`\n[Manager] 当前阶段: ${phase}`)

  let userRequest

  switch (phase) {
    case 1: {
      const requirement = fs.readFileSync(DEMO_INPUT, 'utf-8')
      userRequest =
        `请执行以下步骤：\n` +
        `1. 初始化共享工作区（run_script "init_project/scripts/init_workspace.js" ` +
        `["--shared-dir", "/mnt/shared", "--roles", "manager,pm"]）\n` +
        `2. 使用 requirements_discovery Skill 分析以下需求，` +
        `将需求文档写入宿主机路径 ${SHARED_DIR}/needs/requirements.md\n` +
        `3. 使用 notify_human Skill 发送 needs_confirm 消息\n\n` +
        `需求内容：\n\n${requirement}`
      break
    }
    case 2:
      userRequest =
        `需求文档已被 Human 确认。请执行以下步骤：\n` +
        `1. 使用 sop_selector Skill，从宿主机路径 ${SHARED_DIR}/sop/ 中选出最匹配的 SOP\n` +
        `2. 将选中模板内容写入 ${SHARED_DIR}/sop/active_sop.md\n` +
        `3. 使用 notify_human Skill 发送 sop_confirm 消息`
      break
    case 3:
      userRequest =
        `SOP 已被 Human 确认。请给 PM 发送 task_assign 邮件，` +
        `邮件 content 只写路径引用：\n` +
        `- 需求文档：/mnt/shared/needs/requirements.md\n` +
        `- 产出写入：/mnt/shared/design/product_spec.md\n` +
        `- SOP 参考：/mnt/shared/sop/active_sop.md`
      break
    case 4:
      console.log('[Manager] 等待 PM 完成任务，请运行：node run-pm.js')
      process.exit(0)
      break
    case 5:
      userRequest =
        `请检查邮箱（role=manager），找到 task_done 消息，读取 PM 的产出文件，` +
        `对照原始需求文档（/mnt/shared/needs/requirements.md）逐项验收，` +
        `将验收报告写入宿主机路径 ${WORKSPACE_DIR}/review_result.md，然后标记消息为 done。`
      break
  }

  const worker = await createDigitalWorker({workspaceDir: WORKSPACE_DIR, sharedDir: SHARED_DIR})
  const result = await worker.kickoff(userRequest)
  console.log('\n[Manager] 完成\n', result)
}

main().catch(e => {console.error(e); process.exit(1)})
```

- [ ] **Step 2: 验证 phase 检测逻辑（无邮箱文件时应返回 1）**

```bash
cd demo/ai-agent-digital-team
node -e "
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')
function readJson(f) { if (!fs.existsSync(f)) return []; return JSON.parse(fs.readFileSync(f, 'utf-8')) }
function detectPhase() {
  const humanInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'human.json'))
  const managerInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'manager.json'))
  const pmInbox = readJson(path.join(SHARED_DIR, 'mailboxes', 'pm.json'))
  const taskDone = managerInbox.find(m => m.type === 'task_done' && m.status !== 'done')
  if (taskDone) return 5
  const taskAssign = pmInbox.find(m => m.type === 'task_assign' && m.status !== 'done')
  if (taskAssign) return 4
  const sopConfirm = humanInbox.filter(m => m.type === 'sop_confirm').pop()
  if (sopConfirm && sopConfirm.read && !sopConfirm.rejected) return 3
  const needsConfirm = humanInbox.filter(m => m.type === 'needs_confirm').pop()
  if (needsConfirm && needsConfirm.read && !needsConfirm.rejected) return 2
  return 1
}
console.log('phase:', detectPhase())
" --input-type module
```

预期输出：`phase: 1`

- [ ] **Step 3: 提交**

```bash
git add demo/ai-agent-digital-team/run-manager.js
git commit -m "feat(digital-team): refactor run-manager.js to 5-phase state machine"
```

---

## Task 10: 初始化 human.json 文件

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/shared/mailboxes/human.json`

- [ ] **Step 1: 创建初始 human.json**

```bash
echo '[]' > demo/ai-agent-digital-team/workspace/shared/mailboxes/human.json
```

- [ ] **Step 2: 提交**

```bash
git add demo/ai-agent-digital-team/workspace/shared/mailboxes/human.json
git commit -m "feat(digital-team): add initial human.json mailbox"
```

---

## Task 11: 写博客文章

**Files:**
- Create: `source/_posts/ai-agent-digital-team-2.md`

- [ ] **Step 1: 调用 write-tech-article skill 写文章**

调用 `write-tech-article` skill，提供以下上下文：

- **文章文件名**：`ai-agent-digital-team-2.md`
- **标题**：`简单实战一下 Multi-Agent 数字员工（二）：让 Human 当甲方`
- **Tags**：ai, agent, multi-agent
- **参考资料**：`idea/multi-agent-digital-team-2/27-human-as-client.md`
- **Demo 代码位置**：`demo/ai-agent-digital-team/`（Task 1-10 实现的代码）
- **切入角度**：失控场景驱动（先还原三个失控场景，再引出三个介入点的工程实现）
- **文章结构**（见 spec：前言 → 甲方 vs 保姆 → 三个失控场景 → 单一接口原则 → 三个介入点实现 → 代码演示 → 两个反模式）
- **不要照抄**原课程内容，用自己的例子和语言改写

- [ ] **Step 2: 提交文章**

```bash
git add source/_posts/ai-agent-digital-team-2.md \
        source/_posts/ai-agent-digital-team-2/
git commit -m "blog: add ai-agent-digital-team-2 article (Human as 甲方)"
```

---

## 完整演示流程（验证）

实现完成后，完整演示应可以按以下步骤运行：

```bash
cd demo/ai-agent-digital-team

# 0. 构建沙盒（如需要）
pnpm build

# === SOP 共创（运行一次）===
node sop-setup.js        # Manager 生成 SOP 草稿 → 发 sop_draft_confirm
node human-cli.js        # Human 确认 SOP 草稿
node sop-setup.js        # 检测到确认 → 重命名为正式模板

# === 正式项目（五步）===
node run-manager.js      # 阶段1：需求澄清 → 写 requirements.md → 发 needs_confirm
node human-cli.js        # Human 确认需求
node run-manager.js      # 阶段2：选 SOP → 写 active_sop.md → 发 sop_confirm
node human-cli.js        # Human 确认 SOP
node run-manager.js      # 阶段3：给 PM 发 task_assign
node run-pm.js           # PM 执行任务 → 写 product_spec.md → 回邮 Manager
node run-manager.js      # 阶段5：验收 PM 产出 → 写 review_result.md
```
