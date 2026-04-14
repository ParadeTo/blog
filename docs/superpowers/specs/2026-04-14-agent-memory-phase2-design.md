# Phase 2 设计规格：文件系统记忆 — Demo + 文章

## 概述

在 Phase 1（Bootstrap + 剪枝 + 压缩）的基础上，Phase 2 实现上下文管理的"加法"——让 Agent 自己写记忆、学技能、做治理。产出两部分：可运行 demo 和配套技术文章。

## Demo 架构

### 文件结构

在现有 `demo/agent-memory/` 上拓展：

```
demo/agent-memory/
  ├── index.js           # 主入口：ReAct 循环 + Skill 路由（重构）
  ├── bootstrap.js       # Phase 1，不变
  ├── prune.js           # Phase 1，不变
  ├── compress.js        # Phase 1，不变
  ├── skill-loader.js    # 新增：加载和解析 skill .md 文件
  ├── tools.js           # 新增：工具定义集中管理
  ├── server.js          # 已有，不变
  ├── package.json       # 已有，不变
  ├── skills/            # Skill 定义文件（Agent 的程序记忆）
  │   ├── memory-save.md
  │   ├── memory-governance.md
  │   ├── skill-creator.md     # 从官方下载/参考
  │   └── analyze-stock.md     # 示例：由 skill-creator 生成的程序记忆
  ├── workspace/         # 用户数据
  │   ├── soul.md        # 已有
  │   ├── user.md        # 已有
  │   ├── agent.md       # 已有
  │   ├── memory/
  │   │   └── MEMORY.md  # 已有
  │   └── sessions/      # 已有
```

### 设计决策

1. **Phase 1 代码不动**：bootstrap.js、prune.js、compress.js 保持原样
2. **Skill 纯 prompt 驱动**：memory-save 和 memory-governance 不需要独立的 .js 模块，完全通过 skill .md 文件中的 prompt 指导 Agent 使用已有工具执行
3. **Skill 目录在 Agent 层级**：`skills/` 与 `workspace/` 同级，前者是 Agent 能力定义，后者是用户数据
4. **tools 独立模块**：bash、read_file、write_file 工具定义从 index.js 抽到 tools.js
5. **Agent 自主决定 skill 加载**：不硬编码路由。给 Agent 一个 `load_skill` 工具，参数是 skill name。启动时 skill 的 name+description 列表注入 system prompt，Agent 根据用户输入自主决定是否调用 `load_skill`

### 新增模块说明

#### skill-loader.js

从 `demo/agent-skill/utils.js` 复用 `parseFrontmatter` 和 `loadSkills` 逻辑：
- 扫描 `skills/` 目录下的 `.md` 文件
- 解析 frontmatter（name, description）和正文（prompt）
- 返回 skill 元数据列表

#### tools.js

集中管理 Agent 可用的工具：
- `bash`：执行 shell 命令
- `read_file`：读取文件内容
- `write_file`：写入文件内容
- `load_skill`：按 name 加载指定 skill 的完整 prompt，返回值为 skill 正文（prompt 文本），Agent 将其视为当前任务的执行指导

#### index.js 重构

核心变化：
1. 启动时用 skill-loader.js 加载 skills/ 目录，将 name+description 列表注入 bootstrap system prompt
2. 工具集从 tools.js 导入，包含 `load_skill` 工具
3. Agent 在 ReAct 循环中自主决定是否调用 `load_skill`
4. 如果调用了 load_skill，skill prompt 追加到当前上下文
5. 保持现有的 prune → compress → LLM 调用流程

### Skill 文件设计

#### skills/memory-save.md

frontmatter:
- name: memory-save
- description: 当用户说"记住这个"、"帮我记下来"、描述个人偏好/习惯/工作方式，或对话自然结束时触发

正文（四步规范）：
1. **写入前判断（四道门）**：Utility / Confidence / Novelty / Type，每条门附带 why 说明
2. **分类路由**：偏好→user.md / 行为规范→agent.md / 主题记忆→MEMORY.md+主题文件
3. **行数门控**：<150 正常 / 150-179 预警 / >=180 拒绝，附带 why（Bootstrap 全量加载，超限注意力被压缩）
4. **更新或追加**：先读后写防重复，写入后 read_file 验证。附带 why（防止追加式累积导致膨胀）

安全原则：禁止直接写入来源不明的外部工具原始输出，附带 why（防范 Prompt Injection 写入持久化记忆）

#### skills/memory-governance.md

frontmatter:
- name: memory-governance
- description: 当用户说"审计记忆"、"清理记忆"、"整理记忆文件"，或 memory-save 返回行数预警时触发。建议每月一次。

正文（扫描→报告→确认→清理）：
1. **8 类扫描检查**：行数+死链 / 野文档 / 路由错配 / 表述冲突 / 表述冗余 / Skills健康度 / 安全扫描 / 过期条目（180天）。每类附带 why
2. **报告**：生成 Markdown 格式治理报告
3. **CRITICAL 等待确认**：不得在用户确认前执行任何删除或修改。附带 why（误判删除有效资料不可逆）
4. **清理**：用户确认后逐项执行，优先归档而非删除

#### skills/skill-creator.md

从 Anthropic 官方 skill-creator 下载/参考，放入 skills/ 目录。使 Agent 具备"用户教 SOP → 自动生成 skill 文件"的能力。

#### skills/analyze-stock.md

预置的示例 skill 文件，展示 skill-creator 的输出效果。内容为一个港股分析 SOP（查行情→看新闻→技术面→出报告）。

## 文章结构

文件名：`source/_posts/ai-mem-file.md`

```
---
title: AI Agent Memory 实战（二）：文件系统记忆
date: 2026-04-14
tags: [ai, agent]
categories: [ai]
description: 介绍 AI Agent 文件系统记忆的实战方案，包括 memory-save 记忆写入、skill-creator 程序记忆沉淀、memory-governance 记忆治理，并解析 Claude Code 的记忆实现。
---

# 前言
回顾 Phase 1（减法），引出 Phase 2（加法）

# 一、memory-save：有控制地写入知识记忆
## 1.1 两种触发方式（显式 + Agent 主动）
## 1.2 memory 文件结构设计（MEMORY.md 只存指针 + 主题文件）
## 1.3 四步写入规范（判断 → 路由 → 门控 → 更新）
## 1.4 Demo 演示 + 代码讲解

# 二、skill-creator：把 SOP 沉淀为程序记忆
## 2.1 语义记忆 vs 程序记忆
## 2.2 为什么 SOP 不能存 memory 文件（三条原因）
## 2.3 Skill 文件规范（name/description/正文 + explain the why）
## 2.4 Demo 演示（skill-creator + analyze-stock 示例）
## 2.5 memory 还是 skill：一句话判断规则

# 三、memory-governance：记忆治理
## 3.1 为什么需要 GC
## 3.2 触发时机（阈值 / 定期 / 用户主动）
## 3.3 8 类检查详解
## 3.4 Demo 演示 + 代码讲解

# 四、Claude Code 的记忆实现
## 4.1 Auto-memory：四种记忆类型 + MEMORY.md 索引
    - 源码路径：src/memdir/memdir.ts, memoryTypes.ts
    - 四种类型：user / feedback / project / reference
    - MEMORY.md 200 行/25KB 上限 + 截断警告
## 4.2 Skill 系统：多源加载、条件激活、去重
    - 源码路径：src/skills/loadSkillsDir.ts, src/tools/SkillTool/
    - 多源搜索优先级：policy > user settings > project dirs
    - 条件 skill：paths frontmatter 匹配
    - 按 symlink 路径去重
## 4.3 记忆治理：backgroundHousekeeping + autoDream
    - 源码路径：src/utils/backgroundHousekeeping.ts, src/services/autoDream/
    - 启动后 10 分钟清理 30 天前的历史文件
    - autoDream：时间门控 + 会话门控 → forked subagent 整合日志到 MEMORY.md

# 五、整体架构演进
Phase 1 → Phase 2 架构对比图

# 六、总结
从"上下文管理"到"文件系统记忆"的完整闭环。
参考 idea/agent-memory.md Phase 2 末尾的判断规则，用自己的话重新组织。
```

## Demo 交互场景

### 场景 1：memory-save

```
You: 我喜欢代码注释用中文
Agent: [load_skill: memory-save]
       [read_file: workspace/user.md]
       [write_file: workspace/user.md]  → 追加"偏好：代码注释用中文"
       [read_file: workspace/user.md]  → 验证
       已记住：你喜欢代码注释用中文。
```

### 场景 2：skill-creator

```
You: 以后帮我分析港股的流程：先查实时行情，再看新闻，再做技术面，最后出报告。保存成技能。
Agent: [load_skill: skill-creator]
       [write_file: skills/analyze-hk-stock.md]  → 生成 skill 文件
       [read_file: skills/analyze-hk-stock.md]  → 验证
       已创建技能"analyze-hk-stock"，下次说"分析XX港股"自动触发。
```

### 场景 3：memory-governance

```
You: 帮我审计一下记忆文件
Agent: [load_skill: memory-governance]
       [read_file: workspace/memory/MEMORY.md]
       [bash: ls workspace/]
       [read_file: workspace/user.md]
       ── 治理报告 ──
       1. MEMORY.md: 12 行，正常
       2. 死链检查：无
       3. user.md 有 1 条过期条目（180天前）
       确认清理吗？
You: 确认
Agent: [write_file: workspace/user.md]  → 移除过期条目
       清理完成。
```

## 技术栈

- 运行时：Node.js (ESM)
- SDK：Vercel AI SDK + @ai-sdk/anthropic
- 模型：Claude Sonnet
- 语言：JavaScript
- 无新增依赖

## 边界约束

- Phase 1 代码（bootstrap.js / prune.js / compress.js）不修改
- workspace/ 下的初始文件（soul.md / user.md / agent.md）不修改
- skill 文件正文每条关键规则必须附带 why 说明
- MEMORY.md 200 行硬上限保持不变
