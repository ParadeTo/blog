# 极客时间课程公开页面采集快照

> 采集时间：2026-05-19
> 来源：<https://time.geekbang.org/course/detail/101114301-973852>
> 访问状态：未登录公开页面

> 后续补充：已基于已登录的 in-app browser 页面整理了结构化笔记，见 `geekbang-101114301-973852-browser-notes.md`。本文件保留为公开页面采集记录。

## 采集结论

这个页面在未登录状态下可以看到课程目录、第 32 讲标题、时长、播放器入口，以及一小段公开可见的本节摘要。完整视频、完整字幕、完整课程正文属于付费内容，当前没有抓取到，也不应该绕过登录或付费权限去抓。

所以本目录下目前保存的是：

- 本文件：公开页面快照和采集边界说明。
- `geekbang-101114301-973852-browser-notes.md`：基于已登录浏览器页面整理的课程结构化笔记和文章素材。
- `32-security-sandbox-permission-credential.md`：基于公开页面、本地 `m5l32` 代码和测试整理出的写作素材。
- `idea.md`：文章写作需求和初始方向。

## 页面元数据

课程名称：企业级多智能体设计实战

讲师：晓寒（肖汉），前百度资深架构师

页面显示学习人数：4419

页面显示更新进度：已更新 35 讲 / 共 42 讲

第 32 讲：

- 标题：32｜企业安全性：沙箱、权限网关与身份认证
- 所属模块：模块五：企业级加固，确保系统安全可控
- 时长：28:39
- 页面状态：付费课程，可试看

## 公开可见课程脉络

第 32 讲处在模块五。

模块五目前公开目录里有三讲：

| 讲次 | 标题 | 时长 |
| --- | --- | --- |
| 30 | 可观测性：Hook 骨架 + Langfuse 全链路追踪 | 27:46 |
| 31 | 可靠性：重试、循环控制与成本围栏 | 24:36 |
| 32 | 企业安全性：沙箱、权限网关与身份认证 | 28:39 |

这三讲构成一条递进线：

1. 先用 Hook 和追踪系统看见 Agent 每一步。
2. 再用可靠性策略处理重试、循环和预算问题。
3. 最后补安全边界，限制 Agent 工具能力的副作用。

## 公开摘要要点

公开页面能看到的摘要重点是：Agent 安全和 Chatbot 安全不是同一个问题。

Chatbot 的注入风险主要落在输出内容上。Agent 有工具能力以后，风险会进入真实世界：删文件、发请求、泄露数据、安装恶意能力、向群聊发送不该发送的信息。

因此第 32 讲讨论的核心问题不是“让模型回答得更安全”，而是“限制 Agent 使用工具的能力边界”。这和本地代码里的 `SandboxGuard`、`PermissionGate`、`SecureToolWrapper`、`SecurityAuditLogger` 对得上。

## 本地代码对应关系

参考代码目录：

`/Users/youxingzhi/ayou/crewai_mas_demo/m5l32`

关键文件：

| 能力 | 本地文件 |
| --- | --- |
| Hook 分发与 `dispatch_gate` | `hook_framework/registry.py` |
| CrewAI 适配与 `pending_deny` | `hook_framework/crew_adapter.py` |
| 策略加载与 `deps` | `hook_framework/loader.py` |
| 输入消毒 | `shared_hooks/sandbox_guard.py` |
| 权限网关 | `shared_hooks/permission_gate.py` |
| 凭证注入 | `shared_hooks/credential_inject.py` |
| 安全审计 | `shared_hooks/audit_logger.py` |
| 策略配置 | `shared_hooks/hooks.yaml` |
| 工具权限表 | `workspace/demo_agent/security.yaml` |

## 未采集内容

以下内容当前没有采集：

- 完整视频内容
- 完整字幕
- 付费正文
- 课程评论区完整内容

如果需要完整课文，需要在有授权的登录环境里导出页面文本或字幕，再放到 `idea/agent-security-guardrails/` 下。我可以继续整理你提供的导出内容，但不会绕过平台权限抓取付费正文。
