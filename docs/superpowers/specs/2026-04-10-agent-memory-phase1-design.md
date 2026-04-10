# Agent Memory Phase 1 设计文档

## 概述

构建一个"个人助手"Agent demo，演示上下文管理的三个核心机制：Bootstrap（启动注入）、上下文剪枝（Tool Result 精简）、上下文压缩（对话摘要 + 持久化）。

技术栈：Vercel AI SDK + JavaScript（Node.js），与博客 Agent 系列文章保持一致。

## 场景

独立的"个人助手"Agent。它有人设（`soul.md`）、了解用户（`user.md`）、遵循行为规则（`agent.md`）、拥有记忆（`memory/`）。用户通过 CLI REPL 与它交互。

## 项目结构

```
demo/agent-memory/
├── index.js              # 入口：ReAct 循环 + REPL
├── bootstrap.js          # bootstrap() —— 加载身份 + 记忆，组装 system prompt
├── prune.js              # prune() —— 裁剪旧的 Tool Result
├── compress.js           # compress() —— token 阈值触发压缩 + 持久化
├── package.json
└── workspace/            # Agent 的"工作空间"
    ├── soul.md           # 身份与性格（固定）
    ├── user.md           # 用户画像（可更新）
    ├── agent.md          # 行为规则（固定）
    ├── memory/
    │   └── MEMORY.md     # 记忆索引，200 行上限
    └── sessions/
        ├── ctx.json      # 压缩后的上下文快照
        └── raw.jsonl     # 完整历史（无损备份）
```

## 模块设计

### 1. Bootstrap（bootstrap.js）

启动时读取 workspace 里的身份文件和记忆索引，组装成 system prompt。

**加载文件：**
- `soul.md` —— 我是谁（身份 + 性格）
- `user.md` —— 我服务谁（用户画像）
- `agent.md` —— 我怎么干活（行为规则）
- `memory/MEMORY.md` —— 记忆索引（摘要列表）

**组装格式：** 用 XML 标签分块，模型定位更准确。

```
<soul>
{soul.md 内容}
</soul>

<user_profile>
{user.md 内容}
</user_profile>

<agent>
{agent.md 内容}
</agent>

<memory_index>
{MEMORY.md 内容}
</memory_index>
```

**保护机制：** 每个文件读取时有字符上限（2000 字符），超出截断并标注 `...(truncated)`。防止某个文件膨胀撑爆 system prompt。

**函数签名：**

```javascript
function bootstrap(workspacePath) → string
```

只在首次调用时执行，后续复用缓存的 system prompt。

### 2. 上下文剪枝（prune.js）

扫描 messages，裁剪旧的 Tool Result。对话消息不动。

**策略：**
1. 只处理 `role: 'tool'` 的消息
2. 最近 `recentKeep` 条 Tool Result 不动（默认 2）
3. 超过 800 字符的 Tool Result：提取关键字段（JSON 里的 id、name、status 等） + 保留前 500 字符 + 截断标记
4. 800 字符以内的不动

**函数签名：**

```javascript
function prune(messages, { recentKeep = 2 } = {}) → messages
```

**日志输出：** `[Prune] Tool result truncated: 3200 → 620 chars`

### 3. 上下文压缩（compress.js）

当 messages 的 token 总量超过阈值时触发。

**触发条件：** 由主循环判断——上一次 LLM 调用的 `usage.promptTokens` 超过 `TOKEN_THRESHOLD`（默认 4000 tokens，方便演示）时调用 compress

**流程：**
1. **持久化（lossless）**：把当前完整 messages 追加写入 `sessions/raw.jsonl`，一行一条 JSON
2. **切分**：保留最近 `keepRecent` 条消息（默认 4），其余打包
3. **摘要**：用 LLM 把旧消息压缩成一段摘要（不超过 500 字），规则：保留关键事实（人名、数字、决策），保留用户偏好，丢弃寒暄和中间推理
4. **替换**：用一条 `[对话摘要]` 消息替换旧消息
5. **更新记忆索引**：在摘要 LLM 调用中同时要求提取 3-5 条关键事实（JSON 数组格式），追加到 `memory/MEMORY.md`，每条带日期前缀
6. **快照**：把压缩后的 messages 写入 `sessions/ctx.json`

**函数签名：**

```javascript
async function compress(messages, { keepRecent = 4 } = {}) → messages
```

**日志输出：** `[Compress] 5200 → 1800 tokens`

### 4. Token 计数

不自己估算，直接从 LLM API 响应中获取。Vercel AI SDK 的 `generateText` 返回 `usage.promptTokens`，即该次调用完整 prompt 的 token 数（system prompt + 全部 messages）。

每次 LLM 调用后记录 `promptTokens`，下一轮调用前用它判断是否需要压缩。因为 messages 只增不减，上一次的值是当前上下文大小的下界，判断方向不会错。

```javascript
let lastPromptTokens = 0

// LLM 调用后
const { usage } = await generateText({ ... })
lastPromptTokens = usage.promptTokens

// 下一轮调用前
if (lastPromptTokens > TOKEN_THRESHOLD) {
  messages = await compress(messages)
}
```

### 5. 工具定义

三个通用基础工具：

| 工具 | 描述 | 用途 |
|------|------|------|
| `bash` | 执行 shell 命令，返回 stdout | `ls`、`cat`、`curl` 等，返回可能很长 |
| `read_file` | 读取文件内容 | 读大文件时 Tool Result 自然膨胀 |
| `write_file` | 写入文件内容 | 通用文件操作 |

记忆更新不通过工具，而是在压缩流程中自动提取关键事实写入 `memory/MEMORY.md`。

### 6. 主循环（index.js）

ReAct 循环，每轮 LLM 调用前执行剪枝和压缩：

```
用户输入
  → messages.push(user message)
  → prune(messages)                          // 裁剪旧 Tool Result
  → if (lastPromptTokens > threshold)        // 上次调用已超阈值？
      messages = await compress(messages)    //   压缩
  → LLM 调用（带工具）→ 记录 usage.promptTokens
  → 有工具调用？执行工具，继续循环
  → 无工具调用？输出回答
```

Bootstrap 在首次 chat 时执行一次，生成 system prompt 后复用。

REPL 每行显示当前 token 数：`[Tokens: 1250 / 4000] You:`

### 7. Workspace 文件内容

**soul.md：**

```markdown
你是小橙，一个私人助理 Agent。
性格：务实、简洁、偶尔幽默。
原则：先确认再执行，不确定就问。
```

**user.md：**

```markdown
姓名：小明
职业：前端工程师
偏好：喜欢 TypeScript，用 VSCode，早上喝美式咖啡
```

**agent.md：**

```markdown
工作流程：
1. 收到任务先拆解步骤
2. 每步完成后汇报进度
3. 遇到模糊需求主动澄清

工具使用规则：
- 优先用已有工具完成任务
- 文件操作前先确认路径
- 重要信息主动写入记忆
```

**memory/MEMORY.md：**

```markdown
# 记忆索引

- [2026-04-09] 用户提到下周要做技术分享，主题是 React Server Components
- [2026-04-08] 用户喜欢用 pnpm 而不是 npm
```

## 演示流程

用户启动 demo 后，通过 CLI 对话：

1. **Bootstrap 生效**：Agent 知道自己叫小橙，知道用户是小明、喝美式
2. **工具调用 + 剪枝**：用户让 Agent 读文件或执行命令，Tool Result 被裁剪
3. **压缩触发**：连续聊十几轮后 token 超阈值，日志显示压缩过程，token 数骤降
4. **记忆持久化**：压缩后 `memory/MEMORY.md` 新增条目，`sessions/raw.jsonl` 有完整备份

REPL 输出示例：

```
[Bootstrap] System prompt loaded (820 tokens)

[Tokens: 820 / 4000] You: 帮我看看当前目录有什么文件
  [Step 1] Tool: bash({"command": "ls -la"})
[Tokens: 1350 / 4000] Agent: 当前目录下有这些文件...

[Tokens: 1350 / 4000] You: 读一下 package.json
  [Step 1] Tool: read_file({"path": "package.json"})
[Tokens: 2400 / 4000] Agent: 这是一个 Node.js 项目...

[Tokens: 2400 / 4000] You: 再看看 README
  [Prune] Tool result truncated: 1050 → 580 chars (bash result from step 1)
  [Step 1] Tool: read_file({"path": "README.md"})
[Tokens: 3200 / 4000] Agent: README 里写了...

... 继续对话 ...

[Tokens: 4300 / 4000] You: 总结一下刚才看的内容
  [Compress] Persisting 14 messages to sessions/raw.jsonl
  [Compress] Updating memory/MEMORY.md (+3 entries)
  [Compress] 4300 → 1500 tokens
[Tokens: 1500 / 4000] Agent: 综合来看...
```

## 依赖

```json
{
  "dependencies": {
    "@ai-sdk/anthropic": "latest",
    "ai": "latest",
    "zod": "latest"
  }
}
```

## 文章设计

### 元信息

- **标题**：Agent 上下文工程实战：Bootstrap、剪枝与压缩
- **tags**：ai, agent, context-engineering
- **categories**：ai
- **description**：围绕"上下文就是 Agent 的全部"这个核心观点，用 Vercel AI SDK 实现 Bootstrap 预加载、Tool Result 剪枝、对话压缩三个机制，附完整可运行 demo。

### 文章结构

**前言**
- 引出核心论点：上下文工程 = 加法 + 减法
- 用"员工入职"类比：Bootstrap 是发手册，剪枝是清理桌面，压缩是把旧笔记总结归档
- 说明本文是 Phase 1，聚焦单会话内的上下文管理，后续还有记忆检索和 Skill 按需加载

**一、Bootstrap：让 Agent 不再从零开始**
- 问题：每次对话 Agent 什么都不知道
- 解决：启动时从 workspace 文件加载身份、规则、记忆索引
- 三个原则：只注入骨架不注入全文、XML 标签分块、硬上限保护
- 贴 `bootstrap.js` 核心代码
- 展示 system prompt 组装结果

**二、上下文剪枝：给 Tool Result 做减法**
- 问题：工具返回是最大的膨胀源，贴一个具体数字说明（一次 bash 调用返回多少 token）
- 黄金规则：对话不动、Tool Result 大刀阔斧、关键信息先提取
- 贴 `prune.js` 核心代码
- 演示日志：截断前后的 token 对比

**三、上下文压缩：该忘的就忘**
- 问题：对话越来越长，Context Rot
- 简要科普 Context Rot（Transformer 注意力分散 + 成本平方增长），不展开太深
- 触发时机：30-40% 就该压，不要等到 80%
- 关键策略：压缩前先持久化（lossless）
- 完整流程：持久化 → 切分 → 摘要 → 替换 → 更新记忆索引
- 贴 `compress.js` 核心代码
- 演示日志：压缩前后的 token 骤降 + MEMORY.md 新增条目

**四、串起来：完整的 ReAct 循环**
- 贴 `index.js` 主循环代码，展示 bootstrap → prune → compress → LLM 的管道
- 完整的 REPL 运行日志截图/文本，展示一次从启动到压缩触发的完整过程

**五、延伸：Claude Code 怎么做上下文管理**
- Claude Code 的 compact 命令对标我们的 compress
- Claude Code 的 system prompt 结构对标我们的 bootstrap
- 它的 Tool Result 处理策略
- 简短对比，给读者一个"生产级实现"的参照

**总结**
- 回扣加法减法的框架
- Phase 1 解决了单会话上下文管理
- 预告 Phase 2：跨会话记忆检索、Skill 按需加载

### 写作风格

保持与系列前两篇一致：
- 中文技术写作，术语首次出现标英文原文
- 每个概念先说"解决什么问题"，再贴代码
- 代码块带注释但不过度解释
- 用实际运行日志佐证效果
- 类比帮助理解（员工手册、清理桌面、笔记归档）
- 文章长度控制在 300-400 行 Markdown
