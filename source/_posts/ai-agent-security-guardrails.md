---
title: 别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离
date: 2026-05-19 10:00:00
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用一个 JS demo 拆解 Agent 运行时安全护栏：工具参数怎么消毒，权限怎么拦，API Key 怎么不进模型上下文。
---

# 前言

Chatbot 被 prompt injection 绕一下，最常见的后果是输出乱了。

Agent 不一样。Agent 后面挂着工具，工具可能读文件、发邮件、调 API，甚至执行 shell。输出乱了只是表面，真正麻烦的是它可能把一句“帮我排查下机器状态”翻译成一个真实的副作用。

上一篇我们做了可靠性护栏：失败追踪、循环检测、成本控制。那一层解决的是 Agent 会不会原地打转、会不会把账单打爆。

这一篇换个角度：**可靠性防蠢，安全性防骗**。

代码放在 `demo/agent-security-guardrails`，是一个纯 JS demo。它不用真实 LLM，直接用脚本化工具调用把四个场景跑出来：

```bash
npm start
npm run attack:privilege
npm run attack:inject
npm run attack:api-leak
```

先看提权场景。

# 一、Prompt 禁止了，为什么还要 Hook 拦？

demo 里的 `workspace/demo-agent/soul.md` 写得很清楚：

```markdown
- NEVER 执行 shell 命令或任何操作系统级指令
- NEVER 读取系统敏感路径（/etc、~/.ssh、用户主目录）
- NEVER 对外发送邮件或通过未授权 API 传输数据
```

如果安全边界只写在 prompt 里，问题是：模型“知道不该做”和系统“不能做”不是一回事。

`src/agent/real-agent.js` 里故意放了一个危险工具：

```js
shell_executor: {
  definition: {
    function: {
      name: 'shell_executor',
      description: 'Execute system commands. Demo only; should be denied.',
    },
  },
  execute: async ({ query }) => ({ breached: true, command: query }),
}
```

这就是 Agent 安全和 Chatbot 安全的分叉点。Chatbot 说错话，最多是内容事故。Agent 一旦调用了这个工具，事故就进入系统边界。

跑一下提权场景：

```bash
npm run attack:privilege
```

输出里最关键的是这几行：

```text
Scenario: privilege
Guardrail triggered: Permission denied: tool 'shell_executor'
[permission-gate] {"deny_count":1,"denied_tools":["shell_executor"]}
```

Prompt 负责表达意图，Hook 负责执行边界。`shell_executor` 不是靠模型自觉忍住的，而是在工具执行前被 `PermissionGate` 拦下来了。

# 二、拦截点在哪里：BEFORE_TOOL_CALL

安全策略最适合卡在工具调用前。因为此时已经能拿到两个东西：

| 信息 | 用处 |
|---|---|
| `toolName` | 判断工具能不能被当前 Agent 使用 |
| `toolInput` | 判断参数里有没有路径穿越、命令注入、密钥引用 |

JS demo 里，工具执行被包在 `runGuardedToolCall` 里：

```js
try {
  await adapter.beforeToolCall({ toolName, toolInput })
} catch (error) {
  if (error instanceof GuardrailDeny) {
    await adapter.afterToolCall({
      toolName,
      toolInput,
      success: false,
      metadata: {
        guardrailDeny: true,
        denyReason: error.reason,
        deniedBeforeExecution: true,
      },
    })
  }
  throw error
}

const output = await execute(toolInput)
```

这里有两个动作。

第一，`beforeToolCall` 先走 Hook。只要抛出 `GuardrailDeny`，`execute` 就不会跑。

第二，即使工具没有执行，也补一条失败的 `afterToolCall`。这样审计日志能知道“这次不是工具炸了，是护栏在执行前拒绝了”。

`dispatchGate` 是这个机制的核心：

```js
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

Python 参考实现里同一个入口叫 `dispatch_gate`，JS 版改成了驼峰写法。

普通 Hook 异常只记录，不影响主流程。`GuardrailDeny` 不一样，它就是策略拒绝信号，必须往外抛。

Python/CrewAI 版本里还有一个 `pending_deny`。那是框架适配层的处理：CrewAI 的 `before_tool_call` 只能返回 `False` 阻止工具，不能直接把异常一路抛到任务外层，所以 adapter 先把拒绝存进 `pending_deny`，等 step callback 再抛出来。

JS demo 自己控制执行循环，不需要这层缓存。名字不同，意思一样：拒绝信号不能丢。

# 三、第一道门：SandboxGuard

先看输入攻击：

```bash
npm run attack:inject
```

场景里调用的是看起来安全的 `knowledge_search`，参数却是：

```js
{ query: '../../etc/passwd' }
```

这类字符串不需要 LLM 再判断一次。路径穿越、危险命令、shell 拼接符，都是确定性特征，直接用确定性规则挡掉。

`SandboxGuard` 做的事很朴素：

```js
if (PATH_TRAVERSAL.test(text)) {
  this.block(ctx, 'path_traversal', field, text)
}

if (COMMAND_FIELDS.has(field.toLowerCase()) && SHELL_INJECTION.test(text)) {
  this.block(ctx, 'shell_injection', field, text)
}
```

这里我特意把字段分了一下。`command`、`query`、`script` 这类字段按命令风险看；`content` 这类字段不能见到一个 `|` 就拦，否则 Markdown 表格也会误伤。

测试里就有这个用例：

```js
toolInput: { content: '| a | b |\n|---|---|' }
```

安全策略如果太粗，会把正常工作流打断；太松，又等于没拦。`SandboxGuard` 先做几个高置信度规则，拦住确定危险的输入，剩下的交给更高层的业务策略。

# 四、第二道门：PermissionGate

参数没问题，不代表工具可以用。

`PermissionGate` 读取 `workspace/demo-agent/security.yaml`：

```yaml
permissions:
  default: ask
  tools:
    knowledge_search: allow
    file_reader: ask
    shell_executor: deny
    email_sender: deny
    secure_api: allow
```

这里是一个很小的权限模型：`allow`、`ask`、`deny`。

显式配置优先。`shell_executor` 明确是 `deny`，所以提权场景直接拒绝：

```js
if (level === 'deny') {
  this.audit?.recordEvent('permission_deny', decision)
  throw new GuardrailDeny(`Permission denied: tool '${tool}'`, {
    guardrail: 'permission_gate',
    decision,
  })
}
```

`ask` 在这个 demo 里只是记录一次决策后放行。真实系统可以在这里接人工确认、审批单、白名单会话，或者直接把任务暂停。

关键不在 `ask` 的 UI 怎么做，而在权限判断从 prompt 里拿了出来。Agent 说“我不会发邮件”不够，`email_sender: deny` 才是运行时边界。

# 五、第三道门：SecureToolWrapper

API Key 最容易被偷懒塞进 prompt、backstory 或工具 description 里。这样做很方便，也很危险，因为模型上下文里真的出现了密钥。

JS demo 里，`secure_api` 的工具 schema 只暴露 `query`：

```js
parameters: {
  type: 'object',
  properties: { query: { type: 'string' } },
  required: ['query'],
}
```

密钥在执行时才注入：

```js
secure_api: SecureToolWrapper.wrap(rawTool, {
  apiKey: 'SECURE_API_KEY',
})
```

包装器也很短：

```js
execute: async (input = {}) => {
  const resolved = SecureToolWrapper.resolveCredentials(credentials)
  return tool.execute({ ...input, ...resolved })
}
```

所以 `npm run attack:api-leak` 的结果只有预览：

```text
Result: {"ok":true,"query":"account status","keyPreview":"sk-D...xxxx"}
```

工具执行函数拿到了完整 `apiKey`，模型能看到的参数 schema 里没有 `apiKey`。这条隔离线很重要：密钥属于工具运行时，不属于对话上下文。

# 六、安全事件要留痕

拦下来只是第一步。线上真出事的时候，我们还要知道是谁拦的、拦了什么、当时参数长什么样。

`SecurityAuditLogger` 做两件事：内存里留 metrics，磁盘上写 JSONL。

```js
recordEvent(type, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    security_event: type,
    ...details,
  }
  this.events.push(entry)
  fs.appendFileSync(this.auditFile, `${JSON.stringify(entry)}\n`)
}
```

`hooks.yaml` 里把它声明在最前面：

```yaml
strategies:
  audit-logger:
    class: audit-logger.SecurityAuditLogger

  sandbox-guard:
    class: sandbox-guard.SandboxGuard
    deps:
      audit: audit-logger

  permission-gate:
    class: permission-gate.PermissionGate
    deps:
      audit: audit-logger
```

`deps` 的含义很直接：把前面已经实例化好的 `audit-logger` 注入到 `SandboxGuard` 和 `PermissionGate` 的构造参数里。

这样两类安全事件会进入同一份 `security-audit.jsonl`。路径穿越是 `sandbox_path_traversal`，权限拒绝是 `permission_deny`，会话结束还有一条 `session_summary`。

这里顺序有意义。被依赖的策略要先声明；加载器按 YAML 顺序实例化，找不到依赖就跳过当前策略。安全系统里这种失败应该早发现，不能悄悄退化成“没有审计也能跑”。

# 七、三层护栏

到这里，前面几篇的 Hook 体系就能串起来了。

| 层 | 解决的问题 | 代表策略 |
|---|---|---|
| 可观测 | 看见 Agent 每一步做了什么 | structured log、Langfuse trace |
| 可靠性 | 防止失败重试、循环、超预算 | RetryTracker、LoopDetector、CostGuard |
| 安全性 | 防止越权、注入、密钥泄漏 | SandboxGuard、PermissionGate、SecureToolWrapper |

这三层不应该散落在主流程里。Agent loop 只负责“准备调用工具”，Hook 策略负责“能不能调用”。

我比较喜欢这个拆法，因为它保住了两个边界：业务流程不用到处写安全判断，安全策略也不用理解每个 Agent 的完整任务。

# 总结

这篇讲的是 Agent 工具调用前后的安全边界。

`SandboxGuard` 挡确定性的危险输入，`PermissionGate` 按工具名做运行时权限判断，`SecureToolWrapper` 把 API Key 留在工具执行层。

`SecurityAuditLogger` 和 `deps` 解决留痕问题，多条策略可以共享同一个审计实例。

Prompt 仍然有用，它适合写角色约束和行为偏好；真正涉及副作用的地方，要交给 Hook 和 `GuardrailDeny`。

下一篇可以把这套安全层装进 XiaoPaw，让本地助手不只会做事，也知道哪些事不能碰。
