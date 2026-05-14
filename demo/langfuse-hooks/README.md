# Langfuse Hooks JS Demo

这是一个 Node.js demo，用来演示 HookRegistry、两层 Hook 加载、真实 LLM tool calling、结构化日志、Langfuse trace 和任务审计怎么配合起来。

适配层写成框架无关的 `AgentObservabilityAdapter`：任何 agent loop 只要在 LLM、tool、task 这些节点调用它，就能得到同样的 5+2 事件流。

## 运行

```bash
pnpm install
cp .env.example .env
pnpm start
```

LLM 配置默认参考 `demo/xiaoquan`：

```bash
LANGFUSE_HOOKS_OPENAI_API_BASE=http://localhost:3002/v1
LANGFUSE_HOOKS_AGENT_MODEL=gpt-5.4-nano-2026-03-17
```

`LANGFUSE_HOOKS_OPENAI_API_KEY` 为空时，会尝试读取 `ANTHROPIC_API_KEY`。本地开发时，`src/demo.js` 只会从旁边的 `demo/xiaoquan/.env` 借 `ANTHROPIC_API_KEY`，baseURL 和模型仍按上面的默认值走。

没有 Langfuse key 时，demo 仍会：

- 向 stderr 输出结构化 JSON 日志
- 生成 `workspace/demo_agent/output/design_doc.md`
- 写入 `workspace/demo_agent/audit.log`

配置 `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` 和 `LANGFUSE_BASE_URL` 后，再运行 `pnpm start`，可以在 Langfuse 中看到一次 agent run 的 trace 树。

## 目录

```text
langfuse-hooks/
├── src/
│   ├── demo.js                         # Bootstrap + Hook + 离线 agent loop 演示
│   ├── instrumentation.js              # Langfuse JS SDK v5 / OTel 初始化
│   ├── agent/real-agent.js             # OpenAI-compatible chat + tool calling
│   └── hook-framework/
│       ├── registry.js                 # 5+2 EventType + HookContext + HookRegistry
│       ├── loader.js                   # hooks.yaml 解析 + 两层自动加载
│       └── agent-adapter.js            # Agent loop -> HookRegistry 事件映射
├── shared-hooks/
│   ├── hooks.yaml
│   ├── structured-log.js
│   └── langfuse-trace.js
└── workspace/demo_agent/
    ├── soul.md / agent.md / user.md / memory.md
    ├── hooks/
    │   ├── hooks.yaml
    │   └── task-audit.js
    └── skills/
        ├── load_skills.yaml
        └── sop_design/SKILL.md
```

## 5+2 事件

| 事件 | 触发时机 |
|------|----------|
| `before_turn` | 一轮 agent 思考开始 |
| `before_llm` | LLM 调用前 |
| `before_tool_call` | 工具调用前 |
| `after_tool_call` | 工具调用后 |
| `after_turn` | 一轮 agent 思考结束 |
| `task_complete` | 任务完成 |
| `session_end` | flush trace / 清理资源 |
