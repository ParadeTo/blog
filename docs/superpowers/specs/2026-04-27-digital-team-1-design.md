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
├── docker-compose.yaml        # 展示 volume 挂载与工作区隔离（教学用）
├── digital-worker.js          # 通用 Agent 运行器
├── mailbox.js                 # 三态邮箱状态机
├── run-manager.js             # Manager 入口（自动判断分配/验收模式）
├── run-pm.js                  # PM 入口（读邮箱 + 执行任务）
├── demo-input/
│   └── project_requirement.md
└── workspace/
    ├── manager/
    │   ├── soul.md            # 身份 + NEVER 清单
    │   ├── agent.md           # 工作流 + 团队名册
    │   ├── user.md            # 服务对象
    │   └── memory.md          # 初始记忆
    ├── pm/
    │   ├── soul.md
    │   ├── agent.md
    │   ├── user.md
    │   └── memory.md
    └── shared/                # 运行时生成
        ├── needs/             # Manager 写入需求文档
        ├── design/            # PM 写入产品文档
        └── mailboxes/         # manager.json / pm.json
```

### 技术栈

- `ai` (Vercel AI SDK) + `@ai-sdk/anthropic`
- `generateText` + `tool` —— 与系列前作完全一致
- 纯 Node.js，ESM，无额外框架

### 沙盒设计

博客 demo 系列的一贯做法（agent-react、agent-skill、orchestrator）都直接用 `fs`，没有真正运行的沙盒。xiaoquan 用 Podman 是因为要执行用户上传的不可信 Python 代码，属于不同场景。原 Python 版（m4l25/m4l26）用 Docker+MCP 是 CrewAI 框架的架构要求，不是安全需要。

**本项目做法**：Agent 工具直接用 `fs` 读写 `workspace/` 下的本地路径，不启动任何容器。

`docker-compose.yaml` 保留，作用是在文章里充当「架构图」——比文字更直观地展示两个 Agent 各有私有 workspace、共享同一个 `/mnt/shared` 的隔离设计：

```yaml
services:
  manager-sandbox:
    volumes:
      - ./workspace/manager:/workspace    # 私有工作区
      - ./workspace/shared:/mnt/shared    # 共享工作区
  pm-sandbox:
    volumes:
      - ./workspace/pm:/workspace
      - ./workspace/shared:/mnt/shared
```

---

### 核心模块设计

#### `digital-worker.js`

```js
// createDigitalWorker(workspaceDir) 的职责：
// 1. 读取 soul.md + agent.md + user.md + memory.md，拼成 system prompt
// 2. 提供 readFile / writeFile 工具，路径限定在 workspaceDir 和 workspace/shared/
// 3. 调用 generateText 跑 ReAct 循环
// 4. 返回最终文本结果
```

关键设计：`role`/`goal` 来自 soul.md 内容，代码里没有任何角色特异性字段。

#### `mailbox.js`

四个纯函数，操作 `workspace/shared/mailboxes/{role}.json`：

| 函数 | 行为 |
|------|------|
| `sendMail(to, from, type, subject, content)` | 追加消息，状态 `unread` |
| `readInbox(role)` | 读取并**原子**标记为 `in_progress`（读写在同一个 JSON 操作里） |
| `markDone(role, msgId)` | 标记为 `done` |
| `resetStale(role, timeoutMs)` | 将超时的 `in_progress` 重置为 `unread`（崩溃恢复） |

三态状态机：`unread → in_progress → done`，`resetStale` 提供 `in_progress → unread` 回退路径。

#### `run-manager.js`

启动时检查 `mailboxes/manager.json` 是否有未处理的 `task_done` 消息：
- **有**：验收模式——读 PM 产出文件，写验收报告
- **无**：分配模式——初始化共享工作区，写需求文档，发 `task_assign` 给 PM

模式切换依据文件系统状态，不靠 LLM 判断。

#### `run-pm.js`

读取 PM 邮箱，处理 `task_assign`：读需求文档 → 写产品规格文档 → 发 `task_done` → `markDone`。

---

## 四、不在范围内

- 不实现 QA 角色（留给后续文章）
- 不实现 Skills 动态加载（soul.md + agent.md 直接注入 system prompt，不走 skill_loader）
- 不实现真正的容器隔离（docker-compose.yaml 仅供教学展示）
- 不实现并发多 PM（单条任务链，Manager → PM → Manager）

---

## 五、文章文件名

`source/_posts/ai-agent-digital-team-1.md`（配套资源目录 `source/_posts/ai-agent-digital-team-1/`）
