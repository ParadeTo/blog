# 设计文档：数字团队（一）博客文章 + JS 配套代码

日期：2026-04-27

---

## 一、目标

写一篇中文技术博客文章，主题为「数字团队：角色体系与任务链」，同时配套一个 JS 演示项目。文章承接系列前作（Orchestrator 模式），引入「数字团队」概念，覆盖两个核心教学点：

1. **角色体系**（对应 m4l25）：用 workspace 文件定义 Agent 身份，同一套代码换目录即换角色
2. **任务链与通信协议**（对应 m4l26）：基于三态邮箱状态机的 Agent 间通信，路径引用传递

---

## 二、文章设计

### 叙事结构：问题驱动

开篇承接 Orchestrator 那篇，指出其未解决的问题：子 Agent 是「临时工」，没有固定身份和行为边界。引出数字团队的两个问题：角色怎么定义？角色之间怎么协作？

### 五节结构

| 节 | 标题 | 对应材料 | 核心内容 |
|----|------|---------|---------|
| 一 | 从临时工到专业员工 | — | Orchestrator 局限，引出数字团队概念 |
| 二 | 角色由文件定义 | m4l25 | DigitalWorker + workspace 四件套 + NEVER 清单 |
| 三 | 同一框架，不同身份 | m4l25 代码 | run-manager vs run-pm 只差一行 |
| 四 | 任务链：三态邮箱状态机 | m4l26 | unread→in_progress→done，reset_stale，路径引用 |
| 五 | 端到端：Manager → PM 完整流程 | m4l26 代码 | 演示整条任务链 |

### 写作要求

- 语言：中文
- 风格：与系列前作一致（类比丰富、有具体代码、有图示）
- 代码示例：JS 版配套项目的核心片段
- 深度：
  - 第二节「角色由文件定义」：重点展开，逐一讲 soul/agent/user/memory 四件套，展示 `digital-worker.js` 加载 workspace 的逻辑
  - 第四节邮箱状态机：完整讲解三态 + reset_stale，类比 AWS SQS Visibility Timeout，展示代码

---

## 三、JS 配套项目设计

### 位置

`/Users/youxingzhi/ayou/blog/demo/ai-agent-digital-team/`

### 目录结构

```
ai-agent-digital-team/
├── package.json
├── Dockerfile.sandbox             # Node.js Alpine 镜像
├── sandbox.js                     # DockerSandbox 类（参照 xiaoquan/podman-sandbox.js）
├── digital-worker.js              # 通用 Agent 运行器
├── run-manager.js                 # Manager 入口（自动判断分配/验收模式）
├── run-pm.js                      # PM 入口（读邮箱 + 执行任务）
├── demo-input/
│   └── project_requirement.md
└── workspace/
    ├── manager/
    │   ├── soul.md                # 身份 + NEVER 清单
    │   ├── agent.md               # 工作流 + 团队名册
    │   ├── user.md                # 服务对象
    │   ├── memory.md              # 初始记忆
    │   └── skills/
    │       ├── mailbox/
    │       │   └── scripts/
    │       │       └── mailbox_cli.js    # 在容器内执行
    │       └── init_project/
    │           └── scripts/
    │               └── init_workspace.js # 在容器内执行
    ├── pm/
    │   ├── soul.md / agent.md / user.md / memory.md
    │   └── skills/
    │       └── mailbox/
    │           └── scripts/
    │               └── mailbox_cli.js
    └── shared/                    # 运行时生成
        ├── needs/                 # Manager 写入需求文档
        ├── design/                # PM 写入产品文档
        └── mailboxes/             # manager.json / pm.json
```

### 技术栈

- `ai` (Vercel AI SDK) + `@ai-sdk/anthropic`
- `generateText` + `tool` —— 与系列前作完全一致
- 纯 Node.js，ESM
- Docker 用于脚本执行隔离（与 xiaoquan 用 Podman 的模式一致）

### 沙盒设计

与 xiaoquan 完全相同的模式：`sandbox.js` 封装 `docker run --rm`，每次 `run_script` 调用启动一个临时容器执行脚本，脚本跑完容器自动销毁。

**挂载结构**（以 Manager 为例）：
```
workspace/manager/skills/ → /mnt/skills:ro   （脚本，只读）
workspace/manager/        → /workspace:rw    （私有工作区，可读写）
workspace/shared/         → /mnt/shared:rw   （共享工作区，可读写）
```

PM 沙盒挂载 `workspace/pm/skills/` 和 `workspace/pm/`，共享同一个 `workspace/shared/`。

**`sandbox.js` 核心**：
```js
async execute(scriptPath, args = '') {
  const skillsDir = path.join(this._workspaceDir, 'skills')
  const containerScript = `/mnt/skills/${path.relative(skillsDir, scriptPath)}`
  const cmd = [
    'run', '--rm',
    '-v', `${skillsDir}:/mnt/skills:ro`,
    '-v', `${this._workspaceDir}:/workspace:rw`,
    '-v', `${this._sharedDir}:/mnt/shared:rw`,
    'digital-team-sandbox',
    'node', containerScript, ...args,
  ]
  const {stdout} = await execFileAsync('docker', cmd, {timeout: this._timeoutMs})
  return stdout.trim()
}
```

**`readFile`/`writeFile` 工具**：直接用 `fs`（与 xiaoquan 一致，沙盒只用于跑脚本，读文件走 host）。

---

### 核心模块设计

#### `sandbox.js`

`DockerSandbox` 类，参照 `xiaoquan/src/sandbox/podman-sandbox.js`：
- `constructor({workspaceDir, sharedDir, timeoutMs})`
- `async execute(scriptPath, args)` — `docker run --rm` 执行 Node.js 脚本

#### `digital-worker.js`

`createDigitalWorker(workspaceDir, sharedDir)` 的职责：
1. 读取 soul.md + agent.md + user.md + memory.md，拼成 system prompt
2. 创建 `DockerSandbox` 实例
3. 提供工具：`readFile`（fs）、`writeFile`（fs）、`run_script`（sandbox.execute）
4. 调用 `generateText` 跑 ReAct 循环

关键设计：代码里没有任何角色特异性字段，角色身份完全来自 workspace 文件内容。

#### `workspace/*/skills/mailbox/scripts/mailbox_cli.js`

命令行脚本，在容器内执行，操作 `/mnt/shared/mailboxes/{role}.json`：

| 子命令 | 行为 |
|--------|------|
| `send --to --from --type --subject --content` | 追加消息，状态 `unread` |
| `read --role` | 读取并原子标记为 `in_progress` |
| `done --role --msg-id` | 标记为 `done` |
| `reset-stale --role --timeout-minutes` | 超时 `in_progress` → `unread`（崩溃恢复）|

#### `workspace/manager/skills/init_project/scripts/init_workspace.js`

命令行脚本，在容器内执行，创建 `/mnt/shared/needs/`、`/mnt/shared/design/`、`/mnt/shared/mailboxes/` 目录结构（幂等）。

#### `run-manager.js`

启动时在 host 侧检查 `workspace/shared/mailboxes/manager.json` 是否有未处理的 `task_done` 消息：
- **有**：验收模式
- **无**：分配模式

模式切换依据文件系统状态，不靠 LLM 判断。

#### `run-pm.js`

启动 PM Agent，Agent 通过 `run_script` 调用 `mailbox_cli.js read` 取任务，执行后写产品文档，再调用 `mailbox_cli.js send` 回报。

---

## 四、不在范围内

- 不实现 QA 角色（留给后续文章）
- 不实现 Skills 动态加载（soul.md + agent.md 直接注入 system prompt）
- 不实现并发多 PM（单条任务链，Manager → PM → Manager）

---

## 五、文章文件名

`source/_posts/ai-agent-digital-team-1.md`（配套资源目录 `source/_posts/ai-agent-digital-team-1/`）
