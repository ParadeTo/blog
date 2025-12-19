---
title: AI Agent Memory 实战
date: 2025-12-19 15:30:16
tags:
  - ai
  - agent
categories:
  - ai
description: 介绍 AI Agent 的记忆实现方案，包括基于 LangGraph 的会话级记忆和基于 Mem0 与 Qdrant 的长期记忆实战，涵盖核心原理、本地部署及 RAG 流程闭环。
---

# 前言

在构建 AI Agent 时，"记忆"是一个绕不开的话题。一个没有记忆的 Agent 就像金鱼一样，每次对话都从零开始。用户说"我叫小明"，下一轮就忘了。这显然不是我们想要的智能体验。

本文介绍两种记忆实现方案：

1. **Memory（会话记忆）**：基于 LangGraph 的 `MemorySaver`，实现单次会话内的状态持久化。
2. **Mem0（长期记忆）**：基于向量数据库（如 Qdrant），实现跨会话的用户偏好存储与检索。

# 一、Memory：会话级记忆

## 1.1 解决什么问题

会话记忆（Short-term Memory）主要用于维护当前对话的连贯性。

**案例**：餐卡充值助手。
用户第一次说"充值 10 元"，余额变成 110 元。第二次再说"再充 10 元"，Agent 必须知道刚才已经充过了，当前的基数是 110 元。

## 1.2 核心实现

我们利用 LangGraph 的 `Annotation.Root` 来定义状态，并使用 `reducer` 累加消息：

```typescript
// src/memory/graph.ts
const GraphState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
})

// LLM 节点：注入 System Prompt 并调用模型
async function llmCall(state: typeof GraphState.State) {
  const messages = [new SystemMessage(SYSTEM_PROMPT), ...state.messages]
  const response = await llm.invoke(messages)
  return {messages: [response]}
}

// 编译图时挂载 MemorySaver
const memory = new MemorySaver()
const agent = workflow.compile({checkpointer: memory})
```

## 1.3 运行效果

通过 `thread_id` 来标记同一个会话。

```typescript
const config = {configurable: {thread_id: '123'}}

// 第一轮
await agent.invoke({messages: [new HumanMessage('帮我充值10元')]}, config)
// 输出：工具参数: { original_amount: 100 } -> 余额 110

// 第二轮
await agent.invoke({messages: [new HumanMessage('再充10元')]}, config)
// 输出：工具参数: { original_amount: 110 } -> 余额 120
```

**实际运行日志**：

```bash
> pnpm memory:dev

工具名称: add_tool
工具参数: { original_amount: 110 }
您的餐卡已经充值10元，充值后的余额是120元。
工具名称: add_tool
工具参数: { original_amount: 120 }
您的餐卡已经充值10元，充值后的余额是130元。
```

---

# 二、Mem0：长期记忆

## 2.1 解决什么问题

长期记忆（Long-term Memory）跨越了会话的限制。即使过了半个月，Agent 依然记得小张喜欢喝什么，或者用户的家庭成员关系。

这本质上是一个 **RAG (Retrieval-Augmented Generation)** 流程：存储（Store）时将对话提取为向量，查询（Search）时召回相关的历史片段。

## 2.2 核心概念：Qdrant

Qdrant 是一款高性能的开源向量数据库，专为向量搜索（Vector Search）而设计。它能够处理海量的高维向量数据，并支持实时更新和混合查询。

在本地部署 Qdrant 时，你会接触到以下核心概念：

- **Collection（集合）**：类似于关系型数据库中的“表”。每个 Collection 包含一组 Points，并统一定义了向量的维度（如 1536 维）和度量方式（如 Cosine 相似度）。
- **Point（点）**：Qdrant 中存储的最小数据单位，类似于“行”。
  - **ID**：Point 的唯一标识，可以是数字或 UUID。
  - **Vector**：数据的向量表示（由 Embedding 模型生成），它是搜索的灵魂。
  - **Payload**：挂载在该点上的“元数据”（JSON 对象）。
    - **作用**：Payload 让向量数据库具备了“结构化搜索”的能力。
    - **案例**：我们把对话文本存入 `memory` 字段，把用户 ID 存入 `user_id` 字段。查询时，我们可以通过 Payload 过滤出“只属于 xyy 这个用户”的记忆。

**为什么选择 Qdrant？**

1. **高性能**：底层使用 Rust 编写，检索速度极快。
2. **混合搜索**：既能搜“向量相似度”，又能根据 Payload 做“硬过滤”（如 `user_id == 'xyy'`）。
3. **部署简单**：一个 Docker/Podman 镜像即可跑起来。

```typescript
// src/mem0/memconfig.ts 写入逻辑
await qdrant.upsert(COLLECTION_NAME, {
  points: [
    {
      id: Date.now(), // 唯一 ID
      vector: vector, // 向量数据
      payload: {memory: text, user_id: userId}, // 挂载元数据，方便后续过滤
    },
  ],
})
```

## 2.3 本地部署 Qdrant (Podman)

为了实现长期记忆，我们需要一个运行中的 Qdrant 服务。使用 Podman（或 Docker）部署是最快的方式。

```bash
podman run -d --name qdrant \
  -p 6333:6333 \
  -v ~/qdrant_data:/qdrant/storage \
  qdrant/qdrant
```

部署成功后，Qdrant 自带了一个非常漂亮的**图形化管理后台**。你可以直接访问：
`http://localhost:6333/dashboard`

在这里你可以直观地看到所有的 Collection、Points 以及它们的 Payload 内容。

## 2.4 存储案例 (Store)

我们可以手动存储一些背景信息：

```typescript
// src/mem0/test/store-mem.ts
const messages = [
  {role: 'user', content: '小张和小明是什么关系？'},
  {role: 'assistant', content: '小张是小明的爸爸'},
  {role: 'user', content: '小张喜欢喝什么饮料？'},
  {role: 'assistant', content: '小张喜欢喝大窑。'},
]
await m.add(messages, 'xyy')
```

## 2.5 搜索案例 (Search)

当用户提问时，Agent 会先去库里"翻翻旧账"：

```typescript
// src/mem0/test/search-mem.ts
const results = await m.search('小明的爸爸喜欢喝什么饮料？', {user_id: 'xyy'})
console.log(results)
```

**实际运行日志**：

```bash
> pnpm mem0:search

[
  {
    memory: 'user: 小张和小明是什么关系？\n' +
      'assistant: 小张是小明的爸爸\n' +
      'user: 小张喜欢喝什么饮料？\n' +
      'assistant: 小张喜欢喝大窑。',
    score: 0.84008104
  }
]
```

## 2.6 流程闭环：从检索到生成

有了存储（Store）和搜索（Search）能力后，最后一步就是将它们集成到 Agent 的执行流中。这是一个经典的 **RAG（检索增强生成）** 模式。

在 `src/mem0/graph.ts` 中，我们的核心逻辑如下：

1.  **精准召回**：每当用户说一句话，我们先拿这句话去 Qdrant 库里搜索最相关的 5 条记忆。
2.  **动态注入**：将搜到的“陈年旧事”格式化为一段文本，作为上下文注入到 `SystemMessage` 中。
3.  **个性化生成**：LLM 看到这些上下文后，就会表现得“很懂你”。

```typescript
async function chat(state: typeof ChatState.State) {
  const messages = state.messages
  const userId = state.mem0UserId

  // 1. 获取用户最后一条提问，并召回相关记忆
  const lastMessage = messages[messages.length - 1]
  const memories = await m.search(lastMessage.content, {user_id: userId})

  // 2. 将记忆片段拼接成上下文字符串
  let context = '来自以往对话的相关信息：\n'
  if (memories && memories.length > 0) {
    memories.forEach((mem) => {
      context += `- ${mem.memory}\n`
    })
  } else {
    context += '(暂无相关记忆)\n'
  }

  // 3. 构造包含“记忆”的系统提示词
  const systemPrompt = `你是一个擅长解决客户问题的客服助手。
请根据以下上下文信息来个性化你的回答，并记住用户偏好和过往的交互。

${context}`

  const systemMessage = new SystemMessage(systemPrompt)

  // 4. 合并消息并调用 LLM
  const fullMessages = [systemMessage, ...messages]
  const response = await llm.invoke(fullMessages)

  return {messages: [response]}
}
```

最终输出：

```
小明的爸爸是小张，他喜欢喝大窑。有什么其他需要帮忙的吗？
```

# 五、总结

记忆是让 AI Agent 变得“聪明”的关键能力之一。

- **MemorySaver** 提供了轻量的会话状态管理，确保对话不掉线。
- **Qdrant (Mem0 模式)** 提供了强大的长期记忆能力，让 Agent 真正“认识”用户。

根据实际需求选择合适的方案，或者组合使用，可以显著提升 Agent 的用户体验。让你的 Agent 不再是“金鱼”，而是一个真正懂用户的智能助理。
