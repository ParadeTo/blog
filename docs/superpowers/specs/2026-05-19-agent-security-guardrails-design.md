# Design: Agent Security Guardrails JS Demo And Article

Date: 2026-05-19
Status: approved design, revised for JS demo scope

## Background

This project will produce the next JavaScript demo and article in the AI Agent runtime guardrails series.

The previous article, `source/_posts/ai-agent-reliability-guardrails.md`, explains how Hook strategies can stop an Agent when it fails repeatedly, loops, or exceeds budget. This new article continues that line: reliability guardrails keep an Agent from acting foolishly; security guardrails keep an Agent from being tricked into doing dangerous work.

The source material is:

- `idea/agent-security-guardrails/idea.md`
- `idea/agent-security-guardrails/32-security-sandbox-permission-credential.md`
- `/Users/youxingzhi/ayou/crewai_mas_demo/m5l32`
- `demo/agent-reliability-guardrails/`

The Python/CrewAI `m5l32` code is the reference implementation. The deliverable must include a JavaScript version under the blog repo, following the existing `demo/agent-reliability-guardrails` shape where possible. The article should then explain the JavaScript demo, not present itself as a Python code reading note.

The article must not copy paid course prose. It should be based on local code reading, public course metadata, the new JS implementation, and Ayou's own interpretation.

## Goals

- Build a standalone JavaScript demo under `demo/agent-security-guardrails/`.
- Reuse the existing JS reliability demo architecture where it fits: ESM, Vitest, `HookRegistry`, YAML hooks, `dispatchGate`, guarded tool lifecycle, and article-friendly scenario commands.
- Implement JS security strategies:
  - `SandboxGuard`
  - `PermissionGate`
  - `SecurityAuditLogger`
  - `SecureToolWrapper`
- Add loader support for `deps` so multiple strategies can share one audit logger.
- Include deterministic tests for security strategies, dependency injection, and guarded tool-call behavior.
- Include runnable scenarios for:
  - normal flow
  - permission-denied tool call
  - input injection/path traversal
  - credential injection without exposing the secret to the model-facing tool schema
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

- Do not modify `demo/agent-reliability-guardrails/` except as a read-only reference.
- Do not modify `demo/xiaoquan/` for this article.
- Do not run Hexo commands for this task. In particular, do not run `npx hexo generate`, `npx hexo server`, `npx hexo clean`, or deploy commands unless the user later asks.
- Do not create new diagrams in the initial article plan. A simple table is enough unless the user later asks for a visual.
- Do not turn the article into a broad Agent security encyclopedia.
- Do not include full course transcript, subtitle content, or long verbatim course excerpts.
- Do not require real LLM calls in unit tests.
- Do not require Langfuse to pass unit tests.

## Recommended Approach

Use the agreed blend:

1. Build the JS demo first, using `demo/agent-reliability-guardrails/` as the closest local pattern.
2. Start the article with the independent security framing: Agent security is not about "the model says something wrong"; it is about tools creating real side effects.
3. Use the previous reliability article as the main continuation: reliability prevents foolish behavior; security prevents tricked or unauthorized behavior.
4. Close by pointing to the next XiaoPaw hardening article, where these mechanisms can be installed into a more realistic local assistant.

In shorthand: B opens, A carries the article, C closes it.

## JS Demo Directory

Create:

```text
demo/agent-security-guardrails/
  package.json
  README.md
  .env.example
  src/
    demo.js
    hook-framework/
      registry.js
      loader.js
      agent-adapter.js
    agent/
      real-agent.js
  shared-hooks/
    hooks.yaml
    structured-log.js
    sandbox-guard.js
    permission-gate.js
    credential-inject.js
    audit-logger.js
  workspace/demo-agent/
    soul.md
    security.yaml
    security-audit.jsonl (runtime output, gitignored)
  tests/
    registry.test.js
    loader.test.js
    strategies.test.js
    agent-loop.test.js
    e2e.test.js
```

The directory should feel like a direct sibling of `demo/agent-reliability-guardrails/`, but narrower. It does not need to reproduce the full skill-loader/sandbox document generation path. The security demo's core value is the guarded tool lifecycle and strategy behavior.

## JS Demo Architecture

### Hook Framework

Use the existing reliability demo as the starting design:

- `EventType`
- `GuardrailDeny`
- `createHookContext`
- `HookRegistry`
- `dispatch`
- `dispatchGate`

`dispatch()` remains observe-only and catches ordinary handler errors. `dispatchGate()` remains gate-only and propagates `GuardrailDeny`.

### Loader With `deps`

Extend the reliability loader idea for this demo so `strategies` entries can depend on earlier strategy instances:

```yaml
strategies:
  audit-logger:
    class: audit-logger.SecurityAuditLogger
    config:
      auditFile: workspace/demo-agent/security-audit.jsonl

  sandbox-guard:
    class: sandbox-guard.SandboxGuard
    deps:
      audit: audit-logger
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
```

Dependency resolution is ordered. A referenced dependency must have already been instantiated. Missing dependencies should be logged and should prevent that strategy from being instantiated.

### Security Strategies

`SandboxGuard`

- Mounted on `BEFORE_TOOL_CALL`.
- Checks tool input for path traversal, dangerous commands, shell injection, and environment variable references.
- Uses field-sensitive checks:
  - command-like fields: strict shell-injection checks
  - content-like fields: path traversal and dangerous command checks, avoiding Markdown table false positives
- Raises `GuardrailDeny` on blocking violations.
- Records audit events when an audit dependency is present.

`PermissionGate`

- Mounted on `BEFORE_TOOL_CALL`.
- Reads `workspace/demo-agent/security.yaml`.
- Supports `allow`, `ask`, and `deny`.
- Explicit tool policy overrides default policy.
- `deny` raises `GuardrailDeny`.
- `ask` records a decision but allows execution in this demo.

`SecureToolWrapper`

- Wraps a tool definition/executor pair.
- Leaves the model-facing schema unchanged.
- Injects credentials from environment variables at execution time.
- Throws a clear error if a required environment variable is missing.
- Provides credential status without exposing values.

`SecurityAuditLogger`

- Records JSONL security events.
- Writes a session summary on `SESSION_END`.
- Keeps in-memory metrics for tests and demo output.

### Demo Scenarios

Commands:

```bash
cd demo/agent-security-guardrails
npm install
npm test
npm start
npm run attack:privilege
npm run attack:inject
npm run attack:api-leak
```

Scenario behavior:

- `npm start`: runs a safe `knowledge_search` call and prints strategy metrics.
- `npm run attack:privilege`: attempts `shell_executor`; `PermissionGate` denies before execution.
- `npm run attack:inject`: attempts `knowledge_search` with `../../etc/passwd`; `SandboxGuard` denies before execution.
- `npm run attack:api-leak`: wraps `secure_api`; the executor receives the secret from `SECURE_API_KEY`, while the exposed tool schema contains only `query`.

The demo should not require a live LLM for these scenarios. It can use deterministic scripted tool calls so tests and article evidence are stable.

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
date: 2026-05-19 10:00:00
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

Use the JS command `npm run attack:privilege` as the opening case.

Evidence:

- `demo/agent-security-guardrails/workspace/demo-agent/soul.md`
- `demo/agent-security-guardrails/src/demo.js`
- `demo/agent-security-guardrails/src/agent/real-agent.js`

Show that `soul.md` explicitly forbids shell commands, while the privilege attack scenario attempts `shell_executor`.

The point is not "the model always violates prompt rules." The point is that prompt rules cannot be the final boundary when tools can create side effects.

### 二、拦截点在哪里：BEFORE_TOOL_CALL

Return to the Hook lifecycle from the previous article.

`BEFORE_TOOL_CALL` is the best place for tool security because the system can inspect:

- tool name
- tool input
- current session
- strategy state

Evidence:

- `demo/agent-security-guardrails/src/hook-framework/registry.js`
- `demo/agent-security-guardrails/src/hook-framework/agent-adapter.js`
- `demo/agent-security-guardrails/src/agent/real-agent.js`

Explain:

- `dispatch()` isolates ordinary observability errors.
- `dispatch_gate()` propagates `GuardrailDeny`.
- The Python reference used `pending_deny` for CrewAI callback boundaries; the JS demo can explain it as a contrast because the JS call stack can propagate denial directly from `runGuardedToolCall`.

### 三、第一道门：SandboxGuard

Explain input sanitization.

Evidence:

- `demo/agent-security-guardrails/shared-hooks/sandbox-guard.js`

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

- `demo/agent-security-guardrails/shared-hooks/permission-gate.js`
- `demo/agent-security-guardrails/workspace/demo-agent/security.yaml`

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

- `demo/agent-security-guardrails/shared-hooks/credential-inject.js`
- `demo/agent-security-guardrails/src/demo.js`

Cover:

- API keys should not be placed in backstory, prompt, tool description, or tool schema.
- `SecureToolWrapper.wrap()` resolves credentials from environment variables.
- The wrapper injects secrets at `_run()` time.
- The LLM sees business parameters, not the secret value.

Be explicit about the boundary: this protects the model context, not every possible in-process Python inspection path.

### 六、安全事件要留痕

Explain audit logging and dependency injection.

Evidence:

- `demo/agent-security-guardrails/shared-hooks/audit-logger.js`
- `demo/agent-security-guardrails/shared-hooks/hooks.yaml`
- `demo/agent-security-guardrails/src/hook-framework/loader.js`

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
| Prompt vs Hook | JS `soul.md`, `src/demo.js`, `src/agent/real-agent.js` | Show why prompt is not a final security boundary |
| Hook boundary | JS `registry.js`, `agent-adapter.js`, `real-agent.js` | Explain `dispatch_gate`, `GuardrailDeny`, direct JS denial propagation, and Python `pending_deny` contrast |
| SandboxGuard | JS `sandbox-guard.js` | Show deterministic input sanitization |
| PermissionGate | JS `permission-gate.js`, `security.yaml` | Show tool authorization |
| SecureToolWrapper | JS `credential-inject.js`, `src/demo.js` | Show credential injection outside model-facing schema |
| Audit and deps | JS `audit-logger.js`, `hooks.yaml`, `loader.js` | Show shared audit logger and YAML dependency injection |
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

Because the user requested it, implementation must not run Hexo commands for this project.

Allowed checks during implementation:

- JS tests inside `demo/agent-security-guardrails` with `npm test`.
- Targeted JS scenario commands after tests pass.
- Markdown/frontmatter visual inspection with `sed` or `rg`.
- Link/path checks with `rg`.
- Optional git diff review.

Disallowed unless the user later requests it:

- `npx hexo generate`
- `npx hexo server`
- `npx hexo clean`
- `npx hexo deploy`

## Acceptance Criteria

- The JS demo is saved at `demo/agent-security-guardrails/`.
- `npm test` passes inside `demo/agent-security-guardrails`.
- Security scenarios demonstrate permission denial, input sanitization denial, and credential injection.
- Unit tests do not require real LLM, Langfuse, or network calls.
- The article is saved at `source/_posts/ai-agent-security-guardrails.md`.
- The article uses the agreed main title unless the user changes it later.
- The article clearly explains why prompt rules are not a final security boundary.
- The article covers all required concepts from `idea.md`.
- The article does not copy course prose.
- The article does not depend on a new diagram.
- The article does not run Hexo validation commands.
- The ending naturally points to XiaoPaw hardening as the next step.
