---
title: 让 Agent 学会自动刹车：重试、循环控制与成本围栏
date: 2026-05-18 14:35:00
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用一个 JS demo 给 Agent 加运行时护栏，把 Hook 从观测系统升级成可以拦截重试失控、循环和成本超预算的控制面。
---

# 前言

Agent 失控的时候，经常不是“坏”，而是“蠢”。

工具失败了，它可能再试一次。再试一次还失败，它可能继续试。拿到同样的结果，它也可能觉得“我再换个说法问问”。如果上下文很长、工具很贵，最后看起来只是一个普通任务，账单却悄悄涨上去了。

上一篇讲 Hook + Langfuse，解决的是“看见 Agent 每一步在做什么”。看见以后，下一个问题很自然：

**看见它在原地打转以后，谁来踩刹车？**

这篇就给 Agent 加一层运行时护栏。重点不是让 prompt 写得更严，而是把重试、循环检测、成本预算做成 Hook 策略，让主流程继续专心跑任务，护栏在关键节点决定是否继续执行。

这篇对应的 demo 放在仓库的 [`demo/agent-reliability-guardrails`](https://github.com/ParadeTo/blog/tree/master/demo/agent-reliability-guardrails) 目录。

先别急着看具体策略，先把 Agent 的一次执行链路摆出来：

```text
用户任务
  -> LLM 推理
  -> 工具调用前
  -> 工具执行
  -> 工具调用后
  -> 本轮结束
  -> 任务完成
```

护栏不是凭空挂上去的。它要卡在这些节点上：

| 节点 | 能看到什么 | 适合做什么 |
|------|------------|------------|
| 工具调用前 | 工具名、工具入参、当前累计状态 | 超预算就别再执行工具 |
| 工具调用后 | 工具是否成功、工具输出 | 统计失败、识别重复输出 |
| 本轮结束 | LLM 输出、token usage | 估算成本、识别重复回复 |
| 最外层 catch | 护栏拒绝原因 | 把拒绝变成可读结果 |

后面会反复出现几个名字，先混个脸熟：

| 名字 | 先怎么理解 |
|------|------------|
| `dispatch` | 观测通道，日志和 trace 走这里 |
| `dispatchGate` | 门禁通道，护栏策略走这里 |
| `GuardrailDeny` | 护栏主动拒绝时抛出的信号 |
| `runGuardedToolCall` | 工具调用外面那层包装，负责补齐事件 |
| `RetryTracker` | 记录工具失败模式，避免无脑重试 |
| `LoopDetector` | 用状态哈希发现 Agent 原地打转 |
| `CostGuard` | 累加 token 成本，超预算就拦 |
| `strategies` | `hooks.yaml` 里声明这些策略挂在哪些事件上 |

所以后面的顺序是这样的：先讲 Hook 为什么要分成观测通道和门禁通道，再讲 `GuardrailDeny` 怎么表达拒绝，最后看 `RetryTracker`、`LoopDetector`、`CostGuard` 怎么挂到链路上。

---

# 一、Hook 从日志系统变成控制系统

先看普通 Hook。

Agent loop 在几个固定位置发事件：调用模型前、调用工具前、工具调用后、每轮结束后、任务完成后。结构化日志、Langfuse trace、审计文件都可以挂在这些事件上。

```js
export const EventType = Object.freeze({
  BEFORE_TURN: 'before_turn',
  BEFORE_LLM: 'before_llm',
  BEFORE_TOOL_CALL: 'before_tool_call',
  AFTER_TOOL_CALL: 'after_tool_call',
  AFTER_TURN: 'after_turn',
  TASK_COMPLETE: 'task_complete',
  SESSION_END: 'session_end',
})
```

做观测时，Hook 有一个默认原则：**handler 失败不能拖垮主流程**。日志写失败了，最多丢一条日志；Langfuse 临时不可用，也不能让 Agent 任务直接失败。

可靠性护栏不一样。

如果成本已经超预算，或者循环检测已经发现原地打转，拒绝信号不能被吞掉。所以 `HookRegistry` 里分成两条分发路径：

```js
async dispatch(eventType, context = {}) {
  for (const entry of this.handlers.get(eventType)) {
    try {
      await entry.handler(context)
    } catch (error) {
      this.logHandlerError(eventType, entry.name, error)
    }
  }
}

async dispatchGate(eventType, context = {}) {
  for (const entry of this.handlers.get(eventType)) {
    try {
      await entry.handler(context)
    } catch (error) {
      if (error instanceof GuardrailDeny) {
        throw error
      }
      this.logHandlerError(eventType, entry.name, error)
    }
  }
}
```

`dispatch` 是观测通道，普通异常会被记录下来。`dispatchGate` 是门禁通道，普通异常仍然隔离，但 `GuardrailDeny` 会继续往外抛。

这一刀切开后，Hook 就不只是“旁路记录”。它变成了 Agent 的控制面。

---

# 二、GuardrailDeny：拒绝必须是一个明确信号

如果护栏只是抛一个普通 `Error`，外层很难判断它到底是工具炸了、日志炸了，还是策略主动拒绝。

所以 demo 里单独定义了 `GuardrailDeny`：

```js
export class GuardrailDeny extends Error {
  constructor(reason, metadata = {}) {
    super(reason)
    this.name = 'GuardrailDeny'
    this.reason = reason
    this.metadata = metadata
  }
}
```

它解决两个问题。

第一，`dispatchGate` 只会把这种拒绝信号向上传播。普通 handler 异常继续按观测故障处理，不影响 Agent。

第二，最外层可以用统一方式收口：

```js
try {
  await runRealAgent(...)
} catch (error) {
  if (error instanceof GuardrailDeny) {
    console.error(`Guardrail triggered: ${error.reason}`)
    return
  }
  throw error
}
```

这样终端里看到的不是一坨 stack trace，而是明确的护栏原因：

```text
Guardrail triggered: Budget exceeded: $0.000635 >= limit $0.000500
```

这里还有一个容易漏的细节：工具调用前触发拒绝时，工具根本不会执行。那这次工具调用怎么进观测链路？

`runGuardedToolCall` 会补一条失败的 `afterToolCall`，再原样抛出拒绝：

```js
try {
  await adapter.beforeToolCall({ toolName, toolInput })
} catch (error) {
  if (error instanceof GuardrailDeny) {
    await adapter.afterToolCall({
      toolName,
      toolInput,
      success: false,
      output: '',
      metadata: {
        guardrailDeny: true,
        denyReason: error.reason,
        deniedBeforeExecution: true,
      },
    })
  }
  throw error
}
```

这段逻辑做的是拒绝后的事件补偿：`beforeToolCall` 已经阻止工具执行，但 `afterToolCall` 仍然会收到一条失败事件，里面带着 `guardrailDeny`、`denyReason` 和 `deniedBeforeExecution`。

这样观测链路能分清两种失败：一种是工具真的执行失败了，另一种是工具还没执行就被护栏拦住了。

核心只有一句：**拒绝信号不能丢，也不能被普通工具失败覆盖。**

---

# 三、RetryTracker：先记录失败模式

有了 `GuardrailDeny`，不代表所有异常都要立刻拒绝。

第一类要处理的是工具失败。它最常见，也最容易误判：外部 API 偶发 500，可能重试一次就好了；鉴权失败、参数错误、资源不存在，重试十次也还是错。

Agent 这里更麻烦。错误信息会进入上下文，连续失败会污染后面的推理。所以在真正决定“要不要拦”之前，先把失败次数、失败来源和恢复情况记下来。

所以 demo 里的 `RetryTracker` 先做观测，不直接帮工具重试：

```js
export class RetryTracker {
  constructor({ maxRetries = 3, logger = console.error } = {}) {
    this.maxRetries = maxRetries
    this.failures = new Map()
    this.totalRetries = 0
    this.successfulRetries = 0
  }

  afterToolHandler(ctx) {
    const toolName = ctx.toolName || 'unknown'
    const currentFailures = this.failures.get(toolName) ?? 0

    if (ctx.success) {
      if (currentFailures > 0) {
        this.successfulRetries += 1
        this.failures.set(toolName, 0)
      }
      return
    }

    const nextFailures = currentFailures + 1
    this.failures.set(toolName, nextFailures)

    if (currentFailures > 0) {
      this.totalRetries += 1
    }
  }
}
```

这个 demo 里的重试发生在 Agent loop 里。工具抛出普通异常后，如果开启了 `continueOnToolError`，`runRealAgent` 会把错误转成一次工具返回，再塞回消息列表：

```js
try {
  toolOutput = await runGuardedToolCall({
    adapter: agentAdapter,
    toolName,
    toolInput,
    execute: tool.execute,
  })
} catch (error) {
  if (!continueOnToolError || error instanceof GuardrailDeny) {
    throw error
  }

  toolOutput = {
    errcode: 1,
    error: error.message,
  }
}

messages.push({
  role: 'tool',
  tool_call_id: call.id,
  name: toolName,
  content: serializeToolOutput(toolOutput),
})
```

也就是说，`RetryTracker` 不负责“再执行一次”。它只记录第一次失败。下一轮 LLM 看到 `{ errcode: 1, error: "flaky tool failed" }` 后，可以选择继续调用同一个工具，也可以换方案。

retry 场景里走的是第一种：`flaky_tool` 第一次失败，下一轮又被调用一次，这次成功。`RetryTracker` 看到“先失败、后成功”，于是把它记成一次恢复。

如果要做框架层自动重试，位置也在这个 catch 附近：先判断错误是否可重试，再检查工具是否幂等，最后按 backoff 重新执行 `runGuardedToolCall`。这个 demo 没把自动重试写进 executor，是为了把“谁发起重试”和“谁记录重试效果”分开。

最后 metrics 会变成这样：

```json
{
  "total_retries": 0,
  "successful_retries": 1,
  "retry_success_rate": 1,
  "active_failures": {
    "flaky_tool": 0
  }
}
```

这里 `successful_retries` 比单纯的“失败次数”更有用。它告诉你：这类失败到底有没有靠重试恢复。如果一个工具连续失败很多次，却几乎没有恢复记录，那就不该继续重试，应该改参数、降级，或者直接让任务失败。

---

# 四、LoopDetector：不要等 maxIterations 才停

`maxIterations` 是兜底。它能限制最多跑几轮，但它不知道 Agent 是不是从第 3 轮开始就在重复同一个动作。

循环检测要看状态。

demo 里有一个专门的 `repeat_state` 工具，用来模拟 Agent 反复拿到同一个结果。`LoopDetector` 会把工具名和输出拼成状态，再做哈希：

```js
afterToolHandler(ctx) {
  this.totalToolCalls += 1
  const output = String(ctx.metadata?.toolOutput ?? '')
  const state = `${ctx.toolName || ''}:${output}`

  this.checkLoop(this.toolHashes, state, ctx)
}
```

`checkLoop` 保留最近 N 次哈希。如果连续 N 次完全一样，就抛 `GuardrailDeny`：

```js
if (hashes.length === this.threshold && hashes.every((entry) => entry === hash)) {
  this.loopDetections += 1
  const reason = `Loop detected: identical state repeated ${this.threshold} consecutive times`

  throw new GuardrailDeny(reason, { guardrail: 'loop_detector' })
}
```

这和 `maxIterations` 的差别很明显。

| 机制 | 看什么 | 什么时候停 |
|------|--------|------------|
| `maxIterations` | 总轮数 | 跑满上限 |
| `LoopDetector` | 最近状态是否重复 | 发现重复就停 |

运行 deterministic loop 场景：

```bash
GUARDRAIL_SCENARIO=loop npm start -- "反复检查同一个状态，直到你认为可以停止"
```

输出里能看到它在第 3 次重复时被拦住：

```text
Guardrail triggered: Loop detected: identical state repeated 3 consecutive times

Metrics: loop-detector
{
  "total_turns": 2,
  "total_tool_calls": 3,
  "unique_states": 3,
  "loop_detections": 1
}
```

生产里状态指纹要按业务调。只看完整输出，可能漏掉语义重复；截得太短，又可能误判。更稳的做法是先只记录 metrics，跑一段时间后再打开拦截。

---

# 五、CostGuard：预算要在运行中生效

成本控制不能等账单出来再复盘。

Agent 的执行路径不稳定。同一个任务，可能两轮完成，也可能调用十几次工具。上下文越滚越长，每一轮模型调用都会更贵。

`CostGuard` 做两件事：

1. 每轮结束后，按 usage 累加输入和输出 token。
2. 工具调用前和每轮结束后检查预算，超了就拒绝继续执行。

代码核心很短：

```js
afterTurnHandler(ctx) {
  this.inputTokens += Number(ctx.inputTokens ?? 0)
  this.outputTokens += Number(ctx.outputTokens ?? 0)
  this.estimatedCost = this.calculateCost()

  this.emitCostUpdate(ctx)
  this.denyIfOverBudget(ctx)
}

beforeToolHandler(ctx = {}) {
  this.denyIfOverBudget(ctx)
}
```

成本估算用一个模型价格表：

```js
const MODEL_PRICES = Object.freeze({
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'qwen-plus': { input: 0.8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
})
```

这不追求账单级精确。护栏层需要的是及时刹车，精确分析可以交给 Langfuse。

跑低预算场景：

```bash
COST_GUARD_BUDGET=0.0005 npm start
```

这次真实跑出来的结果是：

```text
Guardrail triggered: Budget exceeded: $0.000635 >= limit $0.000500

Metrics: cost-guard
{
  "model": "gpt-4o-mini",
  "total_input_tokens": 1281,
  "total_output_tokens": 738,
  "estimated_cost_usd": 0.000635,
  "budget_usd": 0.0005,
  "deny_count": 1
}
```

这里预算是运行时硬约束，不是 prompt 里的“请节省一点”。Agent 不需要理解价格表，价格表也不应该交给 Agent 自己判断。

---

# 六、策略化之后，主流程干净很多

如果把这些判断都塞进 Agent loop，代码很快会变成这样：

```js
if (toolFailedTooManyTimes) ...
if (sameStateRepeated) ...
if (costExceeded) ...
if (auditEnabled) ...
if (langfuseEnabled) ...
```

这条路走不远。每加一个规则，主流程就多一个分支。

demo 里把普通 Hook 和护栏策略都放到 `hooks.yaml`：

```yaml
hooks:
  BEFORE_TOOL_CALL:
    - handler: structured-log.beforeToolHandler
    - handler: langfuse-trace.beforeToolHandler
  AFTER_TOOL_CALL:
    - handler: structured-log.afterToolHandler
    - handler: langfuse-trace.afterToolHandler

strategies:
  retry-tracker:
    class: retry-tracker.RetryTracker
    config:
      maxRetries: 3
    hooks:
      AFTER_TOOL_CALL: afterToolHandler
  cost-guard:
    class: cost-guard.CostGuard
    config:
      budgetUsd: 1
    hooks:
      AFTER_TURN: afterTurnHandler
      BEFORE_TOOL_CALL: beforeToolHandler
  loop-detector:
    class: loop-detector.LoopDetector
    config:
      threshold: 3
    hooks:
      AFTER_TOOL_CALL: afterToolHandler
      AFTER_TURN: afterTurnHandler
```

`HookLoader` 加载普通 `hooks` 时，把它们注册成 `observe`；加载 `strategies` 时，把它们注册成 `gate`：

```js
this.registry.register(eventType, handler, name, {
  mode: 'observe',
})

this.registry.register(eventType, method.bind(instance), name, {
  mode: 'gate',
})
```

策略是 class，不是普通函数，因为它们需要状态。

`RetryTracker` 要记每个工具的连续失败次数，`CostGuard` 要记累计 token 和累计费用，`LoopDetector` 要记最近状态哈希。这些状态不应该散落在 Agent loop 里。

Agent loop 只保留一件事：在正确的位置发事件。

```js
await agentAdapter.beforeLlm({ messages })

const response = await chatClient(...)

toolOutput = await runGuardedToolCall({
  adapter: agentAdapter,
  toolName,
  toolInput,
  execute: tool.execute,
})

await agentAdapter.afterTurn({
  output: finalContent,
  llmResponse: finalContent,
  usage: response.usage,
})
```

主流程少一点“策略知识”，系统就更容易加新护栏。今天是成本和循环，明天可以是敏感数据、权限边界、交付门禁。

---

# 七、跑一下 demo

先准备环境：

```bash
cd demo/agent-reliability-guardrails
source ~/.nvm/nvm.sh
nvm use 20.19.5
npm install
npm run build:sandbox
```

`.env` 里需要有模型服务和 Langfuse 配置：

```bash
OPENAI_API_KEY=...
OPENAI_API_BASE=http://localhost:3002
AGENT_MODEL=gpt-4o-mini

LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_BASE_URL=http://localhost:3000
```

正常跑一次：

```bash
npm start -- "为一个短链接服务产出技术设计文档"
```

预期是生成 `workspace/demo-agent/output/design_doc.md`，终端打印三个策略的 metrics，最后给出 Langfuse URL。

再跑成本拦截：

```bash
COST_GUARD_BUDGET=0.0005 npm start
```

再跑循环检测：

```bash
GUARDRAIL_SCENARIO=loop npm start -- "反复检查同一个状态，直到你认为可以停止"
```

再跑重试恢复：

```bash
GUARDRAIL_SCENARIO=retry npm start -- "调用不稳定工具并继续完成任务"
```

这四条命令都不是单元测试里的 mock。正常场景和成本场景会走真实模型接口，loop 和 retry 是 deterministic 场景，用来稳定复现护栏行为。

最后跑测试：

```bash
npm test
```

当前 demo 的测试覆盖 57 个用例，包括 Hook 分发、策略注册、沙箱路径限制、真实 Agent loop、loop/retry 场景和 env 优先级。

---

# 总结

这篇讲了 Agent 可靠性的三个问题：工具失败怎么观察，重复状态怎么早停，成本超预算怎么拦住。

Hook 分成 `dispatch` 和 `dispatchGate` 后，观测和门禁有了不同的异常语义；`GuardrailDeny` 让拒绝变成可识别的运行时信号。

`RetryTracker`、`LoopDetector`、`CostGuard` 都是有状态策略，适合放在 `hooks.yaml` 里声明式加载，不适合散在主流程的 if 判断里。

我的理解是：可靠性防“蠢”，安全性防“骗”。这一篇先把自动刹车做起来，下一步再看输入、权限和数据泄漏这些安全护栏。
