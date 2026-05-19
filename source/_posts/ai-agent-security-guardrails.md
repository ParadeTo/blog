---
title: 别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离
date: 2026-05-19 10:00:00
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用 JS 实现拆解 Agent 运行时安全护栏：工具调用怎么收口，权限怎么拦，API Key 怎么不进模型上下文。
---

# 前言

上篇给 Agent 加了一层可靠性护栏，拦的是“它自己犯傻”：工具失败了还重试，结果重复了还继续，token 已经花超了还往下跑。

这篇换一个问题：如果 Agent 被任务骗了，想去调用一个不该调用的工具，谁来拦？

这个问题比 Chatbot 注入麻烦。Chatbot 被带偏，通常是回答错了、说多了、泄露了上下文。Agent 不一样，它后面挂着工具。`file_reader` 会读文件，`shell_executor` 会执行命令，`email_sender` 会真的把消息发出去。

所以 Agent 安全不能只写在 prompt 里。

prompt 可以提醒模型“不要执行 shell”“不要读敏感文件”“不要泄露 API Key”。但等 Agent 真的走到工具调用这一步，系统需要一个独立于模型的地方来判断：这个工具能不能调，这组参数能不能过，以谁的身份执行，执行后有没有记录。

用户输入、网页内容、文件内容、搜索结果、工具返回值，最后都会进上下文。攻击内容可能伪装成任务要求，模型也可能一边复述安全规则，一边在下一步选择了危险工具。

拆开看，大概是这几类：

| 风险 | 落到工具层会变成什么 |
|---|---|
| 输入注入 | 不可信内容诱导 Agent 调工具 |
| 权限越界 | Agent 想用当前任务不该用的工具 |
| 身份混淆 | 工具调用到底代表谁执行说不清 |
| 数据泄露 | 先读敏感数据，再通过网络工具带出去 |

Hook 入口上一篇已经铺过，不再展开。本文只用到一个点：工具真正执行前会先进 `beforeToolCall`，门禁类 Hook 通过 `dispatchGate` 往外抛 `GuardrailDeny`。只要它拒绝，真实工具就不会执行。

下面往代码里落，看这些策略分别拦什么。

# 一、沙箱与输入消毒

先拆一个容易混的点：`SandboxGuard` 不是再起一个 Docker 沙盒，也不是沙箱的全部。

先看执行范围。按红队视角，Agent 沙箱至少得卡住几件事：

| 沙箱配置 | 拦什么 |
|---|---|
| 网络出站白名单 | 工具只能访问允许的域名，减少数据外传 |
| 工作区边界 | 读只能读 workspace 内，写也只能写 workspace 内，避免敏感文件泄露和持久化 |
| 配置文件写保护 | `hooks.yaml`、`security.yaml` 只读，避免 Agent 改自己的护栏 |
| 环境变量隐藏 | API Key、数据库密码这类敏感变量不暴露给 Agent 上下文 |

这和前面做代码解释器时用的 Docker 不太一样。那次更偏功能隔离：让代码在一个独立环境里跑。本文说的是安全隔离：防逃逸、防外泄、防篡改。

Docker 很方便，也确实可以限制挂载目录。配置正确时，`../../etc/passwd` 这类路径最多读到容器里的文件，读不到宿主机。

但它还不够。Docker 共享宿主内核，不能把“用了 Docker”直接等同于安全沙箱。Claude Code 的 [sandboxing 文档](https://code.claude.com/docs/zh-CN/sandboxing) 也提到，它会用 OS 级机制去约束子进程，比如 macOS 上的 Seatbelt、Linux 上的 bubblewrap。

另一个坑是，Agent 系统里不是所有工具调用都天然处在同一个容器边界里。可能有本地文件工具、HTTP 工具、内部 API wrapper，也可能有不同模块直接调用工具。只要有一条路径没进沙箱，或者挂载配置被改坏，越界参数就可能真的打到执行层。

`SandboxGuard` 放在这个位置：它不替代挂载目录限制，只做更早一层的确定性输入消毒。它不依赖 LLM 判断，只在工具执行前用规则看一眼：这个调用有没有明显不符合工具语义。

比如这个调用：

```js
{
  toolName: 'knowledge_search',
  toolInput: { query: '../../etc/passwd' },
}
```

`knowledge_search` 这个工具本身没问题，但它应该接收搜索词，不应该接收一个路径穿越参数。哪怕底层沙箱最后能挡住，这次调用在工具入口也已经不对劲了，直接拒绝并记录原因更干净。

`SandboxGuard` 做的事很直接：

```js
for (const [field, rawValue] of Object.entries(ctx.toolInput ?? {})) {
  const text = safeDecode(String(rawValue ?? ''))

  if (PATH_TRAVERSAL.test(text)) {
    this.block(ctx, 'path_traversal', field, text)
  }

  if (DANGEROUS_COMMANDS.test(text)) {
    this.block(ctx, 'dangerous_command', field, text)
  }

  if (COMMAND_FIELDS.has(field.toLowerCase()) && SHELL_INJECTION.test(text)) {
    this.block(ctx, 'shell_injection', field, text)
  }
}
```

`safeDecode` 是为了挡编码绕过。攻击参数可以写成 `%2e%2e%2f` 这种形式，先 decode 一下，少掉一类低级绕法。

`COMMAND_FIELDS` 则是为了少误伤。不是所有字段都应该按命令参数看。`query`、`cmd`、`script` 可以严一点；`content` 这种正文类字段就不能见到一个 `|` 就拦，不然 Markdown 表格也会被误杀。

拦截时，`SandboxGuard` 不是返回一个布尔值，而是抛出 `GuardrailDeny`：

```js
throw new GuardrailDeny(`${type} blocked in ${ctx.toolName}.${field}`, {
  guardrail: 'sandbox_guard',
  violation,
})
```

这样门禁线就能直接中断工具执行。

参数过了，还不能直接放行。因为有些工具即使参数干净，也不该给当前任务用。

# 二、PermissionGate 看工具

再看这个调用：

```js
{
  toolName: 'shell_executor',
  toolInput: { query: 'whoami' },
}
```

`whoami` 不算危险命令，参数检查可能会通过。但普通任务能不能用 `shell_executor`，这是权限问题。

demo 里把工具权限放在 `security.yaml`：

```yaml
permissions:
  default: ask
  tools:
    knowledge_search: allow
    safe_calculator: allow
    file_reader: ask
    shell_executor: deny
    email_sender: deny
    secure_api: allow
```

`PermissionGate` 读取这份配置，在 `BEFORE_TOOL_CALL` 里做裁决：

```js
const level = this.toolPermissions.get(toolKey) ?? this.defaultLevel

if (level === 'deny') {
  this.audit?.recordEvent('permission_deny', decision)
  throw new GuardrailDeny(`Permission denied: tool '${tool}'`, {
    guardrail: 'permission_gate',
    decision,
  })
}

if (level === 'ask') {
  this.audit?.recordEvent('permission_ask', decision)
}
```

这个 demo 只做三档：`allow`、`ask`、`deny`。

`deny` 直接拒绝。`allow` 放行。`ask` 在 demo 里先记录后放行，真实系统可以暂停任务，弹出确认，或者把任务挂到审批队列里。

这层和 `SandboxGuard` 的分工不要混。`SandboxGuard` 看参数有没有毒，`PermissionGate` 看工具有没有资格。`shell_executor` 就算只执行 `whoami`，也可以因为权限策略被拒绝。

# 三、凭证别进上下文

权限网关回答的是“这个工具能不能用”，但还没回答另一个问题：工具真正执行时需要的密钥放在哪里？

比如 `secure_api` 要调用一个内部服务，底层肯定需要 API Key。最省事的写法，是把 key 直接塞进 prompt、工具描述、参数 schema，甚至让 Agent 调工具时自己带上：

```js
{
  toolName: 'secure_api',
  toolInput: {
    query: 'account status',
    apiKey: process.env.SECURE_API_KEY,
  },
}
```

这样工具确实能跑，但密钥也进了模型上下文、工具参数、日志和审计链路。只要后面有一步把参数发出去，或者把上下文总结给别的工具，key 就可能被带走。

先把两层拆开：

| 阶段 | 需要什么 |
|---|---|
| 模型决策 | 工具名、工具说明、业务参数 |
| 工具执行 | 业务参数、运行时凭证 |

模型只需要知道“我要查账号状态”，不需要知道 API Key 长什么样。

这个例子里，`secure_api` 给模型看的 schema 只有 `query`：

```js
parameters: {
  type: 'object',
  properties: {
    query: { type: 'string' },
  },
  required: ['query'],
}
```

密钥不在 schema 里，也不在 prompt 里。工具注册时只声明：执行时需要从哪个环境变量取凭证。

```js
secure_api: SecureToolWrapper.wrap(rawTool, {
  apiKey: 'SECURE_API_KEY',
})
```

传进去的是环境变量名，不是密钥值。真正取值发生在 `execute` 里面：

```js
export class SecureToolWrapper {
  static wrap(tool, credentials = {}) {
    return {
      ...tool,
      execute: async (input = {}) => {
        const resolved = SecureToolWrapper.resolveCredentials(credentials)
        return tool.execute({ ...input, ...resolved })
      },
    }
  }
}
```

它没有改工具给模型看的 `definition`，只替换了工具真正执行时的 `execute`。

也就是说，模型看到的是：

```js
{ query: 'account status' }
```

真实工具执行时拿到的是：

```js
{ query: 'account status', apiKey: '...' }
```

这两个对象不在同一层。`toolInput` 是模型参与生成的业务参数，可以做摘要审计，但日志里也要按字段脱敏；`apiKey` 不进入这条链路，只在执行层短暂出现。

这节只解决“凭证放在哪里”。它还不是完整身份认证。线上还要继续回答：这次调用代表哪个用户、用的是用户凭证还是服务账号、这个服务账号能访问哪些资源、审计日志里要不要记录批准人。

先守住这条线：模型上下文不直接接触密钥。

# 四、用 deps 把策略串起来

现在有了三块东西：

| 策略 | 处理的问题 |
|---|---|
| `SandboxGuard` | 参数注入、路径穿越、危险命令 |
| `PermissionGate` | 工具越权、默认权限 |
| `SecureToolWrapper` | 凭证留在执行层 |

还差一件事：留痕。

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

在 `hooks.yaml` 里，`audit-logger` 被放在前面：

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

`deps` 的意思是，把前面创建好的策略实例注入到后面的构造参数里。

加载器里有一个 `#strategies`，专门保存已经实例化好的策略：

```js
const deps = {}

for (const [paramName, refKey] of Object.entries(entry.deps ?? {})) {
  const dependency = this.#strategies[refKey]
  if (!dependency) {
    missingDep = true
    break
  }
  deps[paramName] = dependency
}

const instance = new StrategyClass({ ...(entry.config ?? {}), ...deps })
this.#strategies[strategyKey] = instance
```

拿 `sandbox-guard` 举例：

```yaml
sandbox-guard:
  class: sandbox-guard.SandboxGuard
  deps:
    audit: audit-logger
```

加载器会先从 `#strategies['audit-logger']` 里取出前面创建好的 `SecurityAuditLogger` 实例，再组装成：

```js
new SandboxGuard({ audit: auditLogger })
```

所以 `SandboxGuard` 和 `PermissionGate` 不需要自己创建 logger。它们拿到同一个 `audit`，路径穿越会写 `sandbox_path_traversal`，权限拒绝会写 `permission_deny`，会话结束再写 `session_summary`。

加载器按 YAML 顺序实例化策略。依赖没找到，当前策略就不会注册。安全策略半残地挂上去，比直接失败更麻烦。

# 总结

这篇只盯一个地方：Agent 工具调用前的安全边界。

Agent 安全不要只写进 prompt。工具真正执行前，要先过 `BEFORE_TOOL_CALL`，策略可以用 `GuardrailDeny` 中断调用。

`SandboxGuard` 看参数，`PermissionGate` 看工具权限，`SecureToolWrapper` 把密钥留在执行层。

`SecurityAuditLogger` 和 `deps` 负责把策略串起来，拒绝以后能查得到原因。
