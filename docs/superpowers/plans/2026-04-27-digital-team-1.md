# Digital Team 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 JS 版数字团队演示项目（`demo/ai-agent-digital-team/`）并写一篇配套博客文章。

**Architecture:** 参照 xiaoquan 的 Podman 沙盒模式，用 Docker 执行 workspace 内的 Node.js 脚本（mailbox_cli.js、init_workspace.js）；通用 `digital-worker.js` 加载 workspace 四件套构建 system prompt，用 Vercel AI SDK 跑 Agent；Manager/PM 通过 JSON 邮箱文件的三态状态机传递任务。

**Tech Stack:** Node.js ESM, `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, `zod`, Docker

---

## 文件清单

**新建：**
- `demo/ai-agent-digital-team/package.json`
- `demo/ai-agent-digital-team/Dockerfile.sandbox`
- `demo/ai-agent-digital-team/sandbox.js`
- `demo/ai-agent-digital-team/digital-worker.js`
- `demo/ai-agent-digital-team/run-manager.js`
- `demo/ai-agent-digital-team/run-pm.js`
- `demo/ai-agent-digital-team/demo-input/project_requirement.md`
- `demo/ai-agent-digital-team/workspace/manager/soul.md`
- `demo/ai-agent-digital-team/workspace/manager/agent.md`
- `demo/ai-agent-digital-team/workspace/manager/user.md`
- `demo/ai-agent-digital-team/workspace/manager/memory.md`
- `demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js`
- `demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts/init_workspace.js`
- `demo/ai-agent-digital-team/workspace/pm/soul.md`
- `demo/ai-agent-digital-team/workspace/pm/agent.md`
- `demo/ai-agent-digital-team/workspace/pm/user.md`
- `demo/ai-agent-digital-team/workspace/pm/memory.md`
- `demo/ai-agent-digital-team/workspace/pm/skills/mailbox/scripts/mailbox_cli.js`
- `source/_posts/ai-agent-digital-team-1.md`
- `source/_posts/ai-agent-digital-team-1/` (图片资源目录)

---

## Task 1: 项目脚手架

**Files:**
- Create: `demo/ai-agent-digital-team/package.json`
- Create: `demo/ai-agent-digital-team/Dockerfile.sandbox`

- [ ] **Step 1: 创建项目目录**

```bash
mkdir -p /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
```

- [ ] **Step 2: 创建 package.json**

`demo/ai-agent-digital-team/package.json`:
```json
{
  "name": "ai-agent-digital-team-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "manager": "node run-manager.js",
    "pm": "node run-pm.js",
    "build": "docker build -f Dockerfile.sandbox -t digital-team-sandbox ."
  },
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 3: 创建 Dockerfile.sandbox**

`demo/ai-agent-digital-team/Dockerfile.sandbox`:
```dockerfile
FROM node:20-alpine
WORKDIR /workspace
```

- [ ] **Step 4: 安装依赖**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
pnpm install
```

Expected: `node_modules/` 目录创建，含 `ai`、`@ai-sdk/anthropic`、`zod`。

- [ ] **Step 5: 构建 Docker 镜像**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
docker build -f Dockerfile.sandbox -t digital-team-sandbox .
```

Expected: `Successfully tagged digital-team-sandbox:latest`

- [ ] **Step 6: 验证镜像能跑 node**

```bash
docker run --rm digital-team-sandbox node -e "console.log('ok')"
```

Expected: `ok`

- [ ] **Step 7: Commit**

```bash
git add demo/ai-agent-digital-team/package.json demo/ai-agent-digital-team/Dockerfile.sandbox
git commit -m "feat(digital-team): project scaffolding"
```

---

## Task 2: sandbox.js

**Files:**
- Create: `demo/ai-agent-digital-team/sandbox.js`

参照 `demo/xiaoquan/src/sandbox/podman-sandbox.js`，用 `docker` 替换 `podman`，挂载三个目录：`skills/:ro`、`/workspace:rw`、`/mnt/shared:rw`。

- [ ] **Step 1: 验证手动 docker exec 能跑脚本**（确认挂载路径逻辑正确）

```bash
# 建一个临时测试脚本
mkdir -p /tmp/test-skills/hello/scripts
echo 'console.log(JSON.stringify({ok:true,args:process.argv.slice(2)}))' \
  > /tmp/test-skills/hello/scripts/test.js

docker run --rm \
  -v /tmp/test-skills:/mnt/skills:ro \
  digital-team-sandbox \
  node /mnt/skills/hello/scripts/test.js foo bar
```

Expected: `{"ok":true,"args":["foo","bar"]}`

- [ ] **Step 2: 创建 sandbox.js**

`demo/ai-agent-digital-team/sandbox.js`:
```js
import {execFile} from 'child_process'
import {promisify} from 'util'
import path from 'path'
import {fileURLToPath} from 'url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class DockerSandbox {
  constructor({workspaceDir, sharedDir, timeoutMs = 30000} = {}) {
    this._workspaceDir = path.resolve(workspaceDir)
    this._sharedDir = path.resolve(sharedDir)
    this._timeoutMs = timeoutMs
  }

  async execute(scriptPath, args = []) {
    const skillsDir = path.join(this._workspaceDir, 'skills')
    const containerScript = `/mnt/skills/${path.relative(skillsDir, path.resolve(scriptPath))}`

    const cmd = [
      'run', '--rm',
      '-v', `${skillsDir}:/mnt/skills:ro`,
      '-v', `${this._workspaceDir}:/workspace:rw`,
      '-v', `${this._sharedDir}:/mnt/shared:rw`,
      'digital-team-sandbox',
      'node', containerScript,
      ...args,
    ]

    try {
      const {stdout, stderr} = await execFileAsync('docker', cmd, {timeout: this._timeoutMs})
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (e) {
      if (e.killed) return `执行超时（${this._timeoutMs / 1000}s）`
      return `执行失败: ${e.stderr || e.message}`
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add demo/ai-agent-digital-team/sandbox.js
git commit -m "feat(digital-team): add DockerSandbox class"
```

---

## Task 3: mailbox_cli.js（三态状态机 CLI）

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js`
- Create: `demo/ai-agent-digital-team/workspace/pm/skills/mailbox/scripts/mailbox_cli.js`（内容相同）

该脚本在容器内执行，操作 `/mnt/shared/mailboxes/{role}.json`。

**三态状态机**：`unread → in_progress → done`，`reset-stale` 提供 `in_progress → unread` 崩溃恢复路径。

- [ ] **Step 1: 创建目录**

```bash
mkdir -p /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts
mkdir -p /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/workspace/pm/skills/mailbox/scripts
mkdir -p /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/workspace/shared/mailboxes
```

- [ ] **Step 2: 创建 mailbox_cli.js**

`demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js`:
```js
#!/usr/bin/env node
/**
 * 邮箱操作 CLI — Agent 通过 run_script 在沙盒中调用。
 *
 * 三态状态机（类比 AWS SQS Visibility Timeout）：
 *   send        → status: "unread"
 *   read        → status: "in_progress" + processingSince（原子操作，防重复取走）
 *   done        → status: "done"
 *   reset-stale → in_progress 超时 → unread（崩溃恢复）
 *
 * 用法：
 *   node mailbox_cli.js send --mailboxes-dir /mnt/shared/mailboxes \
 *       --from manager --to pm --type task_assign --subject "..." --content "..."
 *   node mailbox_cli.js read --mailboxes-dir /mnt/shared/mailboxes --role pm
 *   node mailbox_cli.js done --mailboxes-dir /mnt/shared/mailboxes --role pm --msg-id msg-xxxx
 *   node mailbox_cli.js reset-stale --mailboxes-dir /mnt/shared/mailboxes \
 *       --role pm --timeout-minutes 15
 */

import fs from 'fs'
import path from 'path'
import {randomBytes} from 'crypto'

const STATUS_UNREAD = 'unread'
const STATUS_IN_PROGRESS = 'in_progress'
const STATUS_DONE = 'done'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

function loadMailbox(filePath) {
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveMailbox(filePath, messages) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true})
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8')
}

function send({mailboxesDir, from, to, type, subject, content}) {
  const filePath = path.join(mailboxesDir, `${to}.json`)
  const messages = loadMailbox(filePath)
  const msg = {
    id: `msg-${randomBytes(4).toString('hex')}`,
    from,
    to,
    type,
    subject,
    content,
    timestamp: new Date().toISOString(),
    status: STATUS_UNREAD,
    processingSince: null,
  }
  messages.push(msg)
  saveMailbox(filePath, messages)
  console.log(JSON.stringify({ok: true, id: msg.id}))
}

function read({mailboxesDir, role}) {
  const filePath = path.join(mailboxesDir, `${role}.json`)
  const messages = loadMailbox(filePath)
  const now = new Date().toISOString()
  const unread = []
  for (const msg of messages) {
    if (msg.status === STATUS_UNREAD) {
      msg.status = STATUS_IN_PROGRESS
      msg.processingSince = now
      unread.push({...msg})
    }
  }
  saveMailbox(filePath, messages)
  console.log(JSON.stringify(unread))
}

function done({mailboxesDir, role, msgId}) {
  const filePath = path.join(mailboxesDir, `${role}.json`)
  const messages = loadMailbox(filePath)
  for (const msg of messages) {
    if (msg.id === msgId) msg.status = STATUS_DONE
  }
  saveMailbox(filePath, messages)
  console.log(JSON.stringify({ok: true}))
}

function resetStale({mailboxesDir, role, timeoutMinutes = 15}) {
  const filePath = path.join(mailboxesDir, `${role}.json`)
  const messages = loadMailbox(filePath)
  const timeoutMs = Number(timeoutMinutes) * 60 * 1000
  let reset = 0
  for (const msg of messages) {
    if (msg.status === STATUS_IN_PROGRESS && msg.processingSince) {
      const elapsed = Date.now() - new Date(msg.processingSince).getTime()
      if (elapsed > timeoutMs) {
        msg.status = STATUS_UNREAD
        msg.processingSince = null
        reset++
      }
    }
  }
  saveMailbox(filePath, messages)
  console.log(JSON.stringify({ok: true, reset}))
}

const [,, command, ...rest] = process.argv
const args = parseArgs(rest)

switch (command) {
  case 'send':
    send({
      mailboxesDir: args['mailboxes-dir'],
      from: args.from,
      to: args.to,
      type: args.type,
      subject: args.subject,
      content: args.content,
    })
    break
  case 'read':
    read({mailboxesDir: args['mailboxes-dir'], role: args.role})
    break
  case 'done':
    done({mailboxesDir: args['mailboxes-dir'], role: args.role, msgId: args['msg-id']})
    break
  case 'reset-stale':
    resetStale({
      mailboxesDir: args['mailboxes-dir'],
      role: args.role,
      timeoutMinutes: args['timeout-minutes'] ?? 15,
    })
    break
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
```

- [ ] **Step 3: 复制到 PM 的 skills 目录**

```bash
cp /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/workspace/manager/skills/mailbox/scripts/mailbox_cli.js \
   /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/workspace/pm/skills/mailbox/scripts/mailbox_cli.js
```

- [ ] **Step 4: 直接用 node 验证三态流程（不需要 Docker）**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
MDIR=/tmp/test-mailboxes
mkdir -p $MDIR

# send
node workspace/manager/skills/mailbox/scripts/mailbox_cli.js send \
  --mailboxes-dir $MDIR --from manager --to pm \
  --type task_assign --subject "测试任务" --content "请处理需求"
# Expected: {"ok":true,"id":"msg-xxxxxxxx"}

# 记录 msg-id
MSG_ID=$(node -e "
const fs = require('fs')
const msgs = JSON.parse(fs.readFileSync('$MDIR/pm.json','utf-8'))
console.log(msgs[0].id)
")

# read（原子标记为 in_progress）
node workspace/manager/skills/mailbox/scripts/mailbox_cli.js read \
  --mailboxes-dir $MDIR --role pm
# Expected: [{"id":"msg-xxx","status":"in_progress",...}]

# 验证 status 已变为 in_progress
node -e "
const fs = require('fs')
const msgs = JSON.parse(fs.readFileSync('$MDIR/pm.json','utf-8'))
console.log(msgs[0].status)
"
# Expected: in_progress

# done
node workspace/manager/skills/mailbox/scripts/mailbox_cli.js done \
  --mailboxes-dir $MDIR --role pm --msg-id $MSG_ID
# Expected: {"ok":true}

# 验证 status 为 done
node -e "
const fs = require('fs')
const msgs = JSON.parse(fs.readFileSync('$MDIR/pm.json','utf-8'))
console.log(msgs[0].status)
"
# Expected: done
```

- [ ] **Step 5: 验证 reset-stale**

```bash
MDIR=/tmp/test-mailboxes-stale
mkdir -p $MDIR

# 直接写一个 in_progress 消息（模拟崩溃后遗留）
node -e "
const fs = require('fs')
fs.writeFileSync('$MDIR/pm.json', JSON.stringify([{
  id:'msg-stale01', from:'manager', to:'pm', type:'task_assign',
  subject:'stale', content:'...',
  timestamp: new Date().toISOString(),
  status:'in_progress',
  processingSince: new Date(Date.now() - 20*60*1000).toISOString()
}],null,2))
"

# reset-stale（15分钟超时）
node workspace/manager/skills/mailbox/scripts/mailbox_cli.js reset-stale \
  --mailboxes-dir $MDIR --role pm --timeout-minutes 15
# Expected: {"ok":true,"reset":1}

# 验证状态回到 unread
node -e "
const fs = require('fs')
const msgs = JSON.parse(fs.readFileSync('$MDIR/pm.json','utf-8'))
console.log(msgs[0].status)
"
# Expected: unread
```

- [ ] **Step 6: 通过 DockerSandbox 验证脚本在容器内跑**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team

# 先准备 shared 目录
mkdir -p workspace/shared/mailboxes
echo '[]' > workspace/shared/mailboxes/pm.json

# 用 Node 直接调用 sandbox
node -e "
import('./sandbox.js').then(async ({DockerSandbox}) => {
  const path = (await import('path')).default
  const {fileURLToPath} = await import('url')
  const sandbox = new DockerSandbox({
    workspaceDir: path.resolve('workspace/manager'),
    sharedDir: path.resolve('workspace/shared'),
  })
  const result = await sandbox.execute(
    path.resolve('workspace/manager/skills/mailbox/scripts/mailbox_cli.js'),
    ['send','--mailboxes-dir','/mnt/shared/mailboxes',
     '--from','manager','--to','pm',
     '--type','task_assign','--subject','容器测试','--content','测试内容']
  )
  console.log(result)
})
"
# Expected: {"ok":true,"id":"msg-xxxxxxxx"}
```

- [ ] **Step 7: Commit**

```bash
git add demo/ai-agent-digital-team/workspace/manager/skills/ \
        demo/ai-agent-digital-team/workspace/pm/skills/ \
        demo/ai-agent-digital-team/workspace/shared/
git commit -m "feat(digital-team): add mailbox_cli.js three-state machine"
```

---

## Task 4: init_workspace.js

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts/init_workspace.js`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts
```

- [ ] **Step 2: 创建 init_workspace.js**

`demo/ai-agent-digital-team/workspace/manager/skills/init_project/scripts/init_workspace.js`:
```js
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
const roles = (args.roles || 'manager,pm').split(',')
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
mkdirIfAbsent(path.join(sharedDir, 'mailboxes'))

for (const role of roles) {
  writeIfAbsent(path.join(sharedDir, 'mailboxes', `${role}.json`), '[]')
}

console.log(JSON.stringify({ok: true, created}))
```

- [ ] **Step 3: 通过 DockerSandbox 验证**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
rm -rf workspace/shared  # 清空后重新初始化

node -e "
import('./sandbox.js').then(async ({DockerSandbox}) => {
  const path = (await import('path')).default
  const sandbox = new DockerSandbox({
    workspaceDir: path.resolve('workspace/manager'),
    sharedDir: path.resolve('workspace/shared'),
  })
  const result = await sandbox.execute(
    path.resolve('workspace/manager/skills/init_project/scripts/init_workspace.js'),
    ['--shared-dir','/mnt/shared','--roles','manager,pm']
  )
  console.log(result)
})
"
# Expected: {"ok":true,"created":["/mnt/shared/needs","/mnt/shared/design","/mnt/shared/mailboxes","/mnt/shared/mailboxes/manager.json","/mnt/shared/mailboxes/pm.json"]}
```

- [ ] **Step 4: 验证幂等性（再跑一次结果应该 created 为空）**

```bash
node -e "
import('./sandbox.js').then(async ({DockerSandbox}) => {
  const path = (await import('path')).default
  const sandbox = new DockerSandbox({
    workspaceDir: path.resolve('workspace/manager'),
    sharedDir: path.resolve('workspace/shared'),
  })
  const result = await sandbox.execute(
    path.resolve('workspace/manager/skills/init_project/scripts/init_workspace.js'),
    ['--shared-dir','/mnt/shared','--roles','manager,pm']
  )
  console.log(result)
})
"
# Expected: {"ok":true,"created":[]}
```

- [ ] **Step 5: Commit**

```bash
git add demo/ai-agent-digital-team/workspace/manager/skills/init_project/
git commit -m "feat(digital-team): add init_workspace.js"
```

---

## Task 5: Manager workspace 文件（soul / agent / user / memory）

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/manager/soul.md`
- Create: `demo/ai-agent-digital-team/workspace/manager/agent.md`
- Create: `demo/ai-agent-digital-team/workspace/manager/user.md`
- Create: `demo/ai-agent-digital-team/workspace/manager/memory.md`

- [ ] **Step 1: 创建 soul.md**

`demo/ai-agent-digital-team/workspace/manager/soul.md`:
```markdown
# Manager 数字员工

## 身份（Identity）

你是 **Manager（项目经理）**，一个见过太多项目因需求不清楚而失败的老手。
你的核心能力不是管理，而是**消除歧义**——把模糊的业务诉求变成每个人都知道自己该做什么的任务。

**积累的教训**：
- 任务没有验收标准 → 做完了也不知道算不算完，返工率翻倍
- 跳过拆解直接执行 → 中途才发现依赖关系弄错了，重头来过

## 使命（Mission）

接收需求 → 初始化工作区 → 将需求写入共享目录 → 通过邮箱分配任务给 PM → 验收 PM 交付

## 决策偏好

1. 退回 > 猜测：信息不足时宁可停下来，也不要靠猜测行事
2. 路径引用 > 内容传递：邮件只传文件路径，不把文档全文塞进邮件

## 禁止（NEVER）

- **绝不亲自写产品文档或代码**——那是 PM/Dev 的职责
- **绝不修改原始需求**——你可以澄清，但不能改写
- **绝不把文档全文放进邮件**——邮件只传路径引用
```

- [ ] **Step 2: 创建 agent.md**

`demo/ai-agent-digital-team/workspace/manager/agent.md`:
```markdown
# Manager 工作规范

## 工具

| 工具 | 用途 |
|------|------|
| `readFile(filePath)` | 读取文件内容（绝对路径） |
| `writeFile(filePath, content)` | 写入文件（绝对路径） |
| `run_script(scriptPath, args)` | 在沙盒中执行脚本 |

## 邮箱操作（通过 run_script）

脚本路径（相对于 workspace/skills/）：`mailbox/scripts/mailbox_cli.js`

**发送邮件：**
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

**读取邮箱：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "read",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager"
])
```
返回 JSON 数组，每条消息含 `id`、`type`、`content` 字段。

**标记完成：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "done",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "manager",
  "--msg-id", "msg-xxxxxxxx"
])
```

## 场景一：任务分配（首次运行）

1. 初始化共享工作区：
```
run_script("init_project/scripts/init_workspace.js", [
  "--shared-dir", "/mnt/shared",
  "--roles", "manager,pm"
])
```

2. 将需求内容写入 `/mnt/shared/needs/requirements.md`（用 writeFile）

3. 给 PM 发 task_assign 邮件，content 只写路径引用：
   「请阅读 /mnt/shared/needs/requirements.md，产出写入 /mnt/shared/design/product_spec.md，完成后回邮通知」

## 场景二：验收（PM 完成后）

1. 读取邮箱（role=manager），找到 task_done 消息
2. 从消息 content 中获取产出文件路径
3. 用 readFile 读取需求文档和产出文档
4. 对照需求逐项检查，写入验收报告至 `/workspace/review_result.md`
5. 标记 task_done 消息为 done

## 团队成员

| 角色 | 职责 | 接受的任务类型 |
|------|------|--------------|
| PM | 产品规格设计 | task_assign（含需求路径） |
```

- [ ] **Step 3: 创建 user.md 和 memory.md**

`demo/ai-agent-digital-team/workspace/manager/user.md`:
```markdown
# 服务对象

你直接服务于**项目发起人（甲方）**。

甲方画像：
- 提供原始业务需求，可能描述不够精确
- 期望你把需求拆解成可执行的任务并分配给团队
- 验收结果时关注业务目标是否达成，不关注实现细节
```

`demo/ai-agent-digital-team/workspace/manager/memory.md`:
```markdown
# 记忆

（初始为空，Agent 运行过程中可更新）
```

- [ ] **Step 4: Commit**

```bash
git add demo/ai-agent-digital-team/workspace/manager/soul.md \
        demo/ai-agent-digital-team/workspace/manager/agent.md \
        demo/ai-agent-digital-team/workspace/manager/user.md \
        demo/ai-agent-digital-team/workspace/manager/memory.md
git commit -m "feat(digital-team): add Manager workspace files"
```

---

## Task 6: PM workspace 文件（soul / agent / user / memory）

**Files:**
- Create: `demo/ai-agent-digital-team/workspace/pm/soul.md`
- Create: `demo/ai-agent-digital-team/workspace/pm/agent.md`
- Create: `demo/ai-agent-digital-team/workspace/pm/user.md`
- Create: `demo/ai-agent-digital-team/workspace/pm/memory.md`

- [ ] **Step 1: 创建 soul.md**

`demo/ai-agent-digital-team/workspace/pm/soul.md`:
```markdown
# PM 数字员工

## 身份（Identity）

你是 **PM（产品经理）**，产品设计的唯一权威。你的核心信念：**一个功能点只有在用户真的能用、真的会用的时候，才算完成**。

你不相信「大家应该懂我的意思」——你见过太多技术团队拿着模糊的需求去实现，最后返工三次。

**积累的教训**：
- 验收标准写「用户友好」→ 谁都能解释成任何意思，测试无法执行
- 产品文档写了 1000 字需求背景，没写一个用户故事 → Dev 知道为什么要做，不知道做什么

## 使命（Mission）

收到 Manager 任务邮件 → 读取需求文档 → 撰写产品规格文档 → 写入共享工作区 → 回邮通知 Manager

你的成果是 `product_spec.md`：一份工程师拿到后可以直接开始架构设计的产品规格文档。

## 决策偏好

1. 读邮件先于读需求：任务邮件里有 Manager 的具体指令，先读邮件
2. 用户故事 > 功能描述：先描述用户场景，再写功能
3. 路径引用 > 内容复制：回邮只写产出文件路径，不把文档内容塞进邮件

## 禁止（NEVER）

- **绝不修改需求文档**——`/mnt/shared/needs/requirements.md` 只读
- **绝不跳过邮件直接读需求**——Manager 的任务邮件可能包含额外要求
- **绝不把产品文档全文放进回邮**——只传路径引用
```

- [ ] **Step 2: 创建 agent.md**

`demo/ai-agent-digital-team/workspace/pm/agent.md`:
```markdown
# PM 工作规范

## 工具

| 工具 | 用途 |
|------|------|
| `readFile(filePath)` | 读取文件内容（绝对路径） |
| `writeFile(filePath, content)` | 写入文件（绝对路径） |
| `run_script(scriptPath, args)` | 在沙盒中执行脚本 |

## 邮箱操作（通过 run_script）

脚本路径（相对于 workspace/skills/）：`mailbox/scripts/mailbox_cli.js`

**读取邮箱：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "read",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "pm"
])
```
返回 JSON 数组，找 `type === "task_assign"` 的消息，记录 `id` 和 `content`（含需求路径）。

**发送完成通知：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "send",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--from", "pm",
  "--to", "manager",
  "--type", "task_done",
  "--subject", "产品文档已完成",
  "--content", "产品规格文档已写入 /mnt/shared/design/product_spec.md，请验收"
])
```

**标记消息完成：**
```
run_script("mailbox/scripts/mailbox_cli.js", [
  "done",
  "--mailboxes-dir", "/mnt/shared/mailboxes",
  "--role", "pm",
  "--msg-id", "msg-xxxxxxxx"
])
```

## 工作流程（严格按顺序）

1. **读取邮箱**（role=pm），找到 task_assign 消息，记录消息 id 和需求文件路径
2. **读取需求文档**：用 readFile 读取消息 content 中指定的路径（通常是 `/mnt/shared/needs/requirements.md`）
3. **撰写产品规格文档**，包含：
   - 产品概述（一句话说清楚为谁解决什么问题）
   - 目标用户（角色、场景、核心诉求）
   - 用户故事（含验收标准）
   - 功能规格（P0/P1 优先级）
   - 范围外说明
4. **写入共享工作区**：用 writeFile 写入 `/mnt/shared/design/product_spec.md`
5. **发 task_done 邮件**给 Manager，content 只写路径引用
6. **标记原消息为 done**，使用记录的消息 id
```

- [ ] **Step 3: 创建 user.md 和 memory.md**

`demo/ai-agent-digital-team/workspace/pm/user.md`:
```markdown
# 服务对象

你直接服务于**开发团队（Dev/QA）**。

你的产品规格文档是 Dev 架构设计的输入，需要：
- 明确每个功能的用户场景
- 有可以被独立验证的验收标准
- 标注优先级，让 Dev 知道先做什么
```

`demo/ai-agent-digital-team/workspace/pm/memory.md`:
```markdown
# 记忆

（初始为空，Agent 运行过程中可更新）
```

- [ ] **Step 4: Commit**

```bash
git add demo/ai-agent-digital-team/workspace/pm/
git commit -m "feat(digital-team): add PM workspace files"
```

---

## Task 7: digital-worker.js

**Files:**
- Create: `demo/ai-agent-digital-team/digital-worker.js`

通用 Agent 运行器：读 workspace 四件套拼 system prompt，创建 DockerSandbox，注册工具，调用 `generateText`。

- [ ] **Step 1: 创建 digital-worker.js**

`demo/ai-agent-digital-team/digital-worker.js`:
```js
import {generateText, tool} from 'ai'
import {createAnthropic} from '@ai-sdk/anthropic'
import {z} from 'zod'
import fs from 'fs'
import path from 'path'
import {DockerSandbox} from './sandbox.js'

const anthropic = createAnthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || 'http://localhost:3003',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function loadWorkspaceContext(workspaceDir) {
  const files = ['soul.md', 'agent.md', 'user.md', 'memory.md']
  const parts = []
  for (const file of files) {
    const filePath = path.join(workspaceDir, file)
    if (fs.existsSync(filePath)) {
      parts.push(`## ${file}\n\n${fs.readFileSync(filePath, 'utf-8')}`)
    }
  }
  return parts.join('\n\n---\n\n')
}

export async function createDigitalWorker({workspaceDir, sharedDir, model = 'claude-sonnet-4-6'}) {
  const context = loadWorkspaceContext(workspaceDir)
  const sandbox = new DockerSandbox({workspaceDir, sharedDir})

  const tools = {
    readFile: tool({
      description: '读取文件内容',
      parameters: z.object({
        filePath: z.string().describe('文件的绝对路径'),
      }),
      execute: async ({filePath}) => {
        try {
          return fs.readFileSync(filePath, 'utf-8')
        } catch (e) {
          return `读取失败: ${e.message}`
        }
      },
    }),

    writeFile: tool({
      description: '将内容写入文件（自动创建目录）',
      parameters: z.object({
        filePath: z.string().describe('文件的绝对路径'),
        content: z.string().describe('文件内容'),
      }),
      execute: async ({filePath, content}) => {
        try {
          fs.mkdirSync(path.dirname(filePath), {recursive: true})
          fs.writeFileSync(filePath, content, 'utf-8')
          return `已写入 ${filePath}（${content.length} 字符）`
        } catch (e) {
          return `写入失败: ${e.message}`
        }
      },
    }),

    run_script: tool({
      description: '在 Docker 沙盒中执行脚本（mailbox_cli.js、init_workspace.js 等）。scriptPath 是相对于 workspace/skills/ 的路径，如 "mailbox/scripts/mailbox_cli.js"',
      parameters: z.object({
        scriptPath: z.string().describe('脚本路径，相对于 workspace/skills/ 目录'),
        args: z.array(z.string()).describe('传给脚本的命令行参数列表'),
      }),
      execute: async ({scriptPath, args}) => {
        const fullPath = path.join(workspaceDir, 'skills', scriptPath)
        const result = await sandbox.execute(fullPath, args)
        console.log(`  [sandbox] ${scriptPath} → ${result.slice(0, 120)}`)
        return result
      },
    }),
  }

  return {
    async kickoff(userRequest) {
      console.log(`[DigitalWorker] workspace=${path.basename(workspaceDir)}`)
      const {text} = await generateText({
        model: anthropic(model),
        system: `你是一名数字员工。以下是你的身份、工作规范和记忆：\n\n${context}`,
        prompt: userRequest,
        tools,
        maxSteps: 20,
        maxTokens: 16384,
      })
      return text
    },
  }
}
```

- [ ] **Step 2: 验证 loadWorkspaceContext 能正确读取四件套**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
node -e "
import('./digital-worker.js').then(async ({createDigitalWorker}) => {
  // 只测 context 加载，不实际调用 LLM
  const fs = (await import('fs')).default
  const path = (await import('path')).default
  const files = ['soul.md','agent.md','user.md','memory.md']
  const workspaceDir = path.resolve('workspace/manager')
  let count = 0
  for (const f of files) {
    if (fs.existsSync(path.join(workspaceDir,f))) count++
  }
  console.log('workspace files found:', count, '/ 4')
})
"
# Expected: workspace files found: 4 / 4
```

- [ ] **Step 3: Commit**

```bash
git add demo/ai-agent-digital-team/digital-worker.js
git commit -m "feat(digital-team): add createDigitalWorker"
```

---

## Task 8: run-manager.js、run-pm.js、demo-input

**Files:**
- Create: `demo/ai-agent-digital-team/run-manager.js`
- Create: `demo/ai-agent-digital-team/run-pm.js`
- Create: `demo/ai-agent-digital-team/demo-input/project_requirement.md`

- [ ] **Step 1: 创建 demo-input/project_requirement.md**

`demo/ai-agent-digital-team/demo-input/project_requirement.md`:
```markdown
# 项目需求：智能待办事项助手

## 背景

用户在日常工作中有大量待办事项，目前用便利贴和备忘录管理，容易遗忘、优先级混乱。

## 核心目标

开发一个命令行版智能待办事项助手，帮助用户快速录入、管理和追踪待办任务。

## 功能要求

1. **添加任务**：用自然语言描述任务，系统自动提取标题和截止时间
2. **查看列表**：按优先级展示未完成任务
3. **标记完成**：将任务标记为已完成
4. **智能提醒**：任务临近截止时提示用户

## 验收标准（DoD）

- 用户可以在 30 秒内完成一个任务的录入
- 任务列表按截止时间和优先级排序
- 支持至少 100 个并发任务不卡顿
- 命令行界面，无需 GUI

## 约束条件

- 技术栈：Node.js
- 不依赖外部数据库（本地文件存储）
- 单人开发，预计 2 周完成
```

- [ ] **Step 2: 创建 run-manager.js**

`demo/ai-agent-digital-team/run-manager.js`:
```js
import path from 'path'
import {fileURLToPath} from 'url'
import fs from 'fs'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'manager')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')
const DEMO_INPUT = path.join(__dirname, 'demo-input', 'project_requirement.md')

function hasPendingTaskDone() {
  const mailboxPath = path.join(SHARED_DIR, 'mailboxes', 'manager.json')
  if (!fs.existsSync(mailboxPath)) return false
  const messages = JSON.parse(fs.readFileSync(mailboxPath, 'utf-8'))
  return messages.some(m => m.type === 'task_done' && m.status !== 'done')
}

async function main() {
  const worker = await createDigitalWorker({
    workspaceDir: WORKSPACE_DIR,
    sharedDir: SHARED_DIR,
  })

  let userRequest
  if (hasPendingTaskDone()) {
    console.log('\n[Manager] 检测到 task_done，进入验收模式')
    userRequest = `请检查邮箱（role=manager），找到 task_done 消息，读取 PM 的产出文件，` +
      `对照原始需求文档（/mnt/shared/needs/requirements.md）逐项验收，` +
      `将验收报告写入 /workspace/review_result.md，然后标记消息为 done。`
  } else {
    console.log('\n[Manager] 进入任务分配模式')
    const requirement = fs.readFileSync(DEMO_INPUT, 'utf-8')
    userRequest = `请按以下步骤执行：\n` +
      `1. 初始化共享工作区（shared-dir=/mnt/shared，roles=manager,pm）\n` +
      `2. 将下面的需求内容写入 /mnt/shared/needs/requirements.md\n` +
      `3. 给 PM 发 task_assign 邮件，邮件 content 只写路径引用\n\n需求内容：\n\n${requirement}`
  }

  const result = await worker.kickoff(userRequest)
  console.log('\n[Manager] 完成\n', result)
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: 创建 run-pm.js**

`demo/ai-agent-digital-team/run-pm.js`:
```js
import path from 'path'
import {fileURLToPath} from 'url'
import {createDigitalWorker} from './digital-worker.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'pm')
const SHARED_DIR = path.join(__dirname, 'workspace', 'shared')

async function main() {
  const worker = await createDigitalWorker({
    workspaceDir: WORKSPACE_DIR,
    sharedDir: SHARED_DIR,
  })

  console.log('\n[PM] 启动，检查邮箱...')
  const result = await worker.kickoff(
    `请检查邮箱（role=pm），如有 task_assign 任务，按工作流程完成产品规格文档，` +
    `写入共享工作区后回邮通知 Manager，最后标记原消息为 done。`
  )
  console.log('\n[PM] 完成\n', result)
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 4: Commit**

```bash
git add demo/ai-agent-digital-team/run-manager.js \
        demo/ai-agent-digital-team/run-pm.js \
        demo/ai-agent-digital-team/demo-input/
git commit -m "feat(digital-team): add run-manager, run-pm, demo-input"
```

---

## Task 9: 端到端演示验证

**Goal:** 跑完整的 Manager → PM → Manager 三步流程，确认文件产出正确。

- [ ] **Step 1: 清理环境**

```bash
cd /Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team
rm -rf workspace/shared
rm -f workspace/manager/review_result.md
```

- [ ] **Step 2: Step 1 — Manager 分配任务**

```bash
node run-manager.js 2>&1 | tee /tmp/manager-assign.log
```

Expected 关键输出：
- `[Manager] 进入任务分配模式`
- `[sandbox] init_project/scripts/init_workspace.js → {"ok":true,...}`
- `[sandbox] mailbox/scripts/mailbox_cli.js → {"ok":true,"id":"msg-..."}`

验证产出：
```bash
cat workspace/shared/needs/requirements.md | head -5
# Expected: # 项目需求：智能待办事项助手

cat workspace/shared/mailboxes/pm.json
# Expected: 含一条 type=task_assign、status=unread 的消息
```

- [ ] **Step 3: Step 2 — PM 执行任务**

```bash
node run-pm.js 2>&1 | tee /tmp/pm-execute.log
```

Expected 关键输出：
- `[PM] 启动，检查邮箱...`
- `[sandbox] mailbox/scripts/mailbox_cli.js` 被调用（read、send、done）

验证产出：
```bash
cat workspace/shared/design/product_spec.md | head -10
# Expected: # 产品规格文档 - 智能待办事项助手（或类似标题）

cat workspace/shared/mailboxes/manager.json
# Expected: 含一条 type=task_done、status=unread 的消息
```

- [ ] **Step 4: Step 3 — Manager 验收**

```bash
node run-manager.js 2>&1 | tee /tmp/manager-review.log
```

Expected 关键输出：
- `[Manager] 检测到 task_done，进入验收模式`

验证产出：
```bash
cat workspace/manager/review_result.md | head -10
# Expected: 验收报告内容

cat workspace/shared/mailboxes/manager.json
# Expected: task_done 消息的 status 变为 done
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(digital-team): complete e2e demo verification"
```

---

## Task 10: 博客文章

**Files:**
- Create: `source/_posts/ai-agent-digital-team-1.md`
- Create: `source/_posts/ai-agent-digital-team-1/`（图片目录）

- [ ] **Step 1: 使用 write-tech-article skill 写文章**

调用 `write-tech-article` skill，传入以下写作指南：

**文章标题**：`数字团队（一）：角色体系与任务链`

**文件名**：`ai-agent-digital-team-1`

**五节结构与要求**：

**第一节：从临时工到专业员工**
- 承接 Orchestrator 那篇（链接：`/2026/04/22/ai-agent-orchestrator/`）
- 指出 Orchestrator 的局限：子 Agent 没有固定身份和行为边界，每次 spawn 都是一张白纸
- 类比：雇了个通才做专业工作 vs 有角色规范的专业员工
- 引出两个问题：角色怎么定义？角色之间怎么协作？

**第二节：角色由文件定义**
- 介绍 workspace 四件套（soul/agent/user/memory）
- 以 Manager 的 soul.md 为例，详细展示 NEVER 清单的作用
- 展示 `digital-worker.js` 的 `loadWorkspaceContext()` 函数（从 demo 代码截取）
- 展示 `createDigitalWorker` 的核心逻辑：system prompt = 四件套内容
- 强调：代码里没有任何一行写着 "manager" 或 "pm"

**第三节：同一框架，不同身份**
- 并排展示 `run-manager.js` 和 `run-pm.js`（各约 30 行）
- 指出唯一区别：`workspaceDir` 路径不同
- 得出结论：换 workspace 目录 = 换角色
- 如果要加 QA 角色：创建 `workspace/qa/` + 写一个 `run-qa.js`，框架代码一行不改

**第四节：任务链——三态邮箱状态机**
- 从问题出发：两个 Agent 协作，信息怎么传？为什么不能直接调用？
- 引入三态状态机：unread → in_progress → done
- 重点讲为什么不能是二态：Agent 读了消息、处理到一半崩溃了，消息永远丢失
- 类比 AWS SQS Visibility Timeout
- 展示 `mailbox_cli.js` 的 `read()` 函数（原子标记为 in_progress 的代码）
- 展示 `resetStale()` 的崩溃恢复逻辑
- 另一个设计原则：邮件只传路径引用，不传文档全文（对比表格说明）
- 展示 `agent.md` 中的邮箱调用示例

**第五节：端到端演示**
- 用 Mermaid 或图示展示完整流程：Manager 分配 → PM 执行 → Manager 验收
- 说明 Docker sandbox 的挂载设计（私有 workspace + 共享 /mnt/shared）
- 展示三步运行命令：
  ```bash
  node run-manager.js   # 分配任务
  node run-pm.js        # PM 执行
  node run-manager.js   # 验收
  ```
- 展示关键产出文件（`/mnt/shared/design/product_spec.md`、`review_result.md`）

**代码风格**：从实际 demo 代码截取，不要伪代码。

- [ ] **Step 2: Commit 文章**

```bash
git add source/_posts/ai-agent-digital-team-1.md source/_posts/ai-agent-digital-team-1/
git commit -m "blog: add ai-agent-digital-team-1 article"
```
