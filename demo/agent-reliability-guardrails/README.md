# Agent Reliability Guardrails Demo

JavaScript demo for runtime Agent guardrails: retry tracking, loop detection, and cost control.

## Setup

```bash
cp .env.example .env
npm install
npm run build:sandbox
```

Fill `.env` with an OpenAI-compatible API key and Langfuse keys.

## Run

```bash
npm start
npm start -- "为一个短链接服务产出技术设计文档"
npm run scenario:cost
npm run scenario:loop
npm run scenario:retry
```

## Test

```bash
npm test
```
