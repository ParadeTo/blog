---
title: 别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离
date: 2026-05-19 10:00:00
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用 JS 实现拆解 Agent 运行时安全护栏：工具参数怎么消毒，权限怎么拦，API Key 怎么不进模型上下文。
---

# 前言

上篇给 Agent 加了一层可靠性护栏，拦的是“它自己犯傻”：工具失败了还重试，结果重复了还继续，token 已经花超了还往下跑。

这篇换一个问题：如果 Agent 被任务骗了，准备调用一个不该调用的工具，谁来拦？

prompt 里当然可以写“不要执行 shell”“不要读敏感文件”“不要发邮件”。这些话有用，但它们只是写给模型看的约束。

真正产生副作用的是工具函数。`file_reader` 会读文件，`shell_executor` 会执行命令，`email_sender` 会把消息发出去。

一旦 Agent 的下一步已经变成“调用某个工具 + 一组参数”，风险就从文本进入了运行时。这里才是安全护栏该工作的地方。

```text
工具调用请求
  -> BEFORE_TOOL_CALL
  -> SandboxGuard 检查参数
  -> PermissionGate 检查权限
  -> GuardrailDeny
  -> 工具不执行，审计留痕
```

Agent 安全的问题不在“它会不会说错话”，而在“它说完以后会不会真的做事”。Chatbot 的注入主要影响输出，Agent 的注入会进入工具层。

简单讲，上篇是可靠性防蠢，这篇是安全性防骗。本文要解决的不是“怎么把 prompt 写得更严”，而是把工具调用变成一条必须过门禁的链路：参数先消毒，工具再判权，密钥不进模型上下文。

# 一、先把问题收拢到工具调用请求

先把安全问题收小一点。

不要一上来问“Agent 安全怎么做”，太大。运行时真正要处理的是一次工具调用请求：

```js
{
  toolName: 'shell_executor',
  toolInput: { query: 'whoami' },
}
```

这个对象里至少有两件事：

| 信息 | 能做的判断 |
|---|---|
| `toolName` | 这个工具当前能不能用 |
| `toolInput` | 参数里有没有路径穿越、命令注入、密钥引用 |

后面所有策略都围绕它展开。

| 问题 | 对应策略 |
|---|---|
| 参数本身危险吗 | `SandboxGuard` |
| 这个工具允许用吗 | `PermissionGate` |
| 工具需要的密钥会不会进模型上下文 | `SecureToolWrapper` |
| 拦截以后怎么查原因 | `SecurityAuditLogger` |

这条线立住以后，文章顺序就很简单：先把所有工具调用收口到同一个入口，再在这个入口上挂策略。

# 二、所有工具先过同一个入口

安全策略要生效，前提是工具不能绕路执行。

这份 JS 实现里，工具执行被统一包到 `runGuardedToolCall`：

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

先跑 `beforeToolCall`，再执行工具。只要前面抛出 `GuardrailDeny`，后面的 `execute` 就不会发生。

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

Python 参考实现里同一个入口叫 `dispatch_gate`。CrewAI 的 `before_tool_call` 只能返回 `False`，异常不好直接抛到任务外层，所以 adapter 用 `pending_deny` 先存起来，再在 step callback 里抛出。这份 JS 实现自己控制执行循环，就不需要这层缓存。

到这里，入口问题解决了。下一步才轮到具体策略：这个工具调用请求到底危险在哪里？

# 三、先查参数：SandboxGuard

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

参数通过了，还不能直接执行。因为有些工具即使参数干净，也不该给当前任务用。

# 四、再查权限：PermissionGate

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

`ask` 在这里先记录一次决策后放行。真实系统可以在这里接人工确认，或者把任务挂起等待审批。

这一层和 `SandboxGuard` 的分工不一样。`SandboxGuard` 看参数，`PermissionGate` 看工具名和策略。前者防注入，后者防越权。

参数和权限都过了，还剩一个容易被忽略的问题：工具执行时需要的密钥应该放在哪里？

# 五、密钥不属于模型上下文

第三类风险更隐蔽：工具需要 API Key。

最省事的写法是把 key 塞进 prompt、backstory 或工具 description。这样模型一定能“知道”怎么调用，问题是它也真的看到了密钥。

这份 JS 实现里，`secure_api` 给模型看的 schema 只有 `query`：

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

# 六、把策略挂到 Hook 层

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

这也是为什么安全逻辑不要散在主流程里。Agent loop 只负责“准备调用工具”，Hook 策略负责判断“能不能调用”。

# 七、回到几个场景

到这里再看这几个命令，就不是几个零散例子了。

| 命令 | 发生了什么 | 说明 |
|---|---|---|
| `npm start` | `knowledge_search` 正常执行 | 普通工具走完整链路 |
| `npm run attack:privilege` | `shell_executor` 被拒绝 | 工具越权由 `PermissionGate` 拦 |
| `npm run attack:inject` | `../../etc/passwd` 被拒绝 | 参数注入由 `SandboxGuard` 拦 |
| `npm run attack:api-leak` | API Key 只出现预览 | 密钥由 `SecureToolWrapper` 注入 |

这些命令不是为了证明模型一定会被骗。它们更像回归用例：每道运行时门都要能独立挡住对应风险。

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

`SandboxGuard` 看参数，`PermissionGate` 看工具权限，`SecureToolWrapper` 把密钥留在工具执行层。

`SecurityAuditLogger` 和 `deps` 负责把这些策略串起来，拒绝以后能查得到原因。

下一篇可以把这套安全层装进 XiaoPaw，让本地助手不只会做事，也知道哪些事不能碰。
