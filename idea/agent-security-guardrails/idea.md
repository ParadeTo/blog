我要写一篇新的文章，主题暂定为“别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离”。

请基于这个资料：

./geekbang-101114301-973852-browser-notes.md

./32-security-sandbox-permission-credential.md

以及代码参考：

/Users/youxingzhi/ayou/crewai_mas_demo/m5l32

要求：

1. 不要照抄极客时间原文。
2. 写文章时必须使用 `write-tech-article` skill。
3. 正文实现和示例都要写 **JS 版本**。`m5l32` 只作为概念和结构参考，不直接把 Python demo 当正文主线。
4. 前言和第一节合并，不再放 mock demo。开头从这个问题切入：如果 Agent 被任务骗了，想调用一个不该调用的工具，谁来拦？
5. 重点讲清楚：为什么 Prompt 不是安全边界，Hook / 权限网关才是运行时边界。
6. 文章里要解释这些角色，但用 JS 写法落地：`SandboxGuard`、`PermissionGate`、`SecureToolWrapper`、`SecurityAuditLogger`、`deps`、`dispatch_gate`、`pending_deny`。
7. 观点可以落在：可靠性防“蠢”，安全性防“骗”；Chatbot 注入主要影响输出，Agent 注入会产生真实副作用；不要把安全策略散落在 prompt 或主流程里，而是策略化、Hook 化。
