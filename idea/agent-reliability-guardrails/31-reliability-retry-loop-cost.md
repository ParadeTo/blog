# 31｜可靠性：重试、循环控制与成本围栏

> 采集说明：已使用 Codex in-app Browser 在登录态下阅读课程页，并结合本地 `m5l31` 代码整理。这里保存的是消化后的写作素材和代码阅读笔记，不保存课程原文全文。

## 来源

- 极客时间：<https://time.geekbang.org/course/detail/101114301-973359>
- 课程：企业级多智能体设计实战
- 讲次：31｜可靠性：重试、循环控制与成本围栏
- 所属模块：模块五，企业级加固，确保系统安全可控
- 课程代码：<https://github.com/kid0317/crewai_mas_demo/tree/main/m5l31>
- 本地代码：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31`
- 采集时间：2026-05-15

## 一句话理解

第 30 课的 Hook + Langfuse 解决“看见 Agent 在做什么”，第 31 课把 Hook 升级成可靠性控制点：在关键事件上挂策略，让系统在失败、循环和超预算时自动拦截。

换句话说，可靠性不是让 Agent 更听话，而是在 Agent 外层加一套可以执行的运行时护栏。

## 课程主线

这节课的结构很清楚：

1. 从三个生产事故类型出发：单步失败拖垮长任务、无限循环烧钱、成本失控。
2. 对应提出三个通用护栏：重试追踪、循环检测、成本围栏。
3. 在 Hook 框架里引入可拦截分发：普通观测继续吞异常，护栏拒绝需要向上传播。
4. 解决 CrewAI 回调吞异常的问题：用 `pending_deny` 暂存拒绝信号，再在更可靠的回调里抛出。
5. 用 `hooks.yaml` 的 `strategies` 段声明式加载有状态策略。
6. 最后用避坑指南说明：Prompt 约束不等于工程护栏，`max_iter` 也不等于循环检测。

## 三个生产痛点

### 1. 长任务被单步失败拖垮

Agent 的长任务可能包含很多轮 LLM 推理和工具调用。只要其中某一步遇到一次瞬态错误，比如外部 API 短暂 500，整个任务就可能失败。

这里的关键不是“失败会不会发生”，而是长链路会放大偶发失败。一个工具 99% 可用，调用 100 次后整体成功率就会明显下降。

对应策略：重试。但重试不是无脑再来一次，它要回答“这个错误值不值得再试”。

### 2. Agent 陷入循环

Agent 失败时不一定会停下来，它可能反复用同样参数调用同一个工具，得到同样结果后继续尝试。`max_iter` 能兜底，但它往往太晚才触发。

这里的问题是：Agent 自己不一定知道“我已经试过这个状态”。如果没有状态去重，它可能把同一个坑踩很多遍。

对应策略：循环检测。用状态指纹更早发现原地打转。

### 3. Agent 真的在推进，但成本不可接受

有些任务没有失败，也没有循环，但执行路径太贵：过多上下文、过深搜索、过强模型、过多工具调用，最后账单爆掉。

Agent 路径天然不确定，同一个任务可能 3 步完成，也可能 30 步还没结束。只靠提示词要求它节省成本是不可靠的，因为它并不知道每一步真实成本。

对应策略：成本围栏。预算必须成为运行时硬约束，而不是事后账单。

## 策略一：重试追踪

课程强调的是：Agent 场景里，难点不是“怎么重试”，而是“什么时候该重试”。

可重试的通常是瞬态问题，比如临时网络错误、服务端短暂异常、限流后可恢复等。不可重试的通常是永久问题，比如鉴权失败、参数错误、资源不存在、业务规则不满足。

重试还有一个 Agent 特有的隐性成本：失败信息会进入上下文。重试次数越多，错误日志、异常栈、无效观察越多，后续推理质量可能被污染。所以默认阈值不宜太高，通常 2-3 次更合理。

本地代码里 `RetryTracker` 是观测型策略，不负责真正发起重试：

- 文件：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/shared_hooks/retry_tracker.py`
- 挂载事件：`AFTER_TOOL_CALL`
- 记录内容：每个工具的连续失败次数、总重试次数、重试后成功次数、成功率。
- 触发行为：连续失败达到阈值后输出 warning，不直接 `deny`。

这个设计比较克制：先把失败模式记录清楚，再决定是否要把某些失败升级成硬拦截。

## 策略二：循环检测

循环检测的核心是“状态去重”。本地代码里的 `LoopDetector` 会从两个路径采集状态：

- `AFTER_TOOL_CALL`：覆盖工具调用路径，用 `tool_name + tool_output` 做状态。
- `AFTER_TURN`：覆盖每轮推理后的状态，用 `tool_name + output` 做状态。

它会把状态做哈希，保留最近若干次结果。如果连续 N 次哈希完全相同，就认为 Agent 在原地打转，然后抛出 `GuardrailDeny`。

本地代码：

- 文件：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/shared_hooks/loop_detector.py`
- 默认阈值：`threshold: 3`
- 哈希输入：工具名 + 截断后的输出片段。
- 拦截结果：重复达到阈值后终止当前任务。

这和 `max_iter` 的定位不同：

- `max_iter` 是最后防线，只限制最多跑多少步。
- 状态哈希检测是早期发现，关注“这些步是不是在重复”。

文章里可以用一个类比：`max_iter` 像行驶里程上限，哈希去重像发现车一直绕同一个环岛。

需要注意的是，哈希策略要根据业务调参。输出截断太短，可能误判；状态拼得太细，又可能漏掉语义重复。生产里可以先只记录，再观察一周数据后决定阈值。

## 策略三：成本围栏

成本围栏的关键是把预算控制放在代码层，而不是交给 Agent 自觉。

本地代码里的 `CostGuard` 做了两件事：

- 在 `AFTER_TURN` 里累加本轮输入/输出 token，估算累计成本。
- 在 `BEFORE_TOOL_CALL` 里检查预算，如果已经超限，就阻止后续工具调用。

本地代码：

- 文件：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/shared_hooks/cost_guard.py`
- 模型价格表：内置 `qwen-plus`、`qwen-turbo`、`qwen-max`、`gpt-4o`、`gpt-4o-mini` 的粗略单价。
- 默认预算：`budget_usd: 1.0`
- 可用环境变量覆盖：`COST_GUARD_BUDGET`
- 拦截方式：超过预算时抛 `GuardrailDeny`。

这里有一个很实用的工程判断：护栏层只需要“足够快、足够保守”的成本估算，不一定要做到账单级精确。精确计费可以交给 Langfuse，运行时门禁只要能及时刹车。

## Hook 工程落地

### `dispatch` 与 `dispatch_gate`

在 `HookRegistry` 里有两条分发路径：

- `dispatch()`：用于观测型 hook。handler 异常会被捕获并记录，不影响主流程。
- `dispatch_gate()`：用于护栏型 hook。普通异常仍然隔离，但 `GuardrailDeny` 会继续向上传播。

本地代码：

- 文件：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/hook_framework/registry.py`
- 新增类型：`GuardrailDeny`
- 新增方法：`dispatch_gate`

这个区分很重要。日志 hook 出错不应该拖垮业务，但护栏拒绝不能被吞掉，否则可靠性策略只剩“打日志”的价值。

### `pending_deny`

课程里一个很值得写的细节是 `pending_deny`。

CrewAI 的某些工具回调会吞异常。如果直接在 `before_tool_call` 里抛出护栏拒绝，信号可能传不到外层。代码的处理方式是：

1. 在工具前置或后置回调里捕获 `GuardrailDeny`。
2. 把拒绝对象暂存在 adapter 上。
3. 当前工具调用返回阻止信号，或继续到更稳定的回调。
4. 在 `step_callback` 里重新抛出暂存的拒绝。

本地代码：

- 文件：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/hook_framework/crew_adapter.py`
- 字段：`_pending_deny`
- 触发点：`BEFORE_TOOL_CALL`、`AFTER_TOOL_CALL`、`AFTER_TURN`

这说明可靠性设计不只是策略本身，还要理解底层框架的异常传播边界。

### `strategies` 声明式注册

30 课的 hook 多是无状态函数，31 课的可靠性策略需要保存状态，比如累计成本、连续失败次数、最近状态哈希。因此 `hooks.yaml` 里新增了 `strategies` 段。

本地配置：

- 文件：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/shared_hooks/hooks.yaml`
- `RetryTracker` 挂到 `AFTER_TOOL_CALL`
- `CostGuard` 挂到 `AFTER_TURN` 和 `BEFORE_TOOL_CALL`
- `LoopDetector` 挂到 `AFTER_TOOL_CALL` 和 `AFTER_TURN`

`HookLoader` 会根据类名和 config 实例化策略对象，然后把对象方法注册到对应事件上。这样同一个 `CostGuard` 实例的成本状态可以在多个事件之间共享。

顺序也很关键：课程和代码都强调 `cost_guard` 要放在 `loop_detector` 前面。原因是即使后面判断出循环，已经发生的成本也应该先被记录下来。

## 端到端演示路径

本地 demo 文件：

`/Users/youxingzhi/ayou/crewai_mas_demo/m5l31/demo.py`

执行链路：

1. 初始化 `HookRegistry`。
2. 用 `HookLoader.load_two_layers()` 加载全局 hooks 和 workspace hooks。
3. 安装 CrewAI adapter，把 CrewAI 生命周期映射到统一事件。
4. 构建 Agent、Task、SkillLoader 和 Sub-Crew。
5. 执行任务时，观测 hooks 与可靠性 strategies 共享同一套事件管道。
6. 如果策略抛出 `GuardrailDeny`，demo 捕获后输出触发原因。
7. 最后打印 Langfuse 地址、产物路径、审计日志和各策略 metrics。

运行方式：

```bash
cd /Users/youxingzhi/ayou/crewai_mas_demo/m5l31
python3 demo.py
python3 demo.py "为一个短链接服务产出技术设计文档"
COST_GUARD_BUDGET=0.001 python3 demo.py
```

## 避坑与最佳实践

### 反模式

- 只靠 Prompt 控制成本：Agent 会答应，但它没有可靠的实时账本。
- 只设 `max_iter`：它能限制总步数，但不能早发现重复状态。
- 所有错误都重试：永久错误会被重复消费 token，还会污染上下文。
- 只按请求数限流：一次请求可能很便宜，也可能携带大量上下文。
- 护栏策略吞异常：看起来有策略，实际上没有拦截能力。

### 更好的做法

- 先做观测，再用数据调阈值。
- 重试前确认工具幂等，避免重复写入、重复扣款、重复发消息。
- 成本围栏用粗估即可，精确账单交给 Langfuse。
- 循环检测和 `max_iter` 同时保留，一个早停，一个兜底。
- 把业务护栏写成策略类，不要散落在 Agent prompt 或主流程 if 里。

## 和 `demo/xiaoquan` 的关系

这节课对当前博客项目里的 `demo/xiaoquan` 很有启发。

`xiaoquan` 里已经有团队角色、Skill、QA、交付门禁等机制。后续可以把这些业务规则从主流程判断里抽出来，变成 Hook 策略：

- QA 没跑完或失败：在交付前触发 `DeliveryGateDeny`。
- xfailed 测试被误当通过：在验收事件里强制拦截。
- RD 重复提交同一种失败修复：用状态哈希识别无效循环。
- 任务耗时过久或 LLM 调用过多：挂成本/步数围栏。
- 飞书消息里含敏感数据：在工具调用前做数据泄漏检测。

这和之前讨论的方向是一致的：不要把所有业务判断塞进 `xiaoquan` 的主流程，而是让 Skill 和 Hook 策略承担业务规则。

## 后续文章角度

可以发展的题目：

- `让 Agent 学会自动刹车：重试、循环控制与成本围栏`
- `可观测性之后：把 Hook 从日志系统升级成控制系统`
- `Agent 可靠性不是 Prompt，而是一套运行时护栏`

建议文章主线：

1. 用一个真实痛点开场：Agent 很努力，但不知道什么时候该停。
2. 回顾 Hook + Langfuse：看见问题只是第一步。
3. 拆三个失控场景：失败、循环、成本。
4. 讲三类策略：RetryTracker、LoopDetector、CostGuard。
5. 进入工程实现：`dispatch_gate`、`pending_deny`、`strategies`。
6. 结合 `xiaoquan` 写自己的实践：把门禁、验收、预算都放进 Hook 策略。
7. 结尾引到下一篇安全性：可靠性防“蠢”，安全性防“骗”。

## 可以写进文章的观点

- Agent 系统的可靠性不应该依赖 Agent 自觉。
- Hook 的价值不只是打日志，还可以变成运行时控制面。
- 可靠性策略要有状态，因为很多风险只有跨步骤观察才看得出来。
- `max_iter` 是兜底，不是循环检测。
- 成本控制应该在执行中发生，而不是账单出来之后复盘。
- 业务护栏应该策略化、声明式、可测试，而不是散落在主流程。

## 写作注意

- 不照抄极客时间原文，以代码阅读和自己的工程理解为主。
- 可以引用少量短句，但不要复制课程长段落。
- 如果要画图，建议画“CrewAI 回调 → HookRegistry → 普通 hooks / guardrail strategies → deny”的流程图。
- 如果写正式博客，按仓库规则使用 `write-tech-article` skill。
