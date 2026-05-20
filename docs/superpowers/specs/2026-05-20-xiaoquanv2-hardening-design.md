# xiaoquanv2 Hook 加固设计

日期：2026-05-20

## 背景

`demo/xiaoquan` 已经有一套 JS 版小圈基础能力：消息进入 `Runner`，单助手通过 `agent/react-loop.js` 调用 AI SDK，必要时加载 Skill、执行沙箱代码、保存会话和记忆。

这次要做的是新建 `demo/xiaoquanv2`，把 Python 版 `/Users/youxingzhi/ayou/xiaopaw-v2` 里的 Hook 加固思路翻译成 JS 版。目标不是做数字团队，不实现 `manager / pm / rd / qa`、`team:` 路由、mailbox 或团队协作协议。

`xiaoquanv2` 是单助手加固版：保留接消息、调 Skill、跑沙箱、保存记忆这些基础链路，在它们外面补上可观测、可靠性、安全和审计护栏。

## 目标

1. 新建 `demo/xiaoquanv2`，不要破坏现有 `demo/xiaoquan`。
2. 复制并裁剪现有单助手链路，只保留 `Runner`、`react-loop`、Skill、沙箱、记忆、会话、Test API 和飞书入口。
3. 新增 Hook 框架，对齐 Python 版 `HookRegistry` 的两套语义：
   - `dispatch()`：观测层，handler 失败不影响主流程。
   - `dispatchGate()`：策略层，`GuardrailDeny` 能阻断执行。
4. 接入本地 Langfuse。通过 Podman Compose 在本机启动 Langfuse，`langfuse-trace` handler 把每次会话写成 trace 树。
5. 做到 Python `xiaopaw-v2` 加固层的功能等价：结构化日志、Langfuse trace、审计日志、沙箱守卫、权限网关、成本守卫、循环检测、重试观测都要有 JS 对应实现。
6. 支持 sub-agent trace 继承。主 Agent 通过 SkillLoader 或轻量 sub-agent 执行任务时，子 Agent 的 LLM 和工具 span 要挂到父级 tool span 下面。
7. 用测试覆盖 Hook、策略层、Langfuse trace 和 sub-agent 继承，再写实现。

## 非目标

1. 不做数字团队。
2. 不接第 29 讲的团队 mailbox、角色 workspace 和 watcher。
3. 不逐行翻译 Python 代码。
4. 不实现复杂的用户身份透传和企业级 Secret Manager。

## 参考文件

Python 版：

- `/Users/youxingzhi/ayou/xiaopaw-v2/xiaopaw/hook_framework/registry.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/xiaopaw/hook_framework/loader.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/xiaopaw/hook_framework/crew_adapter.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/hooks.yaml`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/langfuse_trace.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/sandbox_guard.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/permission_gate.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/audit_logger.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/cost_guard.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/loop_detector.py`
- `/Users/youxingzhi/ayou/xiaopaw-v2/shared_hooks/retry_tracker.py`

JS 基线：

- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/runner.js`
- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/agent/react-loop.js`
- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/agent/skill-tools.js`
- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/sandbox/podman-sandbox.js`
- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/memory/*`
- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/session/*`
- `/Users/youxingzhi/ayou/blog/demo/xiaoquan/src/api/test-api.js`

## 目录结构

```text
demo/xiaoquanv2/
├── infra/
│   ├── langfuse-podman-compose.yaml
│   └── README.md
├── src/
│   ├── hook-framework/
│   │   ├── registry.js
│   │   ├── loader.js
│   │   ├── adapter.js
│   │   └── trace-context.js
│   ├── shared-hooks/
│   │   ├── hooks.yaml
│   │   ├── structured-log.js
│   │   ├── langfuse-trace.js
│   │   ├── audit-logger.js
│   │   ├── sandbox-guard.js
│   │   ├── permission-gate.js
│   │   ├── cost-guard.js
│   │   ├── loop-detector.js
│   │   └── retry-tracker.js
│   ├── agent/
│   │   ├── react-loop.js
│   │   └── skill-tools.js
│   ├── api/
│   ├── feishu/
│   ├── memory/
│   ├── sandbox/
│   ├── session/
│   ├── config.js
│   ├── index.js
│   └── runner.js
├── tests/
│   ├── hook-registry.test.js
│   ├── sandbox-guard.test.js
│   ├── permission-gate.test.js
│   ├── hook-chain.test.js
│   ├── langfuse-trace.test.js
│   ├── sub-agent-trace.test.js
│   ├── retry-tracker.test.js
│   └── runner-hardening.test.js
├── config.yaml.template
├── package.json
└── Dockerfile.sandbox
```

## Hook 框架

### EventType

JS 版完整保留 Python 版 5+2 事件。`TASK_COMPLETE` 也要实现，用来标记 demo 任务完成、收口最终输出和 trace 状态：

- `BEFORE_TURN`
- `BEFORE_LLM`
- `BEFORE_TOOL_CALL`
- `AFTER_TOOL_CALL`
- `AFTER_TURN`
- `TASK_COMPLETE`
- `SESSION_END`

### HookContext

`HookContext` 是普通对象，但构造时复制并冻结关键字段：

- `eventType`
- `timestamp`
- `agentId`
- `taskName`
- `toolName`
- `toolInput`
- `inputTokens`
- `outputTokens`
- `durationMs`
- `success`
- `sessionId`
- `turnNumber`
- `senderId`
- `metadata`

`toolInput` 和 `metadata` 使用浅复制后 `Object.freeze()`，避免 handler 改脏后续策略看到的数据。

### GuardrailDeny

`GuardrailDeny` 是 `Error` 子类，包含：

- `reasonCode`
- `detail`

常用原因：

- `budget_exceeded`
- `loop_detected`
- `sandbox_violation`
- `permission_denied`
- `prompt_injection`

### HookRegistry

`dispatch(eventType, ctx)` 用于观测层。普通异常被 catch，只写日志，不影响主流程。

`dispatchGate(eventType, ctx)` 用于策略层。遇到 `GuardrailDeny` 立即抛出，阻断后续 handler 和真实业务动作。带 `failClosed` 的 handler 如果自己抛普通异常，也转成 `GuardrailDeny`。

## HookLoader

`loader.js` 读取 `src/shared-hooks/hooks.yaml`。

加载顺序必须固定：

1. 先加载 `hooks` 段。
2. 再加载 `strategies` 段。

这个顺序不能交给约定。危险请求被 sandbox 拦截前，Langfuse 和 structured log 必须已经拿到 `BEFORE_TOOL_CALL` 事件。

`strategies` 是有序列表。`audit-logger` 要排在 `sandbox-guard` 和 `permission-gate` 前面，这样后两者可以通过 `deps` 拿到同一个审计实例。

## hooks.yaml

```yaml
hooks:
  BEFORE_TURN:
    - handler: structured-log.beforeTurnHandler
    - handler: langfuse-trace.beforeTurnHandler
  BEFORE_LLM:
    - handler: structured-log.beforeLlmHandler
    - handler: langfuse-trace.beforeLlmHandler
  BEFORE_TOOL_CALL:
    - handler: structured-log.beforeToolHandler
    - handler: langfuse-trace.beforeToolHandler
  AFTER_TOOL_CALL:
    - handler: structured-log.afterToolHandler
    - handler: langfuse-trace.afterToolHandler
  AFTER_TURN:
    - handler: structured-log.afterTurnHandler
    - handler: langfuse-trace.afterTurnHandler
  TASK_COMPLETE:
    - handler: structured-log.taskCompleteHandler
    - handler: langfuse-trace.taskCompleteHandler
  SESSION_END:
    - handler: structured-log.sessionEndHandler
    - handler: langfuse-trace.flushAndClose

strategies:
  - name: audit-logger
    class: audit-logger.SecurityAuditLogger
    config: {}
    hooks:
      SESSION_END: sessionEndHandler

  - name: sandbox-guard
    class: sandbox-guard.SandboxGuard
    deps:
      audit: audit-logger
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler

  - name: permission-gate
    class: permission-gate.PermissionGate
    deps:
      audit: audit-logger
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler

  - name: cost-guard
    class: cost-guard.CostGuard
    config:
      budgetUsd: 1.0
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
      AFTER_TURN: afterTurnHandler

  - name: loop-detector
    class: loop-detector.LoopDetector
    config:
      threshold: 3
    hooks:
      AFTER_TOOL_CALL: afterToolHandler
      AFTER_TURN: afterTurnHandler

  - name: retry-tracker
    class: retry-tracker.RetryTracker
    config:
      maxRetries: 3
    hooks:
      AFTER_TOOL_CALL: afterToolHandler
      AFTER_TURN: afterTurnHandler
```

`sandbox-guard` 和 `permission-gate` 使用 `failClosed`。Langfuse 和 structured log 不使用 `failClosed`。

## Adapter 和执行链路

JS 版不用照搬 Python 的 `CrewObservabilityAdapter` 和 pending deny。AI SDK 的工具执行可以用 wrapper 包住。

`Runner._handle()`：

```text
adapter.beforeTurn(userContent)
adapter.preflightUserInput(userContent)
runAgent(...)
adapter.afterTurn(usage, reply)
adapter.cleanup()
```

`runAgent()`：

```text
before LLM:
  adapter.beforeLlm({ messages, model })

tool wrapper:
  adapter.beforeToolCall(toolName, args)
  result = realTool.execute(args)
  adapter.afterToolCall(toolName, args, result)

task complete:
  adapter.taskComplete({ reply, usage, status })

final:
  return reply
```

如果 `beforeToolCall` 抛 `GuardrailDeny`：

1. wrapper 或 Runner 捕获异常。
2. 触发 `AFTER_TOOL_CALL`，metadata 标记 `guardrailDeny=true`。
3. Runner 回复用户：`安全策略拦截：${reasonCode}`。
4. `audit-logger` 写 JSONL。
5. `langfuse-trace` 把对应 span 标为 error。

## Langfuse 本地部署

本地用 Podman Compose。

`infra/langfuse-podman-compose.yaml` 负责启动 Langfuse 所需服务。优先使用 Langfuse 官方 compose 的简化本地版本，端口固定：

- Langfuse UI：`http://localhost:3000`

`infra/README.md` 写清楚流程：

```bash
cd demo/xiaoquanv2/infra
podman compose -f langfuse-podman-compose.yaml up -d
```

第一次启动后，在 Langfuse UI 创建 project，拿到 key：

```bash
export TRACE_TO_LANGFUSE=true
export LANGFUSE_BASE_URL=http://localhost:3000
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
```

也支持 `XIAOQUAN_LANGFUSE_*` 前缀，优先级高于通用 `LANGFUSE_*`：

- `XIAOQUAN_LANGFUSE_BASE_URL`
- `XIAOQUAN_LANGFUSE_PUBLIC_KEY`
- `XIAOQUAN_LANGFUSE_SECRET_KEY`

Langfuse 初始化失败时只写 warning，不阻断主流程。

## Langfuse Trace 树

目标树：

```text
Trace: sessionId
└── session-{sessionId}
    └── agent_execution
        ├── llm-call-1
        │   └── tool-list_skills
        ├── llm-call-2
        │   └── tool-run_skill_or_sub_agent
        │       └── sub-agent
        │           ├── llm-call-3
        │           └── tool-execute_code
        └── final_answer
```

实现机制：

1. `traceId = sessionId`，多轮对话进入同一条 trace。
2. `beforeTurn` 创建或更新 trace 和 root span。
3. `preflightUserInput` 创建 `tool-agent_execution` span。
4. `beforeLlm` 创建 generation。
5. `beforeTool` 创建 tool span，并把 span id 压栈。
6. `afterTool` 弹栈并更新 output、duration、level。
7. `taskComplete` 标记任务完成，记录最终 reply、usage 和 status。
8. `afterTurn` 关闭最后一个 generation 和 agent span，更新 trace output。
9. `SESSION_END` 强制 flush。

被拦截请求也要可见：

```text
Trace: sessionId
└── session-{sessionId}
    └── tool-agent_execution / tool-read_file
        metadata.guardrail_deny = true
        level = ERROR
```

## Sub-Agent Trace 继承

虽然 `xiaoquanv2` 不做数字团队，但 Python 版已经处理了子任务 trace 继承，JS 版也要有等价能力。

JS 版用 `AsyncLocalStorage` 做 `trace-context.js`：

- `runWithTraceContext(ctx, fn)`：进入一段 Agent 或工具执行时绑定当前 trace、session、parent span。
- `getTraceContext()`：Langfuse handler 读取当前父级 span。
- `withChildSpan(parentSpanId, fn)`：SkillLoader 或轻量 sub-agent 执行时，把子 Agent 的 LLM/tool span 挂到父级 tool span 下。

这个能力先服务两个场景：

1. Skill 执行内部又触发模型调用时，trace 不新开一棵树。
2. 轻量 sub-agent demo 执行时，子 Agent 继承父级 trace context，而不是另起 trace。

## Shared Hooks

### structured-log

每个事件输出一行 JSON 到 stderr。它是 Langfuse 的降级方案。

### langfuse-trace

把 Hook 事件翻译成 Langfuse trace、generation、span。内部维护：

- 当前 trace id
- root span id
- 当前 generation id
- tool span stack
- batch buffer

flush 在 `AFTER_TURN` 或 `SESSION_END` 发生。

### audit-logger

写 append-only JSONL，默认路径：

`data/security_audit.jsonl`

记录 sandbox violation、permission deny、session summary。

### sandbox-guard

检测：

- 路径穿越：`../`、`..\\`
- URL 编码路径穿越：`%2e%2e%2f`
- 危险命令：`rm -rf`、`sudo`、`chmod 777`、`curl | sh`、`eval(`、`exec(`
- shell 注入：`;`、`|`、`&&`、反引号、`$(...)`
- prompt injection：`[SYSTEM]`、`ignore previous instructions`、`忽略以上指令`

输入先做 Unicode NFKC 归一化和最多三轮 URL decode。

### permission-gate

权限策略先按 tool name 判断：

- `allow`
- `warn`
- `deny`

默认建议 `warn`。显式 deny 直接抛 `GuardrailDeny`。

### cost-guard

基于 AI SDK usage 统计 input/output token。价格使用配置化估算值，够做预算围栏。

在 `AFTER_TURN` 算账，在 `BEFORE_TOOL_CALL` 再检查一次预算。

### loop-detector

对工具 output 和最终 reply 做 hash。连续 `threshold` 次相同则抛 `GuardrailDeny`。

### retry-tracker

记录同一轮内工具失败、重试次数和最终状态。达到 `maxRetries` 时抛 `GuardrailDeny`，并把 retry 信息写入 audit 和 Langfuse metadata。

## 配置

`config.yaml.template` 新增：

```yaml
hooks:
  enabled: true
  dir: "./src/shared-hooks"
  fail_closed:
    - sandbox-guard
    - permission-gate

security:
  audit_file: "./data/security_audit.jsonl"
  permissions:
    default: warn
    tools:
      read_file: warn
      write_file: warn
      execute_code: warn
      run_script: warn
      list_skills: allow
      get_skill: allow

observability:
  trace_to_langfuse: true
  langfuse_base_url: "http://localhost:3000"

retry:
  max_retries: 3
```

环境变量优先于 config：

- `TRACE_TO_LANGFUSE`
- `XIAOQUAN_LANGFUSE_BASE_URL`
- `XIAOQUAN_LANGFUSE_PUBLIC_KEY`
- `XIAOQUAN_LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

## 测试策略

先测试，再实现。

### 单元测试

`hook-registry.test.js`

- `dispatch` 吞掉普通异常，后续 handler 仍执行。
- `dispatchGate` 遇到 `GuardrailDeny` 会抛出。
- `failClosed` handler 抛普通异常会转成 `GuardrailDeny`。

`sandbox-guard.test.js`

- 拦截 `../../etc/passwd`。
- 拦截 `%2e%2e%2fetc%2fpasswd`。
- 拦截 `rm -rf /`。
- 拦截 `忽略以上指令`。
- 普通自然语言路径不误杀。

`permission-gate.test.js`

- allow 放行。
- warn 放行并记录。
- deny 阻断。
- default warn 生效。

`langfuse-trace.test.js`

- 使用 fake Langfuse client，不依赖真实容器。
- 验证 `beforeTurn -> beforeLlm -> beforeTool -> afterTool -> taskComplete -> afterTurn` 生成 trace、generation、span 事件。
- 验证 deny span level 为 error。
- 验证 flush 调用 batch。

`sub-agent-trace.test.js`

- 验证 `AsyncLocalStorage` 能把 trace id 和 parent span 传给子 Agent。
- 验证子 Agent 的 LLM/tool span 挂在父级 tool span 下。
- 验证并发两轮 session 不串 trace context。

`retry-tracker.test.js`

- 工具失败后记录 retry 次数。
- 达到 `maxRetries` 后抛 `GuardrailDeny`。
- retry metadata 同时进入 audit 和 Langfuse span。

### 集成测试

`hook-chain.test.js`

- 观测 handler 先于策略 handler。
- sandbox deny 后 permission 不执行。
- sandbox 和 permission 共享同一个 audit logger。

`runner-hardening.test.js`

- 用户输入在 preflight 被拦截时，Runner 返回安全拦截消息。
- 工具调用被拦截时，Runner 返回安全拦截消息。
- 审计日志写入 JSONL。

### 可选本地 Langfuse 验证

`langfuse-local.test.js`

只有在 `TRACE_TO_LANGFUSE=true` 且 key 存在时运行。验证至少写入一条 trace。这个测试不进默认 `npm test`，避免没有本地容器时失败。

## 迁移步骤

1. 复制 `demo/xiaoquan` 到 `demo/xiaoquanv2`。
2. 删除团队相关文件和配置：
   - `src/agent/build-team.js`
   - `src/agent/skill-tools-scoped.js`
   - `src/tools/team-tools.js`
   - `src/tools/mailbox.js`
   - `src/tools/event-log.js`
   - `src/watch/*`
   - `workspace/manager`
   - `workspace/pm`
   - `workspace/rd`
   - `workspace/qa`
3. 恢复 `index.js` 为单助手启动链路。
4. 新增 Hook 框架、trace context 和 shared hooks。
5. 在 `runner.js` 和 `react-loop.js` 接入 adapter。
6. 加 Podman Langfuse compose。
7. 先跑单元测试，再跑集成测试。

## 文章写作重点

文章不要写成 Langfuse 教程，也不要复述极客时间原文。前几篇已经讲过的 Hook、Skill、沙箱和数字团队技术细节，这篇只在 demo 需要时点名入口，不再重新铺开解释。

主线可以是：

1. 先启动本地 Podman Langfuse，再启动 `xiaoquanv2`。
2. 跑一个正常 demo：用户消息进入 Runner，Agent 调 Skill 或沙箱，Langfuse 里出现完整 trace。
3. 跑几个拦截 demo：路径穿越、危险命令、权限 deny、成本或循环触发，展示用户回复、audit JSONL 和 Langfuse error span。
4. 跑一个 sub-agent/子任务 demo：子任务的 LLM/tool span 继承父级 trace，不另起一棵树。
5. 最后回到少量源码入口：`hooks.yaml`、`wrapToolsWithHooks()`、`trace-context.js`、几个 guard 文件。只讲它们如何支撑 demo，不重复前文已讲过的通用原理。
6. 总结强调：Python 版已有的加固能力，JS 版这次都补齐；数字团队不在本文范围内。

## 风险和处理

| 风险 | 处理 |
| --- | --- |
| Langfuse 官方 compose 依赖较多，本地 Podman 启动复杂 | `infra/README.md` 记录固定命令和端口，Langfuse 不可用时主流程降级 |
| AI SDK 工具 wrapper 漏包某些工具 | 工具统一在构造后走 `wrapToolsWithHooks()`，测试覆盖 `read_file` 和 `execute_code` |
| 观测 handler 先后顺序被改坏 | `hook-chain.test.js` 验证观测先于策略 |
| 成本统计不精确 | 预算围栏使用配置化估算值，文章里明确范围 |
| 安全规则误杀自然语言 | 单测覆盖常见 false positive，默认 warn 的权限策略减少误杀 |
| AsyncLocalStorage context 串线 | `sub-agent-trace.test.js` 覆盖并发 session，确保 trace 和 parent span 隔离 |

## 验收标准

1. `demo/xiaoquanv2` 可以通过 Test API 跑一轮普通对话。
2. 本地 `npm test` 通过。
3. 路径穿越输入会返回安全拦截消息。
4. `data/security_audit.jsonl` 有对应 deny 记录。
5. 本地 Podman Langfuse 启动后，普通请求和被拦截请求都能在 UI 里看到 trace。
6. sub-agent 或子任务执行时，子 LLM/tool span 挂在父级 tool span 下。
7. retry tracker 能记录失败重试并在超过阈值时拦截。
8. 文章草稿以 demo 截图、命令输出、trace/audit 结果为主，不重复前文已经讲过的技术细节。
9. `idea/xiaopaw-hardening/idea.md` 和文章草稿能引用 `xiaoquanv2` 的真实文件路径和测试结果。
