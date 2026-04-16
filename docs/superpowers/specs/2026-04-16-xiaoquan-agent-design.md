# xiaoquan（小圈）—— 完整 AI Agent 设计文档

> **项目**：xiaoquan（小圈）—— 飞书本地工作助手（JS 版）
> **定位**：将前 5 篇系列文章的所有概念整合为一个可实际使用的完整 Agent 产品
> **参考**：xiaopaw-with-memory（Python 版），1:1 架构移植
> **日期**：2026-04-16

---

## 1. 项目概述

### 1.1 背景

前 5 篇文章分别实现了 Agent 的各个子系统：

| 篇目 | 主题 | 核心模块 |
|------|------|---------|
| 第一篇 ai-agent-skill | Skill 系统基础 | Skill 文件结构、向量检索 / LLM 意图分类两种检测策略 |
| 第二篇 ai-agent-skill-2 | ReAct + Skill 工具化 | 显式 ReAct 循环、list_skills / get_skill、复合任务 |
| 第三篇 ai-context-engineering | 上下文管理 | Bootstrap 预加载、Tool Result 剪枝、对话压缩 |
| 第四篇 ai-mem-file | 文件系统记忆 | memory-save、skill-creator、memory-governance |
| 第五篇 ai-mem-rag | RAG 长期记忆 | pgvector 混合检索（向量 + BM25） |

每篇都是独立 demo，跑在终端 REPL 里。本项目把它们整合成一个完整的飞书 Agent 产品，同时补齐之前没有覆盖的三个模块：Session 系统、沙箱执行、飞书接入。

### 1.2 技术栈

| 层面 | 选型 |
|------|------|
| 运行时 | Node.js 20+ |
| LLM | Vercel AI SDK + @ai-sdk/anthropic（Claude Sonnet） |
| Embedding | @ai-sdk/openai（text-embedding-3-small） |
| 飞书 SDK | @larksuiteoapi/node-sdk |
| 数据库 | PostgreSQL + pgvector |
| 容器 | Podman |
| 配置 | config.yaml |

### 1.3 与 xiaopaw 的对应关系

| Python 版 (xiaopaw) | JS 版 (xiaoquan) |
|---|---|
| Python 3.11 + asyncio | Node.js 20+ |
| AliyunLLM（通义千问） | Vercel AI SDK + @ai-sdk/anthropic（Claude） |
| CrewAI Agent | 自写 ReAct 循环（第二篇模式） |
| lark-oapi (Python) | @larksuiteoapi/node-sdk |
| AIO-Sandbox (Docker) | Podman 容器 + MCP |
| pgvector (PostgreSQL) | 同，pg + pgvector |

---

## 2. 目录结构

```
xiaoquan/
├── src/
│   ├── index.js                  # 进程入口
│   ├── models.js                 # InboundMessage / Attachment 类型定义
│   ├── runner.js                 # 执行引擎（per-routing_key 队列、Slash 命令、Agent 调用）
│   ├── llm/
│   │   └── anthropic-llm.js      # Vercel AI SDK + @ai-sdk/anthropic 适配器
│   ├── feishu/
│   │   ├── listener.js           # WebSocket 事件 → InboundMessage
│   │   ├── sender.js             # 消息发送（p2p/group/thread），含重试
│   │   ├── downloader.js         # 附件下载到 session workspace
│   │   └── session-key.js        # routing_key 解析
│   ├── agent/
│   │   ├── react-loop.js         # 显式 ReAct 循环（复用第二篇的模式）
│   │   └── skill-tools.js        # list_skills / get_skill / load_skill
│   ├── tools/                    # 通用工具（read_file, write_file, run_script 等）
│   ├── session/
│   │   └── session-manager.js    # Session 管理器（index.json + JSONL 持久化）
│   ├── memory/
│   │   ├── bootstrap.js          # System Prompt 注入（复用第三篇）
│   │   ├── context-pruner.js     # Tool Result 剪枝（复用第三篇）
│   │   ├── context-compressor.js # 对话压缩（复用第三篇）
│   │   └── rag-memory.js         # pgvector 混合检索（复用第五篇）
│   ├── sandbox/
│   │   └── podman-sandbox.js     # Podman 容器执行 + 凭证注入
│   └── api/
│       └── test-api.js           # HTTP 调试接口
├── skills/                       # Skill 文件目录
│   ├── memory-save/SKILL.md
│   ├── skill-creator/SKILL.md
│   ├── memory-governance/SKILL.md
│   ├── pdf/
│   ├── feishu-ops/
│   ├── baidu-search/
│   ├── web-browse/
│   └── history-reader/
├── workspace/                    # Bootstrap 读取的身份/记忆文件
│   ├── soul.md
│   ├── user.md
│   ├── agent.md
│   └── memory/MEMORY.md
├── data/                         # 运行时数据（sessions, logs, ctx）
├── config.yaml                   # 配置文件
└── package.json
```

---

## 3. Session 系统

### 3.1 核心概念

- **routing_key**：用户标识。飞书场景下格式为 `p2p:{open_id}`（单聊）或 `group:{chat_id}`（群聊）。一个 routing_key 对应一个用户/群的消息队列，保证同一用户的消息串行处理。
- **session_id**：会话 ID（UUID）。一个 routing_key 可以有多个 session（用户发 `/new` 创建新会话）。
- **持久化**：`index.json` 存路由映射 + session 元数据，每个 session 的对话历史存 JSONL 文件。

### 3.2 数据结构

```
data/sessions/
├── index.json                    # { "p2p:ou_xxx": { sessionId, createdAt, ... } }
└── s-uuid-001.jsonl              # 每行一条消息 { role, content, timestamp }
```

### 3.3 SessionManager 职责

| 方法 | 功能 |
|------|------|
| `getOrCreate(routingKey)` | 查 index.json，有就返回，没有就创建新 session |
| `loadHistory(sessionId)` | 读 JSONL 文件，返回 messages 数组 |
| `appendMessage(sessionId, message)` | 追加一行到 JSONL |
| `reset(routingKey)` | `/new` 命令触发，创建新 session_id，旧 JSONL 保留 |

### 3.4 Runner 队列机制

每个 routing_key 一个异步队列（`Map<string, Promise chain>`），保证同一用户的消息不并发处理。用 Promise 链实现，不需要额外的队列库。

---

## 4. 沙箱执行

### 4.1 架构

与 xiaopaw 的 AIO-Sandbox 思路一致，底层从 Docker 换成 Podman：

1. 复用 AIO-Sandbox 镜像（OCI 标准，Docker/Podman 通用），内置 Python 运行时 + 常用库（pandas、openpyxl 等）
2. 每次 Skill 需要执行代码时，启动一个临时容器，执行完销毁
3. 凭证通过文件挂载注入容器，不经过 LLM 上下文

### 4.2 关键设计

- **凭证注入**：启动时把凭证写入宿主机临时目录，挂载到容器的 `.config/` 下。脚本从文件读凭证，LLM 永远看不到真实密钥。
- **文件交换**：session 的 `uploads/` 和 `outputs/` 目录挂载到容器内，脚本可以读用户上传的文件、写处理结果。
- **超时控制**：容器级别设 timeout（默认 30s），防止死循环。
- **MCP 协议**：容器内跑一个轻量 MCP Server，暴露 `execute_code`、`read_file`、`write_file` 等工具，主进程通过 HTTP 调用。

### 4.3 核心接口

```javascript
class PodmanSandbox {
  async execute(scriptPath, args, { sessionDir, timeout })
  async executeCode(code, language, { sessionDir, timeout })
  async cleanup()
}
```

### 4.4 与前文的衔接

第二篇中的 `run_script` 工具变成 `sandbox.execute()`，从本地 `execSync` 升级为容器隔离执行，接口不变，底层换掉。

---

## 5. 飞书接入

### 5.1 FeishuListener（WebSocket 长连接）

- 用 SDK 的 `ws.Client` 建立 WebSocket 连接，监听 `im.message.receive_v1` 事件
- 解析消息类型：文本（text）、富文本（post）、图片（image）、文件（file）
- 构造 `InboundMessage` 对象传给 Runner
- 支持 allowed_chats 白名单（群聊过滤），p2p 始终开放

### 5.2 FeishuSender（消息发送）

卡片消息 + Loading 效果：

1. 收到用户消息 → `sendThinking()` 发送"思考中..."加载卡片，拿到 `cardMsgId`
2. Agent 执行完 → `updateCard(cardMsgId, result)` 更新卡片为最终回复
3. 更新失败 → 降级 `send()` 重发整条消息

支持 p2p / group / thread 三种场景。Markdown 富文本渲染（lark_md 格式）。内置重试机制。

### 5.3 FeishuDownloader（附件下载）

用户发送文件/图片时，通过飞书 API 下载到 `data/sessions/{sid}/uploads/`，把本地路径拼进消息内容，Agent 后续可以通过沙箱读取。

### 5.4 Slash 命令

| 命令 | 功能 |
|------|------|
| `/new` | 创建新会话 |
| `/verbose on/off` | 开关推理过程推送 |
| `/status` | 查看当前会话信息 |
| `/help` | 显示帮助 |

### 5.5 TestAPI

`http://localhost:9090/api/test/message` — 不需要真实飞书环境就能本地调试，POST 一条消息，同步返回 Agent 回复。

---

## 6. 已有模块整合

### 6.1 Skill 系统（第一、二篇）

- ReAct 循环 + `list_skills`/`get_skill` 工具化模式不变
- Skill 执行脚本不再本地 `execSync`，改走 `PodmanSandbox.execute()`
- Skill 分两类（与 xiaopaw 一致）：
  - **任务型**：需要执行代码的（pdf、feishu-ops 等），走沙箱
  - **参考型**：纯指令注入的（history-reader、memory-save 等），不走沙箱

### 6.2 上下文管理（第三篇）

- **Bootstrap**：读 `workspace/` 下的 soul.md、user.md、agent.md、memory/MEMORY.md，注入 System Prompt。路径从固定改为按 config.yaml 配置。
- **Tool Result 剪枝**：每轮 ReAct 后自动执行。
- **对话压缩**：token 超阈值时触发，压缩前先写入 JSONL（Session 系统接管持久化）。

### 6.3 文件系统记忆（第四篇）

- memory-save、skill-creator、memory-governance 三个 Skill 不变
- 写入路径统一走 `workspace/` 目录

### 6.4 RAG 记忆（第五篇）

- pgvector 混合检索不变，`memory_store` + `memory_search` 两个工具
- 写入时机：对话压缩时自动触发（压缩前把值得记住的内容存入 pgvector）

---

## 7. 主链路时序

```
用户消息 → FeishuListener → Runner
  → SessionManager.getOrCreate(routingKey)
  → SessionManager.loadHistory(sessionId)    // 加载 JSONL
  → Bootstrap 注入 System Prompt             // 读 workspace/
  → 剪枝旧 Tool Result
  → 检查是否需要压缩
  → ReAct 循环（Skill 工具 + 沙箱执行 + RAG 搜索）
  → SessionManager.appendMessage()           // 追加到 JSONL
  → FeishuSender 回复
```

---

## 8. 内置 Skills

与 xiaopaw 保持一致：

| Skill | 类型 | 能力 |
|-------|------|------|
| `pdf` | 任务型 | PDF 解析、文本提取、格式转换 |
| `docx` | 任务型 | Word 文档读取与处理 |
| `pptx` | 任务型 | PPT 文档读取与处理 |
| `xlsx` | 任务型 | Excel 表格读取与处理 |
| `feishu-ops` | 任务型 | 读飞书云文档、向指定群/用户发消息 |
| `scheduler-mgr` | 任务型 | 创建/查看/更新/删除定时任务 |
| `baidu-search` | 任务型 | 百度千帆网络搜索，支持时间过滤与站点限定 |
| `web-browse` | 任务型 | 网页内容提取 + 浏览器自动化 |
| `history-reader` | 参考型 | 分页读取历史对话记录 |
| `memory-save` | 参考型 | 持久化用户偏好和关键事实 |
| `skill-creator` | 参考型 | 将 SOP 沉淀为 Skill 文件 |
| `memory-governance` | 参考型 | 审计和清理记忆文件 |

---

## 9. 文章结构

单篇文章，标题暂定"**简单实战一下，从零搭建一个完整的 AI Agent**"。

| 章节 | 内容 | 篇幅策略 |
|------|------|---------|
| 前言 | 回顾前 5 篇，引出本篇定位 | 简述 |
| 一、整体架构 | 架构图 + 模块职责 + 技术栈 | 中等 |
| 二、Session 系统 | routing_key、会话生命周期、JSONL 持久化、队列串行 | **重点展开** |
| 三、沙箱执行 | Podman 容器化、凭证注入、文件交换、MCP 协议 | **重点展开** |
| 四、飞书接入 | WebSocket 长连接、消息解析、卡片消息、附件处理 | **重点展开** |
| 五、已有模块整合 | Skill、上下文管理、文件记忆、RAG，与 demo 版差异 | 简述 + 引导"详见第 X 篇" |
| 六、完整 Demo 演示 | 从启动到跑通真实场景，展示所有模块协作 | 中等 |
| 总结 | 系列回顾，完整知识图谱 | 简述 |

---

## 10. 配置文件

```yaml
feishu:
  app_id: "${FEISHU_APP_ID}"
  app_secret: "${FEISHU_APP_SECRET}"

llm:
  provider: anthropic
  model: claude-sonnet-4-6
  embedding_model: text-embedding-3-small

memory:
  workspace_dir: "./workspace"
  ctx_dir: "./data/ctx"
  db_dsn: "postgresql://xiaoquan:xiaoquan123@localhost:5432/xiaoquan_memory"
  token_threshold: 80000

sandbox:
  runtime: podman
  image: "xiaoquan-sandbox:latest"
  timeout: 30000

session:
  data_dir: "./data/sessions"

debug:
  enable_test_api: true
  test_api_port: 9090
```
