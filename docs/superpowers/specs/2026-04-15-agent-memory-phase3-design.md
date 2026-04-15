# Phase 3 设计规格：搜索驱动的长期记忆（RAG） — Demo + 文章

## 概述

在 Phase 2（文件系统记忆）的基础上，Phase 3 解决数据量增长后的记忆检索问题——把记忆从"全量加载"变成"按需检索"。产出两部分：可运行 demo 和配套技术文章。

## 目标读者

有开发经验、对 AI Agent 感兴趣但还没深入做过 RAG 的开发者。和前两篇一致。

## 文章信息

- **文件名**：`ai-mem-rag.md`
- **标题**：简单实战一下 Agent 记忆系统（三）：搜索驱动的长期记忆
- **风格**：原理 + 可运行代码实战，和前两篇一致
- **预估篇幅**：~4500 字 + 代码块

## 技术栈

- JavaScript（和前两篇 workspace 项目一致）
- Vercel AI SDK（`ai`、`@ai-sdk/openai`）
- PostgreSQL + pgvector（Docker 本地运行）
- Embedding 模型：`text-embedding-3-small`（OpenAI 兼容接口，和 Skill 文章一致）
- Node 依赖：`pg`、`pgvector`

## 文章结构

### 第一章：RAG 的本质（~400 字）

**开场方式**：用读者已知经验类比——"你写过搜索功能吗？用户输入关键词，后端查数据库，把结果返回给前端展示——这就是最朴素的 RAG。"

**核心论点**：
- RAG = "先检索，再生成"的通用范式
- 三步流程：建索引 → 检索 → 生成（和传统搜索完全一样，最后一步从"返回用户"变成"注入 LLM 上下文"）
- 向量搜索只是其中一种实现，grep、SQL 全文索引、知识图谱都算 RAG

**配图**：传统搜索 vs RAG 三步流程对比图。

### 第二章：为什么需要它（~400 字）

**承接**：从第二篇的文件系统记忆过渡。

**三个崩溃时刻**：

1. **规模爆炸** — memory.md 有 200 行硬上限（Bootstrap 注意力预算约束），三个月对话积累装不下。拆主题文件只是推迟问题。
2. **语义模糊查询** — "上次那个航班"、"之前聊过的投资建议"——没有精确关键字，文件名和标签匹配不上。
3. **维护成本爆炸** — Agent 主动维护（写入、去重、更新时间戳、控制行数）消耗注意力预算，数据量越大越贵，恶性循环。

**结论**：把记忆从"全量加载"变成"按需检索"。

### 第三章：四种搜索方式（~1200 字）

按复杂度递进展开，给读者一张"搜索全景图"。

#### 3.1 grep / 全文扫描
- 原理：无索引，逐行正则匹配，O(n)
- 适用：小规模记忆，精确 token 匹配（错误码、文件路径）
- 简短 JS 代码片段演示
- 结论：够用但不扩展

#### 3.2 关键字 + BM25
- 原理：从文本提取结构化字段，建倒排索引
- BM25 打分逻辑：词频（TF）+ 逆文档频率（IDF）+ 文档长度归一化
- 用一个具体例子讲清 BM25 的评分过程
- 对应工具：PostgreSQL 的 `tsvector` + GIN 索引
- 适用：精确 token 场景，代码/技术文档场景下比向量搜索更准

#### 3.3 向量语义搜索
- 原理：文本 → Embedding → 向量，余弦距离越小语义越近
- 核心流程：query → embedding → 计算余弦距离 → 召回 topK
- 简短代码片段：用 Vercel AI SDK 的 `embed` 做一次 embedding + 余弦相似度
- 适用：语义模糊查询（"上次那个航班"）

#### 3.4 知识图谱（只讲原理，不实战）
- 原理：节点 + 边，通过关系推理找到一组数据
- 场景举例：组织架构、概念依赖
- 典型工具：Neo4j、Amazon Neptune
- 标注为进阶方向

**章节结尾**：一张对比表总结四种方式的适用场景、精度、性能。引出结论——"单一搜索方式都有盲区，生产级方案是混合检索"。

### 第四章：混合检索实战（~1500 字 + 代码块）

全文核心章节，读者跟着跑出一个能用的 demo。

#### 4.1 环境准备
- Docker 启动带 pgvector 的 PostgreSQL（一条 `docker run` 命令）
- npm 安装依赖：`pg`、`pgvector`、`ai`、`@ai-sdk/openai`

#### 4.2 Schema 设计
- 完整建表 SQL
- 逐字段讲解设计决策：
  - `search_tsv` 用 `GENERATED ALWAYS AS` 自动维护全文索引
  - 两个向量列：`summary_vec`（语义搜索）+ `message_vec`（细粒度匹配）
  - 向量是普通列不是独立向量数据库——一条 SQL 同时做向量排序和标量过滤
  - 为什么不用专门的纯向量数据库（两次 I/O + 数据一致性噩梦 vs 一条 SQL 搞定）

#### 4.3 写入：对话 → embedding → 入库
- JS 代码：完整写入流程
  - 从对话记录提取 summary 和 tags（LLM 提取）
  - 用 Vercel AI SDK 的 `embed` / `embedMany` 生成向量
  - `INSERT ... ON CONFLICT DO NOTHING` 幂等写入
- 重点讲 chunk 设计：一问一答为一个 chunk，为什么不能只存用户消息

#### 4.4 查询：混合检索
- JS 代码：完整混合查询函数
  - query 向量化
  - 一条 SQL 同时做：向量相似度（`<=>` 余弦距离）+ 全文匹配（`ts_rank`）+ 标量过滤（`routing_key`、时间范围）
  - 混合得分：`向量得分 × 0.7 + 全文得分 × 0.3`
  - 返回 topK 结果
- 演示一次完整的查询过程和结果输出

#### 4.5 集成到 Agent
- 把混合检索封装成一个 `memory-search` Tool
- 简短代码片段展示如何注入 Vercel AI SDK 的 tool 定义
- Agent 在需要历史上下文时自动调用

### 第五章：底层运行机制（~600 字）

用一次具体查询（"上次那个向量数据库对比"）拆解五步流程：

1. **Query 向量化** — 调用 `text-embedding-3-small`，转成 1024 维向量。强调和建索引时用同一个模型（向量空间兼容性）。
2. **向量相似度计算** — HNSW 索引做近似最近邻搜索，O(log n)，精度损失 <1%。
3. **全文得分计算** — PostgreSQL 的 `ts_rank` 对 `search_tsv` 做 BM25 近似评分。
4. **混合得分合并** — `0.7 × 向量 + 0.3 × 全文`，按得分降序取 topK。权重 0.7/0.3 是经验值。
5. **结果注入上下文** — 提取 summary + assistant_reply，组织成自然语言注入对话上下文。

**配图**：五步数据流流程图。

**收尾**：点出 `search_tsv` 的 `GENERATED ALWAYS AS` 设计——全文索引永远和数据一致，对应用层完全透明。指出 pgvector 可替换为任何支持向量列的数据库（OceanBase、AlloyDB、Neon），SQL 逻辑不变。

### 第六章：最佳实践与反模式（~600 字）

#### 反模式（三个）

1. **把 RAG 等同于向量搜索** — 精确 token（函数名、错误码）向量搜索召回率不如 BM25。混合检索才是生产方案。
2. **冷启动就上 RAG** — 几十条记忆用 grep 够了，几百条用文件系统够了，上千条才需要搜索驱动。过早引入增加复杂度却没有对应收益。
3. **向量和标量数据分离存储** — 两套系统数据一致性噩梦（向量数据库写成功、关系数据库写失败怎么办？）。pgvector 一张表、一条 SQL 搞定。

#### 最佳实践（三个）

1. **chunk 设计优先于模型选型** — 召回效果 80% 取决于 chunk 质量，20% 取决于 embedding 模型。一问一答为一个 chunk 保证语义完整。
2. **幂等写入，增量更新** — id 用内容哈希生成，`ON CONFLICT DO NOTHING` 保证幂等。每次只写入新增 chunk，不重建索引。
3. **降级重试策略写进 Skill 文档** — 搜索为空时的降级逻辑（去时间限制 → 去标签 → 纯语义搜索）写在 Skill 文档里让 Agent 自主执行，不需要写代码实现。

### 收尾（~200 字）

**系列回顾**：
- 第一篇：单次对话内的上下文管理（Bootstrap → 裁剪 → 压缩）
- 第二篇：跨会话的文件系统记忆（memory.md → Skill 管理）
- 第三篇：规模化的搜索驱动记忆（RAG → 混合检索）

**系列展望**：开放结尾，提示可能的后续方向（记忆的遗忘与衰减、多用户记忆隔离等）。

## Demo 架构

在现有 `demo/agent-memory/` 上拓展：

```
demo/agent-memory/
  ├── index.js           # 主入口（已有）
  ├── bootstrap.js       # Phase 1（不变）
  ├── prune.js           # Phase 1（不变）
  ├── compress.js        # Phase 1（不变）
  ├── skill-loader.js    # Phase 2（不变）
  ├── tools.js           # Phase 2（不变）
  ├── db.js              # 新增：PostgreSQL 连接 + pgvector 初始化
  ├── memory-store.js    # 新增：写入流程（embedding + 入库）
  ├── memory-search.js   # 新增：混合检索查询
  ├── schema.sql         # 新增：完整建表语句
  ├── server.js          # 已有（不变）
  ├── package.json       # 更新：新增 pg、pgvector 依赖
  ├── skills/
  │   ├── memory-save.md       # 已有（不变）
  │   ├── memory-governance.md # 已有（不变）
  │   ├── skill-creator.md     # 已有（不变）
  │   └── memory-search.md     # 新增：搜索降级策略 Skill
  └── workspace/               # 已有（不变）
```

### 设计决策

1. **Phase 1/2 代码不动**：bootstrap.js、prune.js、compress.js、skill-loader.js、tools.js 保持原样
2. **数据库逻辑独立模块**：db.js 管连接，memory-store.js 管写入，memory-search.js 管查询，职责清晰
3. **schema.sql 独立文件**：读者可以直接 `psql -f schema.sql` 初始化数据库
4. **memory-search Skill**：降级重试策略以 Skill 文档形式存在，Agent 自主决策，不硬编码

## 配图清单

1. **传统搜索 vs RAG 对比图**（第一章）：两列三步流程，结构一致性
2. **混合检索五步流程图**（第五章）：query → 向量化 → HNSW + ts_rank → 合并得分 → 注入上下文

## Frontmatter

```yaml
---
title: 简单实战一下 Agent 记忆系统（三）：搜索驱动的长期记忆
date: 2026-04-15 10:00:00
tags:
  - ai
  - agent
  - context-engineering
categories:
  - ai
description: 文件系统记忆扛不住规模增长，用 pgvector 混合检索（向量 + 全文 + 标量）实现按需召回的长期记忆。JS 实战 + 原理拆解。
---
```
