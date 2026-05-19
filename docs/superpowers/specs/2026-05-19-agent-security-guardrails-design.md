# Design: Agent Security Guardrails Article

Date: 2026-05-19
Status: approved design, pending user spec review

## Background

This project will produce the next article in the AI Agent runtime guardrails series.

The previous article, `source/_posts/ai-agent-reliability-guardrails.md`, explains how Hook strategies can stop an Agent when it fails repeatedly, loops, or exceeds budget. This new article continues that line: reliability guardrails keep an Agent from acting foolishly; security guardrails keep an Agent from being tricked into doing dangerous work.

The source material is:

- `idea/agent-security-guardrails/idea.md`
- `idea/agent-security-guardrails/32-security-sandbox-permission-credential.md`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32`

The article must not copy paid course prose. It should be based on local code reading, public course metadata, and Ayou's own interpretation.

## Goals

- Write a Chinese technical blog article about Agent runtime security guardrails.
- Use a concrete attack demo as the opening thread.
- Explain why prompt rules are not a sufficient security boundary.
- Connect naturally to the previous reliability guardrails article.
- Cover these code concepts:
  - `SandboxGuard`
  - `PermissionGate`
  - `SecureToolWrapper`
  - `SecurityAuditLogger`
  - `deps`
  - `dispatch_gate`
  - `pending_deny`
- End by setting up the next XiaoPaw hardening article.

## Non-Goals

- Do not write or modify the article during this brainstorming/spec phase.
- Do not run Hexo commands for this task. In particular, do not run `npx hexo generate`, `npx hexo server`, `npx hexo clean`, or deploy commands unless the user later asks.
- Do not create new diagrams in the initial article plan. A simple table is enough unless the user later asks for a visual.
- Do not turn the article into a broad Agent security encyclopedia.
- Do not include full course transcript, subtitle content, or long verbatim course excerpts.

## Recommended Approach

Use the agreed blend:

1. Start with the independent security framing: Agent security is not about "the model says something wrong"; it is about tools creating real side effects.
2. Use the previous reliability article as the main continuation: reliability prevents foolish behavior; security prevents tricked or unauthorized behavior.
3. Close by pointing to the next XiaoPaw hardening article, where these mechanisms can be installed into a more realistic local assistant.

In shorthand: B opens, A carries the article, C closes it.

## Article Title

Primary title:

```text
别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离
```

Alternates:

```text
Agent 安全不能只靠 Prompt：从工具权限到凭证隔离
给 Agent 加安全门禁：SandboxGuard、PermissionGate 和密钥注入
```

Target file when implementation begins:

```text
source/_posts/ai-agent-security-guardrails.md
```

Suggested frontmatter:

```yaml
---
title: 别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离
date: 2026-05-19 HH:MM:SS
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用一个 Agent 对抗任务拆解运行时安全护栏：工具参数怎么消毒，权限怎么拦，API Key 怎么不进模型上下文。
---
```

## Article Structure

### 前言

Open with the distinction between Chatbot security and Agent security.

Chatbot failures mainly affect output. Agent failures can read files, delete files, leak API keys, send messages, or call dangerous tools. Then connect to the previous article:

- The Langfuse article made Agent behavior visible.
- The reliability article added runtime brakes.
- This article adds runtime security boundaries.

Use the phrase "可靠性防蠢，安全性防骗" as the article's compact framing.

### 一、Prompt 禁止了，为什么还要 Hook 拦？

Use `python3 demo.py --attack privilege` as the opening case.

Evidence:

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/workspace/demo_agent/soul.md`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/demo.py`

Show that `soul.md` explicitly forbids shell commands, while `run_attack_privilege()` creates pressure to call `shell_executor`.

The point is not "the model always violates prompt rules." The point is that prompt rules cannot be the final boundary when tools can create side effects.

### 二、拦截点在哪里：BEFORE_TOOL_CALL

Return to the Hook lifecycle from the previous article.

`BEFORE_TOOL_CALL` is the best place for tool security because the system can inspect:

- tool name
- tool input
- current session
- strategy state

Evidence:

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/hook_framework/registry.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/hook_framework/crew_adapter.py`

Explain:

- `dispatch()` isolates ordinary observability errors.
- `dispatch_gate()` propagates `GuardrailDeny`.
- `pending_deny` handles CrewAI callback boundaries so a denial is not swallowed.

### 三、第一道门：SandboxGuard

Explain input sanitization.

Evidence:

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/sandbox_guard.py`

Cover:

- path traversal
- dangerous commands
- shell injection
- environment variable references
- command fields versus content fields

The key engineering detail is field-sensitive checking. Command-like fields are strict; content fields avoid false positives such as Markdown tables containing `|`.

The conclusion: deterministic attack strings should be handled by deterministic rules, not by asking the LLM whether something is dangerous.

### 四、第二道门：PermissionGate

Explain tool-level authorization.

Evidence:

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/permission_gate.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/workspace/demo_agent/security.yaml`

Cover:

- `allow`
- `ask`
- `deny`
- explicit policy versus default policy
- `SECURITY_POLICY_PATH`

Emphasize the default policy. New tools should not be allowed just because nobody remembered to classify them. Default `ask` is the safer baseline.

### 五、第三道门：SecureToolWrapper

Explain credential isolation.

Evidence:

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/credential_inject.py`
- `run_attack_api_leak()` in `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/demo.py`

Cover:

- API keys should not be placed in backstory, prompt, tool description, or tool schema.
- `SecureToolWrapper.wrap()` resolves credentials from environment variables.
- The wrapper injects secrets at `_run()` time.
- The LLM sees business parameters, not the secret value.

Be explicit about the boundary: this protects the model context, not every possible in-process Python inspection path.

### 六、安全事件要留痕

Explain audit logging and dependency injection.

Evidence:

- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/audit_logger.py`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/shared_hooks/hooks.yaml`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32/hook_framework/loader.py`

Cover:

- `SecurityAuditLogger`
- `security_audit.jsonl`
- session summary
- `deps`
- why `audit_logger` must be declared before `SandboxGuard` and `PermissionGate`

This section should be short and practical: security decisions should leave evidence, and multiple strategies should share one audit logger rather than each writing its own log format.

### 七、三层护栏

Close the article by summarizing the series:

```text
L30 可观测性：看得见
L31 可靠性：刹得住
L32 安全性：管得住
```

Then bridge to the next article:

This article isolates the security layer. The next step is to install these mechanisms into XiaoPaw so the local assistant has observability, reliability, and security in the same runtime.

## Evidence Map

| Section | Main Files | Purpose |
| --- | --- | --- |
| Prompt vs Hook | `soul.md`, `demo.py` | Show why prompt is not a final security boundary |
| Hook boundary | `registry.py`, `crew_adapter.py` | Explain `dispatch_gate`, `GuardrailDeny`, `pending_deny` |
| SandboxGuard | `sandbox_guard.py` | Show deterministic input sanitization |
| PermissionGate | `permission_gate.py`, `security.yaml` | Show tool authorization |
| SecureToolWrapper | `credential_inject.py`, `demo.py` | Show credential injection outside LLM context |
| Audit and deps | `audit_logger.py`, `hooks.yaml`, `loader.py` | Show shared audit logger and YAML dependency injection |
| Series summary | previous article + `hooks.yaml` | Connect L30/L31/L32 |

## Writing Style

- Chinese article.
- Ayou style: problem first, code evidence second, short recap last.
- Keep the opening concrete and slightly tense: a prompt rule says "never run shell", but the task pushes the Agent toward a shell tool.
- Use short paragraphs.
- Prefer small code snippets over large pasted source blocks.
- Each major section should answer "why this exists" before "how the code works."
- Do not over-polish into official documentation tone.

## Code Snippet Budget

Keep code blocks focused:

- `soul.md` security prohibitions: one short excerpt.
- `dispatch_gate`: one short excerpt or paraphrased structure.
- `SandboxGuard`: one snippet for field categories or check order.
- `PermissionGate`: one snippet for deny/ask/allow behavior or `security.yaml`.
- `SecureToolWrapper`: one short wrapper snippet.
- `deps`: one short YAML snippet.

Everything else should be explained in prose or tables.

## Verification Constraints

Because the user requested it, implementation must not run Hexo commands for this article task.

Allowed checks during implementation:

- Markdown/frontmatter visual inspection with `sed` or `rg`.
- Link/path checks with `rg`.
- Optional git diff review.

Disallowed unless the user later requests it:

- `npx hexo generate`
- `npx hexo server`
- `npx hexo clean`
- `npx hexo deploy`

## Acceptance Criteria

- The article is saved at `source/_posts/ai-agent-security-guardrails.md`.
- The article uses the agreed main title unless the user changes it later.
- The article clearly explains why prompt rules are not a final security boundary.
- The article covers all required concepts from `idea.md`.
- The article does not copy course prose.
- The article does not depend on a new diagram.
- The article does not run Hexo validation commands.
- The ending naturally points to XiaoPaw hardening as the next step.
