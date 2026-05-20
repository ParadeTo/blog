# 极客时间课程笔记：33｜项目实战 5：系统加固你的 XiaoPaw 本地工作助手

> 来源：<https://time.geekbang.org/course/detail/101114301-975882>
>
> 采集时间：2026-05-20
>
> 状态：基于已登录 in-app browser 中可见课程页面整理。本文是结构化摘要和写作素材，不是逐字稿。

## 基本信息

- 课程：企业级多智能体设计实战
- 讲次：33｜项目实战 5：系统加固你的 XiaoPaw 本地工作助手
- 作者：晓寒（肖汉）
- 所属模块：模块五：企业级加固，确保系统安全可控
- 页面显示时长：27:42
- 页面显示学习状态：34%
- 页面显示进度：已更新 40 讲 / 共 42 讲
- 页面显示学习人数：4597 人

## 这一讲的核心问题

这一讲是模块五的项目实战收束课：把第 30 讲的可观测性、第 31 讲的可靠性、第 32 讲的安全策略，统一接回第 22 讲的 XiaoPaw 本地工作助手。

它想回答的问题不是“再造一个新 Agent”，而是：

- 已经有业务能力和记忆能力的 Agent，如何以尽量小的侵入代价补上生产级防线？
- 可观测、可靠性、安全策略能不能通过 Hook 层统一接入，而不是散落到业务代码里？
- 当正常请求和被拦截请求发生时，系统能否同时做到“看得见、拦得下、留证据”？

本课最重要的工程判断：加固层应该通过事件分发和策略配置接入 Agent 执行链路，而不是直接改业务逻辑。

## 课程主线

### 1. 先看加固后的效果

课程先从运行效果入手。正常对话时，XiaoPaw 的每一次请求会进入 Langfuse trace。一个请求从用户输入、主 Agent 调用、工具执行、skill_loader 启动 sub-crew、sub-crew 内部的模型调用和工具调用，都能在同一棵树状 trace 里看到。

这说明第 30 讲的事件体系已经发挥作用：

- `BEFORE_LLM` 对应 generation 的创建。
- `BEFORE_TOOL_CALL` 对应工具 span 的创建。
- `SESSION_END` 对应会话末尾的收尾 span。
- 这些埋点由 `hooks.yaml` 声明的 handler 自动接入，不需要在业务执行路径里手写埋点。

攻击或越权请求被拦截时，课程强调另一个效果：失败链路也要可观测。比如路径穿越、跨用户数据访问这类请求，在工具执行前被沙箱或权限网关拦截，但 Langfuse 仍然能看到完整证据链，同时 `security_audit.jsonl` 会追加审计记录。

这一点很适合写进文章：真正的生产加固不是只让系统“挡住攻击”，还要让被挡住的请求可追踪、可复盘、可调策略。

### 2. 四课积累，一次接线

课程把模块五四节课的贡献拆开看：

| 讲次 | 能力 | 主要文件/角色 | 作用 |
| --- | --- | --- | --- |
| 30 | Hook 骨架 + 可观测性 | `hook_framework/registry.py`、`crew_adapter.py`、`loader.py`、`shared_hooks/structured_log.py`、`shared_hooks/langfuse_trace.py` | 把 CrewAI 回调翻译成统一事件，再构建 Langfuse trace 树 |
| 31 | 可靠性策略 | `cost_guard.py`、`loop_detector.py`、`retry_tracker.py` | 控制成本、检测循环、观测重试质量 |
| 32 | 安全策略 | `sandbox_guard.py`、`permission_gate.py`、`audit_logger.py` | 在工具调用前做沙箱检查、权限判断和审计记录 |
| 33 | 接线与启动 | `shared_hooks/hooks.yaml`、`xiaopaw/runner.py`、`xiaopaw/agents/main_crew.py` | 把前面三层统一挂回 XiaoPaw |

课程中的关键数字是：新增主要集中在 Hook 和 shared hooks 层，原有业务路径只做很少量适配，业务逻辑本身不改。这个数字本身不是重点，重点是它证明了第 30 讲的 Hook 架构有复用价值。

### 3. 推荐学习路线

课程建议按四站理解代码：

1. 回顾第 17 讲的基础能力：`runner.py` 接收消息，交给 `main_crew`，再通过 `skill_loader` 启动 sub-crew 执行能力。
2. 回顾第 22 讲的记忆层：Bootstrap、文件记忆、pgvector 历史检索，以及 sub-crew 如何续接上下文。
3. 启动依赖环境：沙箱、PostgreSQL、Langfuse、飞书入口等基础设施都要准备好。
4. 聚焦本课的 Hook 加固层：重点看 `hook_framework/registry.py`、`shared_hooks/hooks.yaml`、`shared_hooks/langfuse_trace.py`。

这条路线也能作为文章的阅读建议：不要从所有 handler 细节开始，而是先确认消息如何进入 XiaoPaw、上下文如何流动，再看 Hook 如何拦截和记录。

## HookRegistry 的两套机制

本课的核心架构是 `HookRegistry`。它把 Agent 框架的回调翻译成统一事件，再把事件交给 handler。

它有两种分发模式：

| 模式 | 定位 | 异常处理 | 适合场景 |
| --- | --- | --- | --- |
| `dispatch()` | 报警器 | handler 异常只记录，不阻断业务 | 结构化日志、Langfuse 追踪等观测能力 |
| `dispatch_gate()` | 保险丝 | `GuardrailDeny` 可以向上传播并中断执行 | 沙箱、权限、成本、循环检测等策略能力 |

这里的设计分界很关键：

- 观测系统坏了，业务不应该直接不可用。
- 安全策略坏了，系统应该默认更保守。
- 因此观测 handler 和策略 handler 不能混在一个语义里。

课程还提到 `HookContext` 是只读上下文。handler 只能读取事件信息，不能篡改工具输入和 metadata。这能避免一个 handler 修改数据后影响后续 handler 的判断。

## hooks.yaml 的两段式结构

`hooks.yaml` 里分成两段：

- `hooks`：纯观测，走 `dispatch()`。
- `strategies`：策略能力，走 `dispatch_gate()`。

观测段里主要是结构化日志和 Langfuse 追踪。策略段里是沙箱、权限网关、成本守卫、循环检测等会影响执行结果的能力。

文章可以把这个设计抽象成一句话：能不能阻断业务，是 Hook 配置最重要的分类标准。

## 执行顺序的三条约束

课程花了较多篇幅讲执行顺序，因为 Hook 系统的稳定性不只取决于有哪些 handler，还取决于它们按什么顺序执行。

### 约束一：观测必须先于策略

如果策略 handler 先执行并触发 deny，后面的 handler 就不会再跑。这样最危险的请求反而没有观测记录。

所以加载器要保证 `hooks` 段整体先于 `strategies` 段注册。这样即使后面的沙箱或权限网关拦截了请求，前面的 Langfuse 记录也已经写下来了。

### 约束二：audit_logger 必须先实例化

`sandbox_guard` 和 `permission_gate` 都依赖同一个 `audit_logger` 实例。如果 `audit_logger` 排在后面，依赖注入会拿不到实例，后续审计调用可能出错。

更麻烦的是，安全组件通常是 fail-closed。一旦组件内部错误被当成安全失败处理，系统会把大量正常请求也拦住。所以 `audit_logger` 的位置不是风格问题，而是系统可用性问题。

### 约束三：cost_guard 要先于 loop_detector 算账

循环检测可能在 `AFTER_TURN` 阶段触发 deny。如果 `loop_detector` 先执行，`cost_guard` 可能来不及把这一轮成本记进去。

而循环场景往往正是高成本场景。如果账没记下来，预算守卫会低估实际消耗。课程的做法是让 `cost_guard` 先结算，再由 `loop_detector` 判断是否中断。

## Langfuse Trace 树的五个机制

这一讲后半段重点解释：零散 Hook 事件如何组成 Langfuse 里的一棵树。

### 1. 多轮对话共用同一条 trace

课程用 `session_id` 作为 trace id，而不是每轮随机生成。这样同一个会话的多轮请求会归入同一条 trace 时间线，便于观察完整上下文演进。

### 2. sub-crew 挂到父 span 下面

主 Agent 调用 skill 时，skill 内部可能启动 sub-crew，且 sub-crew 运行在子线程里。课程通过 `ContextVar` 和上下文复制，把父级 trace 信息传到子线程，让 sub-crew 的模型调用自动挂到父 skill span 下。

这解决了一个很实际的问题：如果 sub-crew 自己新开一条 trace，调试时就很难看出它和主 Agent 的关系。

### 3. span 栈维护嵌套关系

工具调用可能嵌套。课程用一个栈保存当前打开的 span。新工具调用压栈，工具结束后按匹配关系弹栈，天然支持后进先出的嵌套结构。

这里的工程启发是：trace 树不是只靠事件名拼出来的，还需要运行时保存父子关系。

### 4. Generation 先创建后补结束信息

系统有 `BEFORE_LLM`，但没有完全对称的 `AFTER_LLM`。课程采用“先创建，后更新”的方式：在下一次 LLM 调用或回合结束时，补齐上一段 generation 的结束时间和结果信息。

这属于典型的适配层工程：底层框架不给完整生命周期事件时，可以用相邻事件补齐状态。

### 5. 强制 flush 保证可见性

Langfuse SDK 会把事件暂存在 buffer 里批量发送。课程在回合结束时强制 flush，并且让 flush 发生在用户收到回复之前。这样用户刚看到 XiaoPaw 回复，就能在 Langfuse 里看到完整 trace。

这点很容易被忽略，但对调试体验很关键：可观测性不能只“最终一致”，还要在开发和排障场景下足够及时。

## 和前几讲的关系

模块五四节课可以串成一条生产加固链：

- 第 30 讲：看得见。用 Hook 事件体系和 Langfuse 追踪把 Agent 执行过程展开。
- 第 31 讲：控得住。用成本、循环、重试策略限制失控行为。
- 第 32 讲：拦得下。用沙箱、权限网关、审计日志挡住高风险工具调用。
- 第 33 讲：装上去。把这些能力接入真实 XiaoPaw，而不是停留在独立 demo。

如果写文章，可以把第 33 讲定位成“工程篇验收课”：前面讲的是单项能力，这一讲验证这些能力能不能合在一起服务一个真实助手。

## 可用于文章的主线

文章可以这样展开：

1. XiaoPaw 之前已经有工具和记忆，但还缺生产环境需要的护栏。
2. 生产加固最好不要散落在业务代码里，而应集中在事件和策略层。
3. HookRegistry 把框架回调变成统一事件，`dispatch` 负责观测，`dispatch_gate` 负责阻断。
4. `hooks.yaml` 是加固层的装配图：哪些 handler 只记录，哪些策略能拦截，顺序如何安排。
5. 顺序本身是架构的一部分：先观测再拦截，先注入审计依赖，先算成本再检测循环。
6. Trace 树的难点不在“调用 Langfuse API”，而在多轮会话、sub-crew、嵌套工具、LLM generation 生命周期和 flush 时机。
7. 这套设计的价值在于：业务逻辑基本不动，系统能力却从“能跑”升级到“能观察、能控制、能审计”。

## 写作素材

- “业务代码 0 改动”不是噱头，背后是 Hook 分层和事件语义设计。
- 观测层不能成为业务单点故障，所以要 fail-open。
- 安全层不能在异常时静默放行，所以关键策略要 fail-closed。
- 被拦截的请求比正常请求更需要 trace，因为它们是调策略、查攻击、复盘事故的证据。
- `hooks.yaml` 不是普通配置，而是生产加固层的装配图。
- Trace 树的质量取决于父子关系、线程上下文、span 栈和 flush 时机。
- 真正可上线的 Agent，不只是能调用工具，还要能解释每次工具调用为什么发生、为什么被允许或拒绝。

## 对后续本地文章的建议

- 不要把文章写成“Langfuse 使用教程”。重点应放在 Hook 分层和工程装配。
- 代码展示可以围绕 `dispatch` / `dispatch_gate`、`hooks.yaml` 顺序、trace 父子关系三处展开。
- 可以少贴大段业务代码，多画一张“事件进入 HookRegistry 后如何分流”的图。
- 如果要联系前文，第 32 讲负责解释“为什么要安全边界”，第 33 讲负责解释“这些边界如何装进真实系统”。
- 文章结尾可以回到生产化判断：Agent 工程从 demo 到产品，差别往往不在模型调用，而在可观测、可靠性、安全和审计这些看似外围的系统能力。

