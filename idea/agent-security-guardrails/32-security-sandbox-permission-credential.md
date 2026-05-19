# 32｜企业安全性：沙箱、权限网关与身份认证

> 采集说明：页面未登录态只能看到课程目录、第 32 讲试看片段和课程元数据；这里没有保存课程原文、字幕全文或视频内容。本文档结合公开课程信息与本地 `m5l32` 代码整理，作为后续写作素材。

## 来源

- 极客时间：<https://time.geekbang.org/course/detail/101114301-973852>
- 课程：企业级多智能体设计实战
- 讲次：32｜企业安全性：沙箱、权限网关与身份认证
- 所属模块：模块五，企业级加固，确保系统安全可控
- 讲次时长：28:39
- 课程状态：2026-05-19 页面显示已更新 40 讲/共 42 讲
- 课程代码：<https://github.com/kid0317/crewai_mas_demo>
- 本地代码：`/Users/youxingzhi/ayou/crewai_mas_demo/m5l32`
- 采集时间：2026-05-19

## 一句话理解

第 30 讲解决“看见 Agent 在做什么”，第 31 讲解决“Agent 失败、循环、超预算时能不能自动停”，第 32 讲进一步解决“Agent 明明能做事，但哪些事绝对不能做”。

安全层的核心不是再写几条提示词，而是把权限、输入消毒、凭证隔离和审计做成运行时硬约束。

## 课程公开目录快照

当前页面按模块展示了 40 讲，已经进入“生产交付篇”：

| 模块 | 讲数 | 主题 |
| --- | ---: | --- |
| 课程介绍 | 1 | 转型企业级多智能体架构师 |
| 架构思维篇 | 4 | AI 应用开发范式、Agent 解构、Multi-Agent 协作、选型 |
| 工程落地篇 | 2 | 生产级系统蓝图、基础代码环境 |
| 模块一 | 5 | Agent、Task、Process、多模态、第一个项目实践 |
| 模块二 | 6 | 工具设计、Tools SOP、MCP、代码解释器、浏览器、Skills |
| 模块三 | 5 | 上下文管理、文件系统记忆、搜索驱动记忆、长记忆助手 |
| 模块四 | 7 | Orchestrator、数字团队、角色体系、协作协议、人类介入、自我进化、项目实战 |
| 模块五 | 4 | 可观测性、可靠性、安全性、XiaoPaw 系统加固 |
| 生产交付篇 | 4 | 需求边界、产品原型、评测体系、持续集成 |
| 直播回放 | 2 | OpenClaw、Claude Code 源码解析 |

第 32 讲处在模块五第三节，前面两节分别是 Hook 观测和可靠性护栏，后面第 33 讲会把这些加固能力落到 XiaoPaw 本地工作助手。

## 课程主线

试看片段先把问题边界讲清楚：Chatbot 安全主要担心输出说错话，Agent 安全则担心它调用工具后产生真实副作用。

结合本地代码，第 32 讲主线可以概括成四层：

1. 输入消毒：对工具参数做确定性检查，先挡住路径穿越、危险命令、Shell 注入和环境变量引用。
2. 权限网关：用 `deny`、`ask`、`allow` 给工具分级，未列出的工具默认需要确认。
3. 凭证隔离：API Key 不进入 prompt、backstory、tool schema，而是在工具执行层注入。
4. 安全审计：所有安全决策写入 JSONL，形成可追溯的运行记录。

这些策略被挂在 Hook 系统里，不要求业务主流程到处写 if 判断。

## 和第 31 讲的增量关系

第 31 讲已经有三类可靠性策略：

- `RetryTracker`：记录工具失败与重试情况。
- `CostGuard`：用预算约束控制成本。
- `LoopDetector`：用状态指纹拦截重复循环。

第 32 讲在同一套 Hook 管道上新增安全策略：

- `SecurityAuditLogger`
- `SandboxGuard`
- `PermissionGate`
- `SecureToolWrapper`

本地 `README.md` 对这层关系说得很明确：`m5l32` 是 `m5l31` 的升级版，正常业务路径仍然是 Bootstrap + SkillLoader + `sop_design`，变化集中在 `hooks.yaml`、`security.yaml`、`soul.md` 和 `demo.py --attack` 分支。

## 策略一：SandboxGuard

本地代码：

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/sandbox_guard.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/tests/test_sandbox_guard.py`

`SandboxGuard` 挂在 `BEFORE_TOOL_CALL`，在工具真正执行之前检查 `ctx.tool_input`。

它做了两层区分：

- 所有字段都检查路径穿越和危险命令。
- `command`、`query`、`cmd`、`args`、`code`、`shell`、`script` 这类命令字段额外检查 Shell 注入。

这个分层很实用。早期如果简单用 `[;&|]` 检查所有文本，写 Markdown 表格时就会误报；按字段语义处理后，普通内容字段可以保留 `|`，命令字段仍然严格拦截。

命中危险输入时，`SandboxGuard` 会：

- 记录 violation。
- 输出结构化安全日志。
- 通过注入的 `audit` 写入 `security_audit.jsonl`。
- 抛出 `GuardrailDeny` 终止当前工具调用。

文章里可以重点写：安全输入检查不要依赖 LLM 判断，因为攻击字符串本身通常是确定性的。

## 策略二：PermissionGate

本地代码：

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/permission_gate.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/workspace/demo_agent/security.yaml`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/tests/test_permission_gate.py`

`PermissionGate` 也是 `BEFORE_TOOL_CALL` 策略。它从 `SECURITY_POLICY_PATH` 指向的 YAML 中读取权限规则。

当前 `security.yaml` 的含义：

- `knowledge_search`、`safe_calculator`：允许。
- `file_reader`：需要确认。
- `shell_executor`、`email_sender`：拒绝。
- 未列出的工具：默认 `ask`。

这里的关键不是 `deny` 本身，而是默认策略。新工具如果没被显式配置，不能直接放行，先进入确认流程。这比“默认全开，出问题再补黑名单”更适合 Agent 工具生态。

文章里可以把它讲成：工具权限表是 Agent 的“运行时防火墙”。

## 策略三：SecureToolWrapper

本地代码：

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/credential_inject.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/tests/test_credential_inject.py`

`SecureToolWrapper` 解决密钥泄露问题。

错误做法是把 API Key 放到 Agent backstory、system prompt、工具 description 或工具参数里。这样 LLM 能看见密钥，也就可能在对话、日志、trace 或工具输出里泄露出去。

当前实现的做法：

1. 原始工具仍然只暴露业务参数。
2. `SecureToolWrapper.wrap(tool, credentials={"api_key": "SECURE_API_KEY"})` 包装工具。
3. wrapper 在 `_run` 执行时从环境变量读取密钥。
4. 合并后的 `kwargs` 只进入工具函数，不进入 LLM 上下文。

这个实现保护的是“模型上下文边界”，不是进程内 Python 对象的物理隔离。生产环境还要配合 secrets manager、进程权限和审计。

## 策略四：SecurityAuditLogger

本地代码：

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/audit_logger.py`

安全事件不能只打在控制台里。`SecurityAuditLogger` 会把事件写成 JSONL：

- 每次权限拒绝。
- 每次输入消毒命中。
- 会话结束时的安全摘要。

它本身先在 `hooks.yaml` 的 strategies 里声明，后面的 `SandboxGuard` 和 `PermissionGate` 通过 `deps` 注入同一个 logger 实例。

这个点适合写成工程细节：多个策略共享同一份审计上下文，不要每个策略各写一套日志。

## Hook 装配方式

本地配置：

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/hooks.yaml`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/hook_framework/loader.py`

`hooks.yaml` 分两段：

- `hooks`：无状态观测函数，来自第 30 讲。
- `strategies`：有状态策略类，来自第 31、32 讲。

第 32 讲新增了 `deps`：

```yaml
strategies:
  - class: audit_logger.SecurityAuditLogger
    config: {}

  - class: sandbox_guard.SandboxGuard
    deps:
      audit: audit_logger

  - class: permission_gate.PermissionGate
    deps:
      audit: audit_logger
```

`HookLoader` 按列表顺序实例化策略，所以被依赖的 `audit_logger` 必须写在前面。这个约束简单，但很清晰：YAML 声明顺序就是运行时依赖顺序。

## 执行顺序

`BEFORE_TOOL_CALL` 的关键顺序是：

1. `structured_log`
2. `langfuse_trace`
3. `SandboxGuard`
4. `PermissionGate`
5. `CostGuard`

安全策略排在可靠性策略前面。理由很直接：如果一个工具调用本身就越权或带有危险输入，应该先被安全层拒绝，不需要再走预算检查。

只要任何策略抛出 `GuardrailDeny`，`dispatch_gate` 就会停止后续 handler，并把拒绝信号向上传播。

相关代码：

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/hook_framework/registry.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/hook_framework/crew_adapter.py`

## Demo 路径

本地入口：

`/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/demo.py`

正常流程：

```bash
cd /Users/youxingzhi/ayou/crewai_mas_demo/m5l32
python3 demo.py
python3 demo.py "为一个短链接服务产出技术设计文档"
```

攻击演示：

```bash
python3 demo.py --attack privilege
python3 demo.py --attack inject
python3 demo.py --attack api-leak
python3 demo.py --budget 0.001
```

四条路径分别验证：

- 正常业务仍然走 Bootstrap + SkillLoader。
- `shell_executor` 会被 `PermissionGate` 拒绝。
- `../../etc/passwd` 会被 `SandboxGuard` 拦截。
- API Key 只在工具执行层注入，LLM trace 里不出现明文。
- 极低预算仍然由第 31 讲的 `CostGuard` 兜底。

## 可写成博客的角度

建议标题：

《别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离》

文章切入：

1. 先用一个对抗任务开场：Prompt 里禁止 shell，但用户任务强制它调用 `shell_executor`。
2. 展示 LLM 仍可能选择调用工具，说明提示词不是安全边界。
3. 从 `BEFORE_TOOL_CALL` 进入 Hook 管道，讲 `dispatch_gate` 如何让安全策略真正能阻断。
4. 依次拆 `SandboxGuard`、`PermissionGate`、`SecureToolWrapper`、`SecurityAuditLogger`。
5. 最后回到三层体系：观测看得见，可靠性刹得住，安全性管得住。

可以保留的观点：

- 可靠性防“蠢”，安全性防“骗”。
- Chatbot 注入主要影响输出，Agent 注入会带来真实副作用。
- Prompt 是建议，Hook 才是运行时边界。
- 安全策略要默认保守，新工具默认 `ask` 比默认 `allow` 更稳。
- API Key 不应该出现在模型上下文里，工具执行层注入是最低成本的隔离方式。

## 文章可能用到的代码点

- `GuardrailDeny`：安全策略拒绝操作的统一信号。
- `dispatch_gate()`：让 `GuardrailDeny` 向上传播，其他 handler 异常仍然隔离。
- `_pending_deny`：处理 CrewAI 回调吞异常问题。
- `deps`：YAML 中的依赖注入机制。
- `security.yaml`：工具权限配置。
- `SecureToolWrapper.wrap()`：运行时凭证注入。
- `security_audit.jsonl`：安全事件审计文件。

## 和当前博客系列的衔接

第 31 讲文章可以落在“Hook 如何从观测升级成干预”，第 32 讲可以继续往前推进一步：干预不只是为了稳定性，也要变成权限边界。

如果后续接第 33 讲 XiaoPaw 系统加固，可以把这篇作为安全机制铺垫：

- 第 32 讲：单独讲安全层设计。
- 第 33 讲：把安全层应用到 XiaoPaw 业务场景。
