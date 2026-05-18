# Agent Reliability Guardrails Demo

JavaScript demo for runtime Agent guardrails: retry tracking, loop detection, and cost control.

## Setup

This standalone demo targets Node 20.19+.

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.5
npm install
npm run build:sandbox
```

Create a local `.env` from `.env.example` if you want persistent settings:

```bash
cp .env.example .env
```

Required runtime environment:

- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: API key for the OpenAI-compatible chat-completions endpoint.
- `OPENAI_API_BASE` or `OPENAI_BASE_URL`: optional endpoint override; defaults to `https://api.openai.com/v1`.
- `AGENT_MODEL` or `OPENAI_MODEL`: optional model override; defaults to `gpt-4o-mini`.
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`: required by the CLI before a run starts.
- `LANGFUSE_BASE_URL` or `LANGFUSE_BASEURL`: optional Langfuse URL override; defaults to `https://cloud.langfuse.com`.
- `COST_GUARD_BUDGET`: optional budget in USD; defaults to `1`.
- `GUARDRAIL_SCENARIO`: optional deterministic scenario selector, currently `loop` or `retry`.

For deterministic local verification where trace upload is not needed, dummy Langfuse keys are enough to start the CLI if `.env` does not contain real Langfuse keys:

```bash
LANGFUSE_PUBLIC_KEY=x LANGFUSE_SECRET_KEY=y npm start
```

Provider settings come from the demo `.env` so unrelated shell defaults do not accidentally select a different endpoint, key, or model. Runtime scenario settings shown in the commands below, such as `COST_GUARD_BUDGET=0.0005`, still take precedence over `.env` for that single run.

Do not commit real API keys or a filled `.env`.

## Verified Scenarios

Successful runs print per-guardrail metric blocks in the format `Metrics: retry-tracker`, `Metrics: cost-guard`, and `Metrics: loop-detector`, followed by `Langfuse URL: ...`.

Build the sandbox image:

```bash
npm run build:sandbox
```

Run the normal real LLM scenario:

```bash
npm start -- "为一个短链接服务产出技术设计文档"
```

Expected result: exit 0, `Design doc:` printed, `workspace/demo-agent/output/design_doc.md` exists, metrics are printed, and a Langfuse URL is printed.

Run the cost guard scenario:

```bash
COST_GUARD_BUDGET=0.0005 npm start
```

Expected result: `Guardrail triggered: Budget exceeded`, a `Metrics: cost-guard` block with `deny_count` incremented, and a Langfuse URL.

Run the deterministic loop scenario:

```bash
GUARDRAIL_SCENARIO=loop npm start -- "反复检查同一个状态，直到你认为可以停止"
```

Expected result: `Guardrail triggered: Loop detected`, `Metrics: loop-detector` with `loop_detections` at least `1`, and a Langfuse URL.

Run the deterministic retry scenario:

```bash
GUARDRAIL_SCENARIO=retry npm start -- "调用不稳定工具并继续完成任务"
```

Expected result: exit 0, a generated design doc, `Metrics: retry-tracker` showing retry recovery, and a Langfuse URL.

Verification note from 2026-05-18: sandbox build, the normal real LLM run, the cost guard run with `COST_GUARD_BUDGET=0.0005`, deterministic loop, and deterministic retry were verified locally. The verification used provider and Langfuse keys from `.env`; no secrets are stored in this repository.

## Test

Run the Vitest suite:

```bash
npm test
```
