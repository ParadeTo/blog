---
title: 给 Agent 加运行时护栏：失败追踪、循环检测与成本控制
date: 2026-05-18 14:35:00
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用一个 JS demo 给 Agent 加运行时护栏：工具失败怎么记，重复状态怎么停，成本超了怎么拦。
---

# 前言

Agent 失控的时候，经常不是“坏”，而是“蠢”。

工具失败了，它可能再试一次。再试一次还失败，它可能继续试。拿到同样的结果，它也可能觉得“我再换个说法问问”。如果上下文很长、工具很贵，最后看起来只是一个普通任务，账单却悄悄涨上去了。

上一篇讲 Hook + Langfuse，解决的是“看见 Agent 每一步在做什么”。看见以后，下一个问题很自然：

**看见它在原地打转以后，谁来踩刹车？**

这篇试着给 Agent 加一层运行时护栏。失败追踪、循环检测和成本预算不塞进 prompt，而是做成 Hook 策略。主流程继续跑任务，护栏在几个节点上决定要不要继续。

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
| 工具调用前 | 工具名、工具入参 | 做权限、参数、配额这类预执行判断 |
| 工具调用后 | 工具是否成功、工具输出 | 统计失败、识别重复输出 |
| 本轮结束 | LLM 输出、token usage | 估算成本、识别重复回复 |
| 最外层 catch | 护栏拒绝原因 | 把拒绝变成可读结果 |

后面就按这条链路往下看：先把 Hook 分成观测通道和门禁通道，再看拒绝信号怎么往外抛，最后把失败追踪、循环检测和成本预算三个策略挂上去。

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

做观测时，我给 Hook 定了一个默认规则：handler 失败不能拖垮主流程。日志写失败了，最多丢一条日志；Langfuse 临时不可用，也不能让 Agent 任务直接失败。

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

这一刀切开后，Hook 就不只是旁路记录了。它开始能影响 Agent 往不往下跑。

---

# 二、GuardrailDeny：拒绝必须是一个明确信号

如果护栏只是抛一个普通 `Error`，外层很难判断它到底是工具炸了、日志炸了，还是策略主动拒绝。

demo 里单独定义了 `GuardrailDeny`：

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

这里主要用它干两件事。

一是让 `dispatchGate` 只传播这种拒绝信号。普通 handler 异常继续按观测故障处理，不影响 Agent。

二是让最外层有一个统一收口：

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

终端里就不会只剩一坨 stack trace，而是明确告诉你被哪条护栏拦了：

```text
Guardrail triggered: Budget exceeded: $0.000635 >= limit $0.000500
```

这里还有一个容易漏的细节：如果某个护栏在工具调用前触发拒绝，工具根本不会执行。那这次工具调用怎么进观测链路？

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

这算是拒绝后的事件补偿：`beforeToolCall` 已经阻止工具执行，但 `afterToolCall` 仍然会收到一条失败事件，里面带着 `guardrailDeny`、`denyReason` 和 `deniedBeforeExecution`。

这样观测链路能分清两种失败：一种是工具真的执行失败了，另一种是工具还没执行就被护栏拦住了。

我想保住的是这一点：拒绝信号不能丢，也不能被普通工具失败覆盖。

---

# 三、RetryTracker：把重试效果记下来

有了 `GuardrailDeny`，不代表工具一失败就要拦。

工具失败以后，系统有两种做法。

一种是工具层自动重试：executor 在 `catch` 里判断错误是否可重试，符合条件就再执行一次。这个 demo 没做这件事。

另一种是 Agent 自己重试：工具错误被写回上下文，下一轮 Agent 看到错误，再决定要不要调用同一个工具。这个 demo 走的是这一种，还专门放了一个 `flaky_tool` 来模拟“第一次失败，第二次恢复”。

`RetryTracker` 这个名字其实容易误会。它不是 `Retrier`，不包工具，也不重新执行工具。它只看 `after_tool_call` 事件流：

```text
fail(flaky_tool)
success(flaky_tool)
```

如果一个工具先失败、后成功，说明 Agent 自己做了一次有效重试。`RetryTracker` 把这件事记下来。

主要逻辑就这几行：

```js
afterToolHandler(ctx) {
  const toolName = ctx.toolName || 'unknown'
  const currentFailures = this.failures.get(toolName) ?? 0

  if (!ctx.success) {
    this.failures.set(toolName, currentFailures + 1)
    if (currentFailures > 0) this.repeatedFailuresAfterFirst += 1
    return
  }

  if (currentFailures > 0) {
    this.recoveriesAfterFailure += 1
    this.failures.set(toolName, 0)
  }
}
```

代码里的 `maxRetries` 也不是“最多自动重试几次”。它只是一个连续失败告警阈值：同一个工具失败次数达到阈值，就打一条 warning。

retry 场景里，第一次 `flaky_tool` 失败后，`continueOnToolError` 会把异常转成工具结果：

```json
{ "errcode": 1, "error": "flaky tool failed" }
```

这条结果进入上下文以后，Agent 下一轮再次调用 `flaky_tool`。第二次成功，`RetryTracker` 才记录一次恢复。

最后 metrics 里看这几个字段：

```json
{
  "repeated_failures_after_first": 0,
  "recoveries_after_failure": 1,
  "active_failures": {
    "flaky_tool": 0
  }
}
```

这里把指标名写得啰嗦一点，是为了少一点误会。`repeated_failures_after_first` 统计的是“第一次失败以后，又连续失败了几次”；`recoveries_after_failure` 统计的是“失败以后恢复了几次”。所以 `fail -> success` 这条链路里，恢复次数是 1，重复失败次数是 0。

有了这个数据，才知道该不该继续让 Agent 试下去。如果某个工具一直失败，几乎没有恢复记录，那就该改参数、降级，或者直接让任务失败。

`RetryTracker` 到这里就够了：它不判断任务该不该停，只把工具失败和恢复情况记成指标。

---

# 四、LoopDetector：用状态指纹检测循环

`maxIterations` 是最后的硬上限：跑到第 N 轮就停。

但有些循环不用等到第 N 轮。比如 Agent 连续几次拿到同样的工具结果，或者连续几轮输出完全一样的话术，这时候问题已经不是“还剩几轮”，而是“状态有没有变化”。

`LoopDetector` 的实现没多复杂：

1. 在固定节点取一个状态。
2. 把状态压成 hash。
3. 只保留最近 N 个 hash。
4. 如果最近 N 个 hash 完全一样，就抛 `GuardrailDeny`。

这里的 N 就是 `threshold`，默认是 3。它不是总轮数上限，而是“连续重复几次才判定循环”。

demo 里有两条检测流：工具调用后和每轮结束后

这两种检查互不影响。

对应到代码，就是两个 handler 分别写入两个窗口：

```js
afterToolHandler(ctx) {
  const output = normalizeOutput(ctx.metadata?.toolOutput ?? ctx.metadata?.output ?? '')
  const state = `${ctx.toolName || ''}:${output}`

  this.checkLoop(this.toolHashes, state, ctx)
}

afterTurnHandler(ctx) {
  const output = normalizeOutput(ctx.metadata?.output ?? '')
  const state = `${ctx.toolName || ''}:${output}`

  this.checkLoop(this.turnHashes, state, ctx)
}
```

`checkLoop` 不理解业务，只看最近几个状态指纹是不是一样：

```js
const hash = crypto.createHash('md5').update(state).digest('hex').slice(0, 16)
hashes.push(hash)

if (hashes.length > this.threshold) {
  hashes.splice(0, hashes.length - this.threshold)
}

if (hashes.length === this.threshold && hashes.every((entry) => entry === hash)) {
  throw new GuardrailDeny(
    `Loop detected: identical state repeated ${this.threshold} consecutive times`,
    { guardrail: 'loop_detector' },
  )
}
```

这里的“重复”很朴素：状态字符串一样，hash 才一样。它不做语义相似度判断，所以“我再试一次”和“我继续尝试一下”不会被当成同一个状态。

对比一下：

| 机制 | 回答的问题 |
|------|------------|
| `maxIterations` | 最多允许跑几轮 |
| `LoopDetector` | 最近几次状态指纹有没有重复 |

---

# 五、CostGuard：预算要在运行中生效

成本控制不能等账单出来再复盘。

Agent 的执行路径不稳定。同一个任务，可能两轮完成，也可能调用十几次工具。上下文越滚越长，每一轮模型调用都会更贵。

`CostGuard` 只放在每轮结束后做一件事：按 usage 累加输入和输出 token，然后检查预算。超了就抛 `GuardrailDeny`，后面不会再继续跑。

主要代码就这段：

```js
afterTurnHandler(ctx) {
  this.inputTokens += Number(ctx.inputTokens ?? 0)
  this.outputTokens += Number(ctx.outputTokens ?? 0)
  this.estimatedCost = this.calculateCost()

  this.emitCostUpdate(ctx)
  this.denyIfOverBudget(ctx)
}
```

这里没有再挂 `BEFORE_TOOL_CALL`。因为当前 demo 只能在模型返回以后拿到 usage，工具调用前并不知道“这一轮 LLM 刚花了多少钱”。与其放一个作用不明显的检查点，不如让 `CostGuard` 专心在 `AFTER_TURN` 收账和拦截。

拦截放在 `denyIfOverBudget` 里：

```js
denyIfOverBudget(ctx = {}) {
  if (this.estimatedCost < this.budget) {
    return;
  }

  this.denyCount += 1;
  const logMessage = 'Budget exceeded - blocking';
  const reason = `Budget exceeded: $${this.estimatedCost.toFixed(6)} >= limit $${this.budget.toFixed(6)}`;

  this.logger(JSON.stringify({
    level: 'CRITICAL',
    guardrail: 'cost_guard',
    message: logMessage,
    turn: ctx.turnNumber ?? ctx.turn ?? 0,
    estimated_cost_usd: roundUsd(this.estimatedCost),
    budget_usd: roundUsd(this.budget),
  }));

  throw new GuardrailDeny(reason, { guardrail: 'cost_guard' });
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

这张表只是 demo 里的估算配置，真实价格以 provider 当前计费说明为准。它不追求账单级精确，护栏层需要的是及时刹车，精确分析可以交给 Langfuse。

这里预算是运行时硬约束，不是 prompt 里的“请节省一点”。Agent 不需要理解价格表，价格表也不应该交给 Agent 自己判断。

---

# 六、把护栏策略挂到 hooks.yaml

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

主流程不用知道太多策略细节，后面加新护栏也省事。今天是成本和循环，明天可以是敏感数据、权限边界、交付门禁。

---

# 总结

这篇把 Hook 往前推了一步：不只看日志，也参与运行时决策。

`dispatch` 继续负责日志和 trace，`dispatchGate` 跑会影响执行结果的护栏策略。策略要拒绝时抛 `GuardrailDeny`，外层就能分清这是主动拦截，不是工具自己炸了。

`RetryTracker` 记录工具失败后有没有恢复，`LoopDetector` 看状态有没有前进，`CostGuard` 在运行中计算预算。放到 `hooks.yaml` 里，是为了把“哪个事件点跑哪些策略”从 Agent loop 里拿出来。

到这里，可靠性护栏先告一段落。下一步再看安全护栏：输入、权限和数据泄漏这些问题不能只靠 prompt 兜底。
