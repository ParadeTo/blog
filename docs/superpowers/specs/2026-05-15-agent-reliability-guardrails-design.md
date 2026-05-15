# Design: Agent Reliability Guardrails JS Demo

Date: 2026-05-15
Status: approved for planning

## Background

This project will produce the next article and demo in the AI Agent series: a JavaScript implementation of runtime reliability guardrails for an Agent loop.

The previous Langfuse article established observability: we can see LLM calls, tool calls, token usage, and task completion. This new article takes the next step: seeing a problem is not enough; the system must stop itself before a long task collapses, loops, or burns through budget.

The implementation should be a standalone demo, not an extension of the current `demo/xiaoquan` worktree. The current `xiaoquan` code has many active changes, and this article should stay focused on the reliability mechanism itself.

## Goals

- Build a standalone JavaScript demo under `demo/agent-reliability-guardrails/`.
- Use a real LLM, reusing the existing local LLM configuration pattern from the repo.
- Require Langfuse for the article/demo path so traces show both observation and guardrail behavior.
- Demonstrate a JS-native Agent loop with a Hook system that supports both observability and runtime intervention.
- Implement three reliability strategies:
  - `RetryTracker`
  - `CostGuard`
  - `LoopDetector`
- Produce a real output file, `workspace/demo-agent/output/design_doc.md`, from a normal run.
- Provide deterministic test coverage that does not require real LLM calls.
- Write the article as a JavaScript engineering practice. Reader-facing content must not mention or imply that this was ported from another language implementation.

## Non-Goals

- Do not modify `demo/xiaoquan` for this article.
- Do not include a `demo/xiaoquan` comparison section in the article.
- Do not build a broad product or interactive CLI.
- Do not make tests depend on real LLM, Langfuse, network, or API keys.
- Do not copy paid course prose into the article or source files.

## Demo Directory

Create:

```text
demo/agent-reliability-guardrails/
  package.json
  README.md
  .env.example
  src/
    demo.js
    instrumentation.js
    hook-framework/
      registry.js
      loader.js
      agent-adapter.js
    agent/
      real-agent.js
      skill-loader.js
      sandbox.js
  shared-hooks/
    hooks.yaml
    structured-log.js
    langfuse-trace.js
    retry-tracker.js
    cost-guard.js
    loop-detector.js
  workspace/demo-agent/
    soul.md
    user.md
    agent.md
    memory.md
    hooks/
      hooks.yaml
      task-audit.js
    skills/
      load-skills.yaml
      sop-design/
        SKILL.md
    output/
  tests/
```

The directory intentionally mirrors the teaching shape used in the series: runtime code, shared hooks, workspace files, skills, output, and tests are separated.

## Architecture

### Hook Framework

`src/hook-framework/registry.js` owns:

- `EventType`
- `GuardrailDeny`
- `createHookContext`
- `HookRegistry`
- `dispatch`
- `dispatchGate`

`dispatch()` is for observability hooks. Handler errors are caught and logged so tracing/logging cannot break the task.

`dispatchGate()` is for guardrail strategies. Ordinary handler errors are still isolated, but `GuardrailDeny` propagates to the caller and can stop the Agent loop.

This distinction is the core design: observation failures should not break work; guardrail denials must be able to break work.

### Hook Loader

`src/hook-framework/loader.js` loads `hooks.yaml` in two sections:

- `hooks`: stateless observability handlers
- `strategies`: stateful reliability classes

Strategy instances must be preserved so state can be shared across events. For example, a single `CostGuard` instance handles both `AFTER_TURN` and `BEFORE_TOOL_CALL`, sharing accumulated cost.

The loader should reject path traversal and log missing modules or handlers without crashing.

### Agent Adapter

`src/hook-framework/agent-adapter.js` maps the JS Agent loop into these events:

- `BEFORE_TURN`
- `BEFORE_LLM`
- `BEFORE_TOOL_CALL`
- `AFTER_TOOL_CALL`
- `AFTER_TURN`
- `TASK_COMPLETE`
- `SESSION_END`

The JS demo controls its own Agent loop, so guardrail denials should propagate directly from `dispatchGate()` to the outer Agent loop. The call stack should stay simple and readable.

### Guarded Tool Lifecycle

All tool calls should go through one lifecycle helper, conceptually:

1. Emit observability `BEFORE_TOOL_CALL`.
2. Run `dispatchGate(BEFORE_TOOL_CALL)`.
3. Execute the real tool if not denied.
4. Emit observability `AFTER_TOOL_CALL` in success, failure, and denial paths so traces/spans close cleanly.
5. Run `dispatchGate(AFTER_TOOL_CALL)` for result-based strategies.
6. Let `GuardrailDeny` propagate to the outer loop.

This gives the code one readable place where observation, execution, result recording, and guardrail intervention meet.

### Skill Loader, Sub-Task, And Sandbox

`src/agent/skill-loader.js` loads `workspace/demo-agent/skills/load-skills.yaml`, resolves a requested skill, and returns the selected `SKILL.md` content. The default task should use `sop-design/SKILL.md`.

`src/agent/real-agent.js` owns the main Agent loop and a small sub-task runner. The main Agent should decide to load the SOP skill, then the sub-task runner should produce the actual design document. This keeps the demo close to a real Agent workflow without growing into a full multi-agent product.

`src/agent/sandbox.js` provides a constrained execution/write boundary for generated artifacts. For this demo, the sandbox can be a lightweight local boundary that only writes under `workspace/demo-agent/output/` and rejects paths outside that directory. The article should present this as an engineering boundary, not as a full security sandbox.

### Observability Hooks

`shared-hooks/structured-log.js` prints compact JSON records to stderr.

`shared-hooks/langfuse-trace.js` creates:

- a session-level root trace
- generation observations for LLM calls
- tool observations for tool calls
- task-complete observation

On guardrail termination, the trace should still close cleanly and record the denial reason.

### Reliability Strategies

`RetryTracker`

- Mounted on `AFTER_TOOL_CALL`.
- Tracks consecutive failures per tool.
- Tracks total retries and successful recoveries.
- Emits warning/metrics.
- Does not deny by itself.

`CostGuard`

- Mounted on `AFTER_TURN` and `BEFORE_TOOL_CALL`.
- Accumulates input/output tokens.
- Estimates cost from a small model price table.
- Reads budget from config/env, especially `COST_GUARD_BUDGET`.
- Raises `GuardrailDeny` once estimated cost reaches the budget.

`LoopDetector`

- Mounted on `AFTER_TOOL_CALL` and `AFTER_TURN`.
- Computes a hash from tool name plus a short output/state slice.
- Raises `GuardrailDeny` when the latest N states are identical.
- Default threshold should be 3.

## Agent Demo Flow

Default commands:

```bash
cd demo/agent-reliability-guardrails
npm install
npm start
npm start -- "为一个短链接服务产出技术设计文档"
COST_GUARD_BUDGET=0.001 npm start
```

Runtime flow:

1. `src/demo.js` loads `.env`.
2. It resolves real LLM configuration using the same local conventions as existing demos.
3. It starts Langfuse instrumentation.
4. It initializes `HookRegistry` and `HookLoader`.
5. It loads global hooks/strategies and workspace hooks.
6. It builds a workspace bootstrap prompt from `soul.md`, `user.md`, `agent.md`, and `memory.md`.
7. The Agent uses `skill_loader` to load `sop-design/SKILL.md`.
8. A sub-task writes `workspace/demo-agent/output/design_doc.md`.
9. The main loop prints result, output path, Langfuse URL, and guardrail metrics.
10. If a guardrail triggers, the loop prints the denial reason and still runs cleanup.

## Demo Scenarios

Normal task:

- Runs with real LLM.
- Uses the SOP design skill.
- Produces `design_doc.md`.
- Sends a complete trace to Langfuse.

Low-budget task:

- `COST_GUARD_BUDGET=0.001 npm start`
- Triggers `CostGuard`.
- Shows a controlled stop, not a crash.

Loop task:

- Use a deterministic tool or test scenario that returns the same state repeatedly.
- Triggers `LoopDetector` before max-iteration fallback.

Failure tracking task:

- Use a tool that fails repeatedly and then recovers, or a test harness that simulates this.
- Shows `RetryTracker` metrics.

## Article Design

Working title:

`让 Agent 学会自动刹车：重试、循环控制与成本围栏`

Reader-facing article structure:

1. **前言：能看见还不够**  
   Observability shows what happened; reliability stops damage while the task is running.

2. **三个失控场景**  
   Single-step failure, loop, and uncontrolled cost. Each maps to one strategy.

3. **架构：Hook 从日志系统升级成控制面**  
   Explain the JS demo structure, event flow, `HookRegistry`, `dispatch`, and `dispatchGate`.

4. **三个策略**  
   Explain `RetryTracker`, `LoopDetector`, and `CostGuard` with focused code snippets.

5. **跑一次真实任务**  
   Show the command, terminal output, generated `design_doc.md`, and Langfuse trace.

6. **故意触发护栏**  
   Show low-budget cost stop, loop detection, and retry metrics.

7. **结语**  
   Reliability prevents the Agent from acting foolishly: loops, runaway cost, and failure spread. Security is the next layer: sandbox, permission gateway, and authentication.

Article constraints:

- Do not mention another language implementation.
- Do not include a `demo/xiaoquan` section.
- Do not dump long code blocks.
- Use real run output and screenshots where the article claims a result.
- Use `write-tech-article` when writing the article.

## Testing

Use `vitest` or the repo's existing JavaScript test style for this standalone demo.

Required test groups:

1. `HookRegistry`
   - `dispatch()` catches ordinary handler errors.
   - `dispatchGate()` propagates `GuardrailDeny`.
   - `dispatchGate()` catches ordinary handler errors.

2. `HookLoader`
   - Loads stateless hooks.
   - Loads stateful strategies.
   - Preserves strategy instance state across events.
   - Rejects invalid path traversal.

3. Strategies
   - `RetryTracker` records consecutive failure and recovery metrics.
   - `CostGuard` denies once budget is reached.
   - `LoopDetector` denies after repeated state hashes.

4. Agent loop integration
   - Mock LLM + mock tools can run a normal task.
   - Guardrail denial performs cleanup and emits session end.
   - Tool observations close in success, failure, and denial paths.

Tests must not require real API keys.

## Acceptance Criteria

- `npm test` passes inside `demo/agent-reliability-guardrails`.
- `npm start -- "为一个短链接服务产出技术设计文档"` calls the real LLM and writes `workspace/demo-agent/output/design_doc.md`.
- `COST_GUARD_BUDGET=0.001 npm start` triggers `CostGuard` and prints a clear denial reason.
- A loop scenario triggers `LoopDetector` before max iteration.
- A failure scenario produces useful `RetryTracker` metrics.
- Langfuse shows a trace with LLM call, tool call, and task completion or guardrail termination.
- The article references only behavior verified by actual runs.

## Risks

- Real LLM runs may be unstable or slow. Keep tests mocked and use real LLM only for demo/article evidence.
- Langfuse credentials may be missing. The article/demo path requires Langfuse, but errors should be explained clearly.
- A high-fidelity demo can grow large. Keep the business task narrow: generate one technical design document.
- Guardrail output can be noisy. Metrics should be compact and readable.

## Implementation Plan Handoff

After this spec is approved by the user, create an implementation plan using the Superpowers writing-plans workflow. Do not start implementation directly from this design document.
