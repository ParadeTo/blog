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

上篇给 Agent 加了一层可靠性护栏，拦的是“它自己犯傻”：工具失败了还重试，结果重复了还继续，token 已经花超了还往下跑。

这篇换一个问题：如果 Agent 被任务骗了，想去调用一个不该调用的工具，谁来拦？

先不用真实 LLM，我们只把最危险的那一瞬间抽出来：Agent 已经决定要调工具了，工具名和参数也准备好了。

比如它准备执行这样一次调用：

```js
{
  toolName: 'shell_executor',
  toolInput: { query: 'whoami' },
}
```

这不是一段 prompt，也不是模型回复。它代表的是 Agent loop 里已经形成的一次工具调用请求：调用 `shell_executor`，参数是 `whoami`。

demo 里确实有这个工具。如果真的执行到 `execute`，它会返回一个危险标记：

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

现在矛盾来了。

`workspace/demo-agent/soul.md` 里明明写着：

```markdown
- NEVER 执行 shell 命令或任何操作系统级指令
- NEVER 读取系统敏感路径（/etc、~/.ssh、用户主目录）
- NEVER 对外发送邮件或通过未授权 API 传输数据
```

但 prompt 说“不准执行 shell”，不等于 JS 里的 `shell_executor.execute()` 不能被调用。只要工具调用请求已经生成，接下来就不能再指望模型自觉了。

所以这个 demo 验证的是运行时最后一道门：在 `shell_executor.execute()` 之前，先触发 `BEFORE_TOOL_CALL`，让权限策略决定这次调用能不能继续。

跑一下：

```bash
npm run attack:privilege
```

```text
Scenario: privilege
Guardrail triggered: Permission denied: tool 'shell_executor'
[permission-gate] {"deny_count":1,"denied_tools":["shell_executor"]}
```

这几行可以这么读：

| 输出 | 意思 |
|---|---|
| `Scenario: privilege` | 当前回放的是“越权调用 shell 工具”的场景 |
| `Guardrail triggered` | 工具还没执行，运行时护栏先拒绝了 |
| `Permission denied` | 拒绝来自 `PermissionGate` |
| `denied_tools:["shell_executor"]` | 被拦的工具就是 `shell_executor` |

这篇就顺着这条链路拆：

```text
脚本模拟一次工具调用
  -> BEFORE_TOOL_CALL
  -> PermissionGate 读取 security.yaml
  -> shell_executor: deny
  -> GuardrailDeny
  -> execute 不会运行
```

代码在 `demo/agent-security-guardrails`。这个 demo 不演示模型怎么思考，只演示工具调用已经出现以后，运行时怎么拦。

Agent 安全的问题不在“它会不会说错话”，而在“它说完以后会不会真的做事”。Chatbot 的注入主要影响输出，Agent 的注入会进入工具层。

简单讲，上篇是可靠性防蠢，这篇是安全性防骗。本文要解决的不是“怎么把 prompt 写得更严”，而是把工具调用变成一条必须过门禁的链路。

# 一、真正的边界在工具调用前

工具调用前刚好能看到两个关键信息：

| 信息 | 能做的判断 |
|---|---|
| `toolName` | 这个工具当前能不能用 |
| `toolInput` | 参数里有没有路径穿越、命令注入、密钥引用 |

JS demo 里，所有工具执行都要经过 `runGuardedToolCall`：

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

顺序很重要。

先跑 `beforeToolCall`，再执行工具。只要前面抛出 `GuardrailDeny`，后面的 `execute` 根本不会发生。

这里还补了一条失败的 `afterToolCall`。工具虽然没执行，但审计链路需要知道：这次失败不是工具报错，而是护栏在执行前拒绝了。

拒绝信号靠 `dispatchGate` 往外抛：

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

普通 Hook 异常只记录。`GuardrailDeny` 是策略主动拒绝，必须中断主流程。

Python 参考实现里同一个入口叫 `dispatch_gate`。CrewAI 的 `before_tool_call` 只能返回 `False`，异常不好直接抛到任务外层，所以 adapter 用 `pending_deny` 先存起来，再在 step callback 里抛出。JS demo 自己控制执行循环，就不需要这层缓存。

到这里，主线清楚了：安全策略不是散落在 prompt 或业务代码里，而是集中挂到 `BEFORE_TOOL_CALL`。

# 二、先查参数：SandboxGuard

第一类风险是参数本身有问题。

跑注入场景：

```bash
npm run attack:inject
```

工具名是安全的 `knowledge_search`，参数却长这样：

```js
{ query: '../../etc/passwd' }
```

这种输入不需要再问一次 LLM。路径穿越、危险命令、shell 拼接符，都是确定性特征，直接用确定性规则拦。

`SandboxGuard` 只看 `toolInput`：

```js
if (PATH_TRAVERSAL.test(text)) {
  this.block(ctx, 'path_traversal', field, text)
}

if (COMMAND_FIELDS.has(field.toLowerCase()) && SHELL_INJECTION.test(text)) {
  this.block(ctx, 'shell_injection', field, text)
}
```

这里有个小细节：不同字段不能用同一把尺子。

`command`、`query`、`script` 这类字段要按命令风险看；`content` 这种正文类字段不能见到一个 `|` 就拦，不然 Markdown 表格也会误伤。

测试里专门留了这个例子：

```js
toolInput: { content: '| a | b |\n|---|---|' }
```

`SandboxGuard` 的边界是参数消毒。它不关心工具有没有权限，只回答一个问题：这个入参本身危险吗？

# 三、再查权限：PermissionGate

参数没问题，也不代表工具可以用。

第二类风险是工具越权。比如 `shell_executor` 的参数只是 `whoami`，没有路径穿越，也没有 shell 拼接符，但这个工具本身就不该给普通任务用。

这层交给 `PermissionGate`。策略读取 `workspace/demo-agent/security.yaml`：

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

规则很小：`allow`、`ask`、`deny`。

显式配置优先。`shell_executor` 是 `deny`，所以提权场景会在工具执行前停住：

```js
if (level === 'deny') {
  this.audit?.recordEvent('permission_deny', decision)
  throw new GuardrailDeny(`Permission denied: tool '${tool}'`, {
    guardrail: 'permission_gate',
    decision,
  })
}
```

`ask` 在 demo 里只是记录一次决策后放行。真实系统可以在这里接人工确认，或者把任务挂起等待审批。

这一层和 `SandboxGuard` 的分工不一样。`SandboxGuard` 看参数，`PermissionGate` 看工具名和策略。前者防注入，后者防越权。

# 四、最后处理密钥：SecureToolWrapper

第三类风险更隐蔽：工具需要 API Key。

最省事的写法是把 key 塞进 prompt、backstory 或工具 description。这样模型一定能“知道”怎么调用，问题是它也真的看到了密钥。

JS demo 里，`secure_api` 给模型看的 schema 只有 `query`：

```js
parameters: {
  type: 'object',
  properties: { query: { type: 'string' } },
  required: ['query'],
}
```

密钥在工具执行时注入：

```js
secure_api: SecureToolWrapper.wrap(rawTool, {
  apiKey: 'SECURE_API_KEY',
})
```

包装器只改执行层：

```js
execute: async (input = {}) => {
  const resolved = SecureToolWrapper.resolveCredentials(credentials)
  return tool.execute({ ...input, ...resolved })
}
```

所以跑：

```bash
npm run attack:api-leak
```

输出只有预览：

```text
Result: {"ok":true,"query":"account status","keyPreview":"sk-D...xxxx"}
```

`SecureToolWrapper` 要保住的是这条线：模型上下文里没有密钥，工具运行时才拿到密钥。

# 五、把几条策略装到一起

前面三层分别解决不同问题：

| 风险 | 策略 | 拦截对象 |
|---|---|---|
| 参数注入 | `SandboxGuard` | `toolInput` |
| 工具越权 | `PermissionGate` | `toolName` |
| 密钥泄漏 | `SecureToolWrapper` | 工具执行层 |

还差一件事：留痕。

拦一次不难，线上真正要查的是：谁拦的、拦了什么、当时参数长什么样。

`SecurityAuditLogger` 负责把安全事件写成 JSONL：

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

`hooks.yaml` 里它被放在最前面：

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

`deps` 的意思是：把前面已经创建好的 `audit-logger` 注入到后面策略的构造参数里。

这样 `SandboxGuard` 和 `PermissionGate` 共享同一个 `SecurityAuditLogger`。路径穿越会写 `sandbox_path_traversal`，权限拒绝会写 `permission_deny`，会话结束再写一条 `session_summary`。

顺序也不能乱。被依赖的策略要先声明，加载器按 YAML 顺序实例化；找不到依赖，当前策略就不该继续装上去。

# 六、回到四个场景

到这里再看 demo 的四个命令，就不是四个零散例子了。

| 命令 | 发生了什么 | 说明 |
|---|---|---|
| `npm start` | `knowledge_search` 正常执行 | 普通工具走完整链路 |
| `npm run attack:privilege` | `shell_executor` 被拒绝 | 工具越权由 `PermissionGate` 拦 |
| `npm run attack:inject` | `../../etc/passwd` 被拒绝 | 参数注入由 `SandboxGuard` 拦 |
| `npm run attack:api-leak` | API Key 只出现预览 | 密钥由 `SecureToolWrapper` 注入 |

这也是我觉得 Hook 适合做 Agent 安全的原因。Agent loop 只负责“准备调用工具”，策略负责判断“能不能调用”。安全逻辑不需要散在 prompt、工具函数和业务流程里。

前面几篇的层次也能接上：

| 层 | 解决的问题 |
|---|---|
| 可观测 | 先看见 Agent 每一步做了什么 |
| 可靠性 | 再防止失败重试、循环、超预算 |
| 安全性 | 最后拦住越权、注入、密钥泄漏 |

安全性不是替代前两层，而是把“真实副作用”这一关补上。

# 总结

这篇讲的是 Agent 工具调用前后的安全边界。

主线只有一条：工具执行前先过 `BEFORE_TOOL_CALL`，策略可以通过 `GuardrailDeny` 中断调用。

`SandboxGuard` 看参数，`PermissionGate` 看权限，`SecureToolWrapper` 把密钥留在工具执行层。

`SecurityAuditLogger` 和 `deps` 负责把这些策略串起来，拒绝以后能查得到原因。

下一篇可以把这套安全层装进 XiaoPaw，让本地助手不只会做事，也知道哪些事不能碰。
