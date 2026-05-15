# Agent Reliability Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone JavaScript demo and article showing runtime reliability guardrails for an Agent loop: retry tracking, loop detection, and cost control.

**Architecture:** Create `demo/agent-reliability-guardrails/` as an independent Node.js ESM project. The demo has a small hook framework, stateful guardrail strategies, Langfuse observability hooks, a workspace/skill-based real Agent loop, Podman-backed sandbox execution, deterministic tests, and a follow-up blog article based on real runs.

**Tech Stack:** Node.js ESM, Vitest, YAML, OpenAI-compatible chat completions over `fetch`, Langfuse JS/OTel packages, Podman sandbox, Hexo Markdown.

---

## File Map

| Path | Responsibility |
| --- | --- |
| `demo/agent-reliability-guardrails/package.json` | Standalone npm scripts and dependencies |
| `demo/agent-reliability-guardrails/.env.example` | Required LLM/Langfuse/sandbox config |
| `demo/agent-reliability-guardrails/README.md` | How to run normal and guardrail scenarios |
| `demo/agent-reliability-guardrails/Dockerfile.sandbox` | Minimal sandbox image |
| `demo/agent-reliability-guardrails/src/hook-framework/registry.js` | Event types, context factory, `GuardrailDeny`, `HookRegistry` |
| `demo/agent-reliability-guardrails/src/hook-framework/loader.js` | YAML loader for `hooks` and `strategies` |
| `demo/agent-reliability-guardrails/src/hook-framework/agent-adapter.js` | Maps Agent loop events to hook contexts |
| `demo/agent-reliability-guardrails/src/instrumentation.js` | Langfuse SDK lifecycle |
| `demo/agent-reliability-guardrails/shared-hooks/structured-log.js` | JSON stderr logging |
| `demo/agent-reliability-guardrails/shared-hooks/langfuse-trace.js` | Langfuse trace/generation/tool/task observations |
| `demo/agent-reliability-guardrails/shared-hooks/retry-tracker.js` | Failure/retry metrics |
| `demo/agent-reliability-guardrails/shared-hooks/cost-guard.js` | Runtime token budget |
| `demo/agent-reliability-guardrails/shared-hooks/loop-detector.js` | Repeated-state guardrail |
| `demo/agent-reliability-guardrails/shared-hooks/hooks.yaml` | Global hooks and strategy registrations |
| `demo/agent-reliability-guardrails/src/agent/skill-loader.js` | Loads skill registry and skill Markdown |
| `demo/agent-reliability-guardrails/src/agent/sandbox.js` | Podman sandbox wrapper |
| `demo/agent-reliability-guardrails/src/agent/real-agent.js` | Real LLM loop, tools, guarded tool calls |
| `demo/agent-reliability-guardrails/src/demo.js` | CLI entry point and scenario orchestration |
| `demo/agent-reliability-guardrails/workspace/demo-agent/**` | Workspace four files, hooks, skill, output |
| `demo/agent-reliability-guardrails/tests/*.test.js` | Unit and integration tests |
| `source/_posts/ai-agent-reliability-guardrails.md` | Final article |
| `source/_posts/ai-agent-reliability-guardrails/` | Article screenshots/assets |

---

### Task 1: Scaffold The Standalone Demo

**Files:**
- Create: `demo/agent-reliability-guardrails/package.json`
- Create: `demo/agent-reliability-guardrails/.env.example`
- Create: `demo/agent-reliability-guardrails/Dockerfile.sandbox`
- Create: `demo/agent-reliability-guardrails/README.md`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/output/.gitkeep`

- [ ] **Step 1: Create directories**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
mkdir -p demo/agent-reliability-guardrails/{src/hook-framework,src/agent,shared-hooks,tests,workspace/demo-agent/{hooks,skills/sop-design,output}}
```

Expected: directories exist and `find demo/agent-reliability-guardrails -maxdepth 3 -type d` shows `src`, `shared-hooks`, `tests`, and `workspace/demo-agent`.

- [ ] **Step 2: Create `package.json`**

Create `demo/agent-reliability-guardrails/package.json`:

```json
{
  "name": "agent-reliability-guardrails-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/demo.js",
    "scenario:cost": "COST_GUARD_BUDGET=0.001 node src/demo.js",
    "scenario:loop": "GUARDRAIL_SCENARIO=loop node src/demo.js",
    "scenario:retry": "GUARDRAIL_SCENARIO=retry node src/demo.js",
    "test": "vitest run",
    "build:sandbox": "podman build -f Dockerfile.sandbox -t agent-reliability-sandbox ."
  },
  "dependencies": {
    "@langfuse/otel": "^5.3.0",
    "@langfuse/tracing": "^5.3.0",
    "@opentelemetry/sdk-node": "^0.218.0",
    "dotenv": "^17.4.2",
    "yaml": "^2.9.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 3: Create `.env.example`**

Create `demo/agent-reliability-guardrails/.env.example`:

```bash
OPENAI_API_KEY=
OPENAI_API_BASE=https://api.openai.com/v1
AGENT_MODEL=gpt-4o-mini

LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=http://localhost:3000
LANGFUSE_TRACING_ENVIRONMENT=local

COST_GUARD_BUDGET=1
LOOP_DETECTOR_THRESHOLD=3
SANDBOX_IMAGE=agent-reliability-sandbox:latest
SANDBOX_TIMEOUT_MS=30000
```

- [ ] **Step 4: Create `Dockerfile.sandbox`**

Create `demo/agent-reliability-guardrails/Dockerfile.sandbox`:

```dockerfile
FROM node:20-alpine
WORKDIR /workspace
RUN adduser -D sandbox
USER sandbox
```

- [ ] **Step 5: Create initial README**

Create `demo/agent-reliability-guardrails/README.md`:

```markdown
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
```

- [ ] **Step 6: Keep output directory**

Run:

```bash
touch /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails/workspace/demo-agent/output/.gitkeep
```

- [ ] **Step 7: Install dependencies**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm install
```

Expected: `package-lock.json` and `node_modules/` are created.

- [ ] **Step 8: Commit scaffold**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/package.json \
  demo/agent-reliability-guardrails/package-lock.json \
  demo/agent-reliability-guardrails/.env.example \
  demo/agent-reliability-guardrails/Dockerfile.sandbox \
  demo/agent-reliability-guardrails/README.md \
  demo/agent-reliability-guardrails/workspace/demo-agent/output/.gitkeep
git commit -m "feat: scaffold agent reliability guardrails demo"
```

---

### Task 2: Hook Registry With Guardrail Propagation

**Files:**
- Create: `demo/agent-reliability-guardrails/src/hook-framework/registry.js`
- Create: `demo/agent-reliability-guardrails/tests/registry.test.js`

- [ ] **Step 1: Write failing registry tests**

Create `demo/agent-reliability-guardrails/tests/registry.test.js`:

```js
import { describe, expect, it, vi } from 'vitest'
import {
  EventType,
  GuardrailDeny,
  HookRegistry,
  createHookContext,
  normalizeEventType,
} from '../src/hook-framework/registry.js'

describe('HookRegistry', () => {
  it('normalizes known event names', () => {
    expect(normalizeEventType('BEFORE_TURN')).toBe(EventType.BEFORE_TURN)
    expect(normalizeEventType('before_llm')).toBe(EventType.BEFORE_LLM)
  })

  it('rejects unknown event names', () => {
    expect(() => normalizeEventType('missing')).toThrow('unknown hook event')
  })

  it('dispatch catches ordinary handler errors and keeps going', async () => {
    const logger = vi.fn()
    const registry = new HookRegistry({ logger })
    const good = vi.fn()
    registry.register(EventType.BEFORE_TURN, () => {
      throw new Error('boom')
    }, 'bad')
    registry.register(EventType.BEFORE_TURN, good, 'good')

    await registry.dispatch(
      EventType.BEFORE_TURN,
      createHookContext({ eventType: EventType.BEFORE_TURN, sessionId: 's1' }),
    )

    expect(good).toHaveBeenCalledOnce()
    expect(logger).toHaveBeenCalledOnce()
  })

  it('dispatchGate propagates GuardrailDeny', async () => {
    const registry = new HookRegistry()
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      throw new GuardrailDeny('budget exceeded', { guardrail: 'cost_guard' })
    })

    await expect(
      registry.dispatchGate(
        EventType.BEFORE_TOOL_CALL,
        createHookContext({ eventType: EventType.BEFORE_TOOL_CALL }),
      ),
    ).rejects.toMatchObject({ reason: 'budget exceeded' })
  })

  it('dispatchGate catches ordinary errors and continues', async () => {
    const logger = vi.fn()
    const registry = new HookRegistry({ logger })
    const good = vi.fn()
    registry.register(EventType.AFTER_TOOL_CALL, () => {
      throw new Error('handler broke')
    }, 'bad')
    registry.register(EventType.AFTER_TOOL_CALL, good, 'good')

    await registry.dispatchGate(
      EventType.AFTER_TOOL_CALL,
      createHookContext({ eventType: EventType.AFTER_TOOL_CALL }),
    )

    expect(good).toHaveBeenCalledOnce()
    expect(logger).toHaveBeenCalledOnce()
  })

  it('returns handler summaries', () => {
    const registry = new HookRegistry()
    registry.register(EventType.AFTER_TURN, () => {}, 'h1')
    registry.register(EventType.AFTER_TURN, () => {}, 'h2')

    expect(registry.handlerCount(EventType.AFTER_TURN)).toBe(2)
    expect(registry.summary().after_turn).toEqual(['h1', 'h2'])
  })
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/registry.test.js
```

Expected: FAIL because `src/hook-framework/registry.js` does not exist.

- [ ] **Step 3: Implement registry**

Create `demo/agent-reliability-guardrails/src/hook-framework/registry.js`:

```js
export const EventType = Object.freeze({
  BEFORE_TURN: 'before_turn',
  BEFORE_LLM: 'before_llm',
  BEFORE_TOOL_CALL: 'before_tool_call',
  AFTER_TOOL_CALL: 'after_tool_call',
  AFTER_TURN: 'after_turn',
  TASK_COMPLETE: 'task_complete',
  SESSION_END: 'session_end',
})

const EVENT_VALUES = new Set(Object.values(EventType))

export class GuardrailDeny extends Error {
  constructor(reason, metadata = {}) {
    super(reason)
    this.name = 'GuardrailDeny'
    this.reason = reason
    this.metadata = metadata
  }
}

export function normalizeEventType(eventType) {
  const normalized = String(eventType ?? '').trim().toLowerCase()
  if (Object.hasOwn(EventType, String(eventType ?? '').trim())) {
    return EventType[String(eventType).trim()]
  }
  if (!EVENT_VALUES.has(normalized)) {
    throw new Error(`unknown hook event: ${eventType}`)
  }
  return normalized
}

export function createHookContext(fields = {}) {
  const eventType = normalizeEventType(fields.eventType)
  return {
    eventType,
    timestamp: fields.timestamp ?? new Date().toISOString(),
    agentId: fields.agentId ?? '',
    taskName: fields.taskName ?? '',
    toolName: fields.toolName ?? '',
    toolInput: fields.toolInput ?? {},
    inputTokens: fields.inputTokens ?? 0,
    outputTokens: fields.outputTokens ?? 0,
    durationMs: fields.durationMs ?? 0,
    success: fields.success ?? true,
    sessionId: fields.sessionId ?? '',
    turnNumber: fields.turnNumber ?? 0,
    metadata: fields.metadata ?? {},
  }
}

export class HookRegistry {
  constructor({ logger = console.error } = {}) {
    this.handlers = new Map()
    this.handlerNames = new Map()
    this.logger = logger
  }

  register(eventType, handler, name = '') {
    const normalized = normalizeEventType(eventType)
    const handlers = this.handlers.get(normalized) ?? []
    const names = this.handlerNames.get(normalized) ?? []
    handlers.push(handler)
    names.push(name || handler.name || '<anonymous>')
    this.handlers.set(normalized, handlers)
    this.handlerNames.set(normalized, names)
  }

  async dispatch(eventType, context) {
    const normalized = normalizeEventType(eventType)
    const handlers = this.handlers.get(normalized) ?? []
    for (const handler of handlers) {
      try {
        await handler(context)
      } catch (error) {
        this.logger(`[HookRegistry] ${normalized} handler error: ${error.stack || error.message}`)
      }
    }
  }

  async dispatchGate(eventType, context) {
    const normalized = normalizeEventType(eventType)
    const handlers = this.handlers.get(normalized) ?? []
    for (const handler of handlers) {
      try {
        await handler(context)
      } catch (error) {
        if (error instanceof GuardrailDeny) throw error
        this.logger(`[HookRegistry] ${normalized} handler error: ${error.stack || error.message}`)
      }
    }
  }

  handlerCount(eventType) {
    return (this.handlers.get(normalizeEventType(eventType)) ?? []).length
  }

  summary() {
    const result = {}
    for (const [eventType, names] of this.handlerNames.entries()) {
      if (names.length > 0) result[eventType] = [...names]
    }
    return result
  }
}
```

- [ ] **Step 4: Run registry tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/registry.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit registry**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/src/hook-framework/registry.js \
  demo/agent-reliability-guardrails/tests/registry.test.js
git commit -m "feat: add guardrail-aware hook registry"
```

---

### Task 3: Hook Loader With Stateful Strategies

**Files:**
- Create: `demo/agent-reliability-guardrails/src/hook-framework/loader.js`
- Create: `demo/agent-reliability-guardrails/tests/loader.test.js`

- [ ] **Step 1: Write failing loader tests**

Create `demo/agent-reliability-guardrails/tests/loader.test.js`:

```js
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { HookLoader } from '../src/hook-framework/loader.js'
import { EventType, HookRegistry, createHookContext } from '../src/hook-framework/registry.js'

async function makeDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'guardrails-loader-'))
}

describe('HookLoader', () => {
  it('loads stateless hooks from hooks.yaml', async () => {
    const root = await makeDir()
    await fs.writeFile(
      path.join(root, 'hooks.yaml'),
      ['hooks:', '  BEFORE_TURN:', '    - handler: observer.onTurn', ''].join('\n'),
    )
    await fs.writeFile(path.join(root, 'observer.js'), 'export function onTurn(ctx) { ctx.metadata.hit.push("observer") }\n')

    const registry = new HookRegistry()
    const loader = new HookLoader(registry)
    await loader.loadFromDirectory(root, 'global')

    const ctx = createHookContext({ eventType: EventType.BEFORE_TURN, metadata: { hit: [] } })
    await registry.dispatch(EventType.BEFORE_TURN, ctx)
    expect(ctx.metadata.hit).toEqual(['observer'])
  })

  it('loads stateful strategies and shares instance state across events', async () => {
    const root = await makeDir()
    await fs.writeFile(
      path.join(root, 'hooks.yaml'),
      [
        'strategies:',
        '  - class: counter.CounterStrategy',
        '    config:',
        '      label: cost',
        '    hooks:',
        '      BEFORE_TOOL_CALL: beforeTool',
        '      AFTER_TURN: afterTurn',
        '',
      ].join('\n'),
    )
    await fs.writeFile(
      path.join(root, 'counter.js'),
      [
        'export class CounterStrategy {',
        '  constructor({ label }) { this.label = label; this.count = 0 }',
        '  beforeTool(ctx) { this.count += 1 }',
        '  afterTurn(ctx) { this.count += 1 }',
        '  getMetrics() { return { label: this.label, count: this.count } }',
        '}',
        '',
      ].join('\n'),
    )

    const registry = new HookRegistry()
    const loader = new HookLoader(registry)
    await loader.loadFromDirectory(root, 'global')

    await registry.dispatchGate(EventType.BEFORE_TOOL_CALL, createHookContext({ eventType: EventType.BEFORE_TOOL_CALL }))
    await registry.dispatchGate(EventType.AFTER_TURN, createHookContext({ eventType: EventType.AFTER_TURN }))

    expect(loader.strategies.counter.getMetrics()).toEqual({ label: 'cost', count: 2 })
  })

  it('rejects handler path traversal', async () => {
    const logger = vi.fn()
    const root = await makeDir()
    await fs.writeFile(
      path.join(root, 'hooks.yaml'),
      ['hooks:', '  BEFORE_TURN:', '    - handler: ../evil.onTurn', ''].join('\n'),
    )

    const registry = new HookRegistry({ logger })
    const loader = new HookLoader(registry, { logger })
    await loader.loadFromDirectory(root, 'global')

    expect(registry.handlerCount(EventType.BEFORE_TURN)).toBe(0)
    expect(logger).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing loader tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/loader.test.js
```

Expected: FAIL because `loader.js` does not exist.

- [ ] **Step 3: Implement loader**

Create `demo/agent-reliability-guardrails/src/hook-framework/loader.js`:

```js
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'
import { normalizeEventType } from './registry.js'

function isInside(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function splitRef(ref) {
  const value = String(ref ?? '')
  const index = value.lastIndexOf('.')
  if (index <= 0 || index === value.length - 1) return null
  return [value.slice(0, index), value.slice(index + 1)]
}

export class HookLoader {
  constructor(registry, { logger = console.error } = {}) {
    this.registry = registry
    this.logger = logger
    this.moduleCache = new Map()
    this._strategies = {}
  }

  get strategies() {
    return { ...this._strategies }
  }

  async loadTwoLayers(globalDir, workspaceDir) {
    await this.loadFromDirectory(globalDir, 'global')
    await this.loadFromDirectory(path.join(workspaceDir, 'hooks'), 'workspace')
  }

  async loadFromDirectory(hooksDir, layerName = '') {
    const yamlPath = path.join(hooksDir, 'hooks.yaml')
    let raw
    try {
      raw = await fs.readFile(yamlPath, 'utf8')
    } catch {
      return
    }
    const config = YAML.parse(raw) ?? {}

    await this.loadHooks(hooksDir, layerName, config.hooks ?? {})
    await this.loadStrategies(hooksDir, layerName, config.strategies ?? [])
  }

  async loadHooks(hooksDir, layerName, hooks) {
    for (const [eventName, handlerList] of Object.entries(hooks)) {
      let eventType
      try {
        eventType = normalizeEventType(eventName)
      } catch (error) {
        this.logger(`[HookLoader] ${error.message}`)
        continue
      }
      for (const entry of handlerList ?? []) {
        const parts = splitRef(entry.handler)
        if (!parts) {
          this.logger(`[HookLoader] invalid handler: ${entry.handler}`)
          continue
        }
        const [moduleName, funcName] = parts
        const module = await this.loadModule(hooksDir, moduleName)
        if (!module) continue
        const handler = module[funcName]
        if (typeof handler !== 'function') {
          this.logger(`[HookLoader] function not found: ${entry.handler}`)
          continue
        }
        this.registry.register(eventType, handler, `[${layerName}] ${entry.handler}`)
      }
    }
  }

  async loadStrategies(hooksDir, layerName, strategies) {
    for (const entry of strategies ?? []) {
      const parts = splitRef(entry.class)
      if (!parts) {
        this.logger(`[HookLoader] invalid strategy class: ${entry.class}`)
        continue
      }
      const [moduleName, className] = parts
      const module = await this.loadModule(hooksDir, moduleName)
      if (!module) continue
      const StrategyClass = module[className]
      if (typeof StrategyClass !== 'function') {
        this.logger(`[HookLoader] class not found: ${entry.class}`)
        continue
      }
      let instance
      try {
        instance = new StrategyClass(entry.config ?? {})
      } catch (error) {
        this.logger(`[HookLoader] failed to instantiate ${entry.class}: ${error.message}`)
        continue
      }
      for (const [eventName, methodName] of Object.entries(entry.hooks ?? {})) {
        let eventType
        try {
          eventType = normalizeEventType(eventName)
        } catch (error) {
          this.logger(`[HookLoader] ${error.message}`)
          continue
        }
        const handler = instance[methodName]?.bind(instance)
        if (typeof handler !== 'function') {
          this.logger(`[HookLoader] method not found: ${entry.class}.${methodName}`)
          continue
        }
        this.registry.register(eventType, handler, `[${layerName}] ${entry.class}.${methodName}`)
      }
      this._strategies[moduleName] = instance
    }
  }

  async loadModule(hooksDir, moduleName) {
    const root = path.resolve(hooksDir)
    const modulePath = path.resolve(root, `${moduleName}.js`)
    if (!isInside(root, modulePath)) {
      this.logger(`[HookLoader] path traversal blocked: ${moduleName}`)
      return null
    }
    try {
      await fs.access(modulePath)
    } catch {
      this.logger(`[HookLoader] module not found: ${modulePath}`)
      return null
    }
    if (this.moduleCache.has(modulePath)) return this.moduleCache.get(modulePath)
    const module = await import(pathToFileURL(modulePath).href)
    this.moduleCache.set(modulePath, module)
    return module
  }
}
```

- [ ] **Step 4: Run loader tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/loader.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit loader**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/src/hook-framework/loader.js \
  demo/agent-reliability-guardrails/tests/loader.test.js
git commit -m "feat: load hook strategies from yaml"
```

---

### Task 4: Reliability Strategies

**Files:**
- Create: `demo/agent-reliability-guardrails/shared-hooks/retry-tracker.js`
- Create: `demo/agent-reliability-guardrails/shared-hooks/cost-guard.js`
- Create: `demo/agent-reliability-guardrails/shared-hooks/loop-detector.js`
- Create: `demo/agent-reliability-guardrails/tests/strategies.test.js`

- [ ] **Step 1: Write failing strategy tests**

Create `demo/agent-reliability-guardrails/tests/strategies.test.js`:

```js
import { describe, expect, it, vi } from 'vitest'
import { EventType, GuardrailDeny, createHookContext } from '../src/hook-framework/registry.js'
import { RetryTracker } from '../shared-hooks/retry-tracker.js'
import { CostGuard } from '../shared-hooks/cost-guard.js'
import { LoopDetector } from '../shared-hooks/loop-detector.js'

describe('RetryTracker', () => {
  it('tracks consecutive failure and recovery metrics', () => {
    const logger = vi.fn()
    const tracker = new RetryTracker({ maxRetries: 2, logger })
    const failCtx = createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      toolName: 'search',
      success: false,
    })
    const okCtx = createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      toolName: 'search',
      success: true,
    })

    tracker.afterToolHandler(failCtx)
    tracker.afterToolHandler(failCtx)
    tracker.afterToolHandler(okCtx)

    expect(logger).toHaveBeenCalled()
    expect(tracker.getMetrics()).toMatchObject({
      total_retries: 1,
      successful_retries: 1,
      retry_success_rate: 1,
    })
  })
})

describe('CostGuard', () => {
  it('denies when estimated cost reaches budget', () => {
    const guard = new CostGuard({
      budgetUsd: 0.000001,
      model: 'gpt-4o-mini',
      logger: () => {},
    })
    const ctx = createHookContext({
      eventType: EventType.AFTER_TURN,
      inputTokens: 1000,
      outputTokens: 1000,
      turnNumber: 1,
    })

    expect(() => guard.afterTurnHandler(ctx)).toThrow(GuardrailDeny)
    expect(guard.getMetrics().deny_count).toBe(1)
  })
})

describe('LoopDetector', () => {
  it('denies after repeated tool states', () => {
    const detector = new LoopDetector({ threshold: 3, logger: () => {} })
    const ctx = createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      toolName: 'lookup',
      metadata: { toolOutput: 'same result' },
      turnNumber: 1,
    })

    detector.afterToolHandler(ctx)
    detector.afterToolHandler(ctx)
    expect(() => detector.afterToolHandler(ctx)).toThrow(GuardrailDeny)
    expect(detector.getMetrics().loop_detections).toBe(1)
  })
})
```

- [ ] **Step 2: Run failing strategy tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/strategies.test.js
```

Expected: FAIL because strategy files do not exist.

- [ ] **Step 3: Implement `RetryTracker`**

Create `demo/agent-reliability-guardrails/shared-hooks/retry-tracker.js`:

```js
export class RetryTracker {
  constructor({ maxRetries = 3, logger = console.error } = {}) {
    this.maxRetries = maxRetries
    this.logger = logger
    this.failures = new Map()
    this.totalRetries = 0
    this.successfulRetries = 0
  }

  afterToolHandler(ctx) {
    const tool = ctx.toolName
    if (!tool) return

    if (!ctx.success) {
      const previous = this.failures.get(tool) ?? 0
      const current = previous + 1
      this.failures.set(tool, current)
      if (previous > 0) this.totalRetries += 1
      if (current >= this.maxRetries) {
        this.logger(JSON.stringify({
          level: 'WARNING',
          guardrail: 'retry_tracker',
          message: `Tool '${tool}' failed ${current} times consecutively`,
          tool,
          consecutive_failures: current,
          max_retries: this.maxRetries,
        }))
      }
      return
    }

    if ((this.failures.get(tool) ?? 0) > 0) this.successfulRetries += 1
    this.failures.set(tool, 0)
  }

  getMetrics() {
    return {
      total_retries: this.totalRetries,
      successful_retries: this.successfulRetries,
      retry_success_rate: Number((this.successfulRetries / Math.max(this.totalRetries, 1)).toFixed(2)),
      active_failures: Object.fromEntries(this.failures),
    }
  }
}
```

- [ ] **Step 4: Implement `CostGuard`**

Create `demo/agent-reliability-guardrails/shared-hooks/cost-guard.js`:

```js
import { GuardrailDeny } from '../src/hook-framework/registry.js'

const MODEL_PRICES = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5.4-nano-2026-03-17': { input: 0.05, output: 0.4 },
  'qwen-plus': { input: 0.8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
}

export class CostGuard {
  constructor({ budgetUsd = 1, model = '', logger = console.error } = {}) {
    const envBudget = process.env.COST_GUARD_BUDGET
    this.budget = Number(envBudget || budgetUsd)
    if (!Number.isFinite(this.budget) || this.budget < 0) {
      throw new Error(`budgetUsd must be non-negative, got ${envBudget || budgetUsd}`)
    }
    this.model = model || process.env.AGENT_MODEL || 'gpt-4o-mini'
    this.logger = logger
    this.totalInputTokens = 0
    this.totalOutputTokens = 0
    this.estimatedCost = 0
    this.denyCount = 0
  }

  afterTurnHandler(ctx) {
    this.totalInputTokens += ctx.inputTokens || 0
    this.totalOutputTokens += ctx.outputTokens || 0
    this.estimatedCost = this.calculateCost()
    this.emitCostUpdate(ctx)
    this.denyIfOverBudget()
  }

  beforeToolHandler() {
    this.denyIfOverBudget()
  }

  calculateCost() {
    const prices = MODEL_PRICES[this.model] ?? { input: 1, output: 3 }
    return (
      this.totalInputTokens * prices.input / 1_000_000
      + this.totalOutputTokens * prices.output / 1_000_000
    )
  }

  denyIfOverBudget() {
    if (this.estimatedCost < this.budget) return
    this.denyCount += 1
    const reason = `Budget exceeded: $${this.estimatedCost.toFixed(6)} >= limit $${this.budget.toFixed(6)}`
    this.logger(JSON.stringify({
      level: 'CRITICAL',
      guardrail: 'cost_guard',
      message: 'Budget exceeded - blocking',
      estimated_cost_usd: Number(this.estimatedCost.toFixed(6)),
      budget_usd: this.budget,
    }))
    throw new GuardrailDeny(reason, { guardrail: 'cost_guard' })
  }

  emitCostUpdate(ctx) {
    this.logger(JSON.stringify({
      level: 'INFO',
      guardrail: 'cost_guard',
      turn: ctx.turnNumber,
      input_tokens: this.totalInputTokens,
      output_tokens: this.totalOutputTokens,
      estimated_cost_usd: Number(this.estimatedCost.toFixed(6)),
      budget_usd: this.budget,
      remaining_usd: Number((this.budget - this.estimatedCost).toFixed(6)),
    }))
  }

  getMetrics() {
    return {
      model: this.model,
      total_input_tokens: this.totalInputTokens,
      total_output_tokens: this.totalOutputTokens,
      estimated_cost_usd: Number(this.estimatedCost.toFixed(6)),
      budget_usd: this.budget,
      remaining_usd: Number(Math.max(0, this.budget - this.estimatedCost).toFixed(6)),
      budget_utilization: Number((this.estimatedCost / Math.max(this.budget, 0.001)).toFixed(2)),
      deny_count: this.denyCount,
    }
  }
}
```

- [ ] **Step 5: Implement `LoopDetector`**

Create `demo/agent-reliability-guardrails/shared-hooks/loop-detector.js`:

```js
import crypto from 'node:crypto'
import { GuardrailDeny } from '../src/hook-framework/registry.js'

export class LoopDetector {
  constructor({ threshold = Number(process.env.LOOP_DETECTOR_THRESHOLD || 3), logger = console.error } = {}) {
    this.threshold = threshold
    this.logger = logger
    this.toolHashes = []
    this.turnHashes = []
    this.loopDetections = 0
  }

  afterToolHandler(ctx) {
    const output = String(ctx.metadata?.toolOutput ?? ctx.metadata?.output ?? '').slice(0, 200)
    this.checkLoop(this.toolHashes, `${ctx.toolName}:${output}`, ctx)
  }

  afterTurnHandler(ctx) {
    const output = String(ctx.metadata?.output ?? '').slice(0, 200)
    this.checkLoop(this.turnHashes, `${ctx.toolName}:${output}`, ctx)
  }

  checkLoop(hashes, state, ctx) {
    const hash = crypto.createHash('md5').update(state).digest('hex').slice(0, 16)
    hashes.push(hash)
    if (hashes.length > this.threshold * 2) hashes.splice(0, hashes.length - this.threshold)

    if (hashes.length < this.threshold) return
    const recent = hashes.slice(-this.threshold)
    if (new Set(recent).size !== 1) return

    this.loopDetections += 1
    this.logger(JSON.stringify({
      level: 'CRITICAL',
      guardrail: 'loop_detector',
      message: 'Loop detected - terminating',
      turn: ctx.turnNumber,
      tool: ctx.toolName,
      threshold: this.threshold,
    }))
    throw new GuardrailDeny(
      `Loop detected: identical state repeated ${this.threshold} consecutive times`,
      { guardrail: 'loop_detector' },
    )
  }

  getMetrics() {
    const all = [...this.toolHashes, ...this.turnHashes]
    return {
      total_turns: this.turnHashes.length,
      total_tool_calls: this.toolHashes.length,
      unique_states: new Set(all).size,
      loop_detections: this.loopDetections,
    }
  }
}
```

- [ ] **Step 6: Run strategy tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/strategies.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit strategies**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/shared-hooks/retry-tracker.js \
  demo/agent-reliability-guardrails/shared-hooks/cost-guard.js \
  demo/agent-reliability-guardrails/shared-hooks/loop-detector.js \
  demo/agent-reliability-guardrails/tests/strategies.test.js
git commit -m "feat: add reliability guardrail strategies"
```

---

### Task 5: Observability Hooks And Langfuse Wiring

**Files:**
- Create: `demo/agent-reliability-guardrails/src/instrumentation.js`
- Create: `demo/agent-reliability-guardrails/shared-hooks/structured-log.js`
- Create: `demo/agent-reliability-guardrails/shared-hooks/langfuse-trace.js`
- Create: `demo/agent-reliability-guardrails/shared-hooks/hooks.yaml`
- Create: `demo/agent-reliability-guardrails/tests/handlers.test.js`

- [ ] **Step 1: Write handler tests**

Create `demo/agent-reliability-guardrails/tests/handlers.test.js`:

```js
import { describe, expect, it, vi } from 'vitest'
import { EventType, createHookContext } from '../src/hook-framework/registry.js'
import { beforeTurnHandler } from '../shared-hooks/structured-log.js'

describe('structured log handler', () => {
  it('emits compact JSON records', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    beforeTurnHandler(createHookContext({
      eventType: EventType.BEFORE_TURN,
      sessionId: 's1',
      turnNumber: 1,
      agentId: 'demo-agent',
    }))
    const record = JSON.parse(spy.mock.calls[0][0])
    expect(record).toMatchObject({
      event: 'before_turn',
      session_id: 's1',
      turn: 1,
      agent_id: 'demo-agent',
    })
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Implement structured logging**

Create `demo/agent-reliability-guardrails/shared-hooks/structured-log.js`:

```js
function emit(ctx) {
  const record = {
    timestamp: ctx.timestamp,
    event: ctx.eventType,
    session_id: ctx.sessionId,
    turn: ctx.turnNumber,
  }
  if (ctx.agentId) record.agent_id = ctx.agentId
  if (ctx.toolName) record.tool = ctx.toolName
  if (ctx.inputTokens || ctx.outputTokens) {
    record.tokens = { input: ctx.inputTokens, output: ctx.outputTokens }
  }
  if (ctx.metadata?.guardrailDeny) {
    record.guardrail_deny = true
    record.deny_reason = ctx.metadata.denyReason || ''
  }
  console.error(JSON.stringify(record))
}

export function beforeTurnHandler(ctx) { emit(ctx) }
export function beforeLlmHandler(ctx) { emit(ctx) }
export function beforeToolHandler(ctx) { emit(ctx) }
export function afterToolHandler(ctx) { emit(ctx) }
export function afterTurnHandler(ctx) { emit(ctx) }
export function taskCompleteHandler(ctx) { emit(ctx) }
export function sessionEndHandler(ctx) { emit(ctx) }
```

- [ ] **Step 3: Implement instrumentation**

Create `demo/agent-reliability-guardrails/src/instrumentation.js`:

```js
import { NodeSDK } from '@opentelemetry/sdk-node'
import { LangfuseSpanProcessor } from '@langfuse/otel'

let sdk = null
let started = false

export function isLangfuseConfigured() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)
}

export function startLangfuseSdk() {
  if (!isLangfuseConfigured()) {
    throw new Error('Langfuse is required: set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY')
  }
  if (started) return true
  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'http://localhost:3000',
        environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || 'local',
        exportMode: 'immediate',
      }),
    ],
  })
  sdk.start()
  started = true
  return true
}

export async function shutdownLangfuseSdk() {
  if (!sdk || !started) return
  await sdk.shutdown()
  sdk = null
  started = false
}
```

- [ ] **Step 4: Implement Langfuse trace handlers**

Create `demo/agent-reliability-guardrails/shared-hooks/langfuse-trace.js`:

```js
import { startObservation } from '@langfuse/tracing'

const sessions = new Map()

function enabled() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY)
}

function sessionKey(ctx) {
  return ctx.sessionId || 'default'
}

function getState(ctx) {
  if (!enabled()) return null
  const key = sessionKey(ctx)
  let state = sessions.get(key)
  if (state) return state

  const root = startObservation(
    `session-${key}`,
    {
      input: ctx.metadata?.taskDescription || ctx.taskName || undefined,
      metadata: { sessionId: key, source: 'agent-reliability-guardrails-js' },
    },
    { asType: 'agent' },
  )
  state = { root, generation: null, toolStack: [], genCount: 0, toolCount: 0 }
  sessions.set(key, state)
  return state
}

function closeGeneration(state, attributes = {}) {
  if (!state.generation) return
  state.generation.update(attributes)
  state.generation.end()
  state.generation = null
}

function currentParent(state) {
  return state.generation || state.root
}

export function beforeLlmHandler(ctx) {
  const state = getState(ctx)
  if (!state) return
  closeGeneration(state, { metadata: { phase: 'closed-before-next-generation' } })
  state.genCount += 1
  state.generation = state.root.startObservation(
    `llm-call-${state.genCount}`,
    {
      input: ctx.metadata?.promptPreview ? { prompt: ctx.metadata.promptPreview } : undefined,
      model: ctx.metadata?.model || process.env.AGENT_MODEL,
      metadata: { turn: ctx.turnNumber, agentId: ctx.agentId },
    },
    { asType: 'generation' },
  )
}

export function beforeToolHandler(ctx) {
  const state = getState(ctx)
  if (!state) return
  state.toolCount += 1
  const observation = currentParent(state).startObservation(
    `tool-${ctx.toolName}`,
    {
      input: Object.keys(ctx.toolInput || {}).length ? ctx.toolInput : undefined,
      metadata: { tool: ctx.toolName, turn: ctx.turnNumber, callNumber: state.toolCount },
    },
    { asType: 'tool' },
  )
  state.toolStack.push({ observation, toolName: ctx.toolName, turnNumber: ctx.turnNumber })
}

export function afterToolHandler(ctx) {
  const state = getState(ctx)
  if (!state) return
  const index = state.toolStack.findLastIndex(
    entry => entry.toolName === ctx.toolName && entry.turnNumber === ctx.turnNumber,
  )
  const output = { success: ctx.success }
  if (ctx.metadata?.toolOutput) output.result = ctx.metadata.toolOutput
  if (ctx.metadata?.guardrailDeny) output.denyReason = ctx.metadata.denyReason || ''

  if (index >= 0) {
    const [entry] = state.toolStack.splice(index, 1)
    entry.observation.update({
      output,
      level: ctx.success && !ctx.metadata?.guardrailDeny ? 'DEFAULT' : 'ERROR',
      metadata: { tool: ctx.toolName, durationMs: ctx.durationMs },
    })
    entry.observation.end()
  }
}

export function afterTurnHandler(ctx) {
  const state = getState(ctx)
  if (!state) return
  const usageDetails = {}
  if (ctx.inputTokens) usageDetails.input = ctx.inputTokens
  if (ctx.outputTokens) usageDetails.output = ctx.outputTokens
  if (ctx.inputTokens || ctx.outputTokens) usageDetails.total = (ctx.inputTokens || 0) + (ctx.outputTokens || 0)
  closeGeneration(state, {
    output: ctx.metadata?.llmResponse || ctx.metadata?.output || undefined,
    usageDetails: Object.keys(usageDetails).length ? usageDetails : undefined,
  })
}

export function taskCompleteHandler(ctx) {
  const state = getState(ctx)
  if (!state) return
  const span = state.root.startObservation('task-complete', {
    input: ctx.metadata?.taskDescription || ctx.taskName || undefined,
    output: ctx.metadata?.rawOutput || undefined,
  })
  span.end()
  state.root.update({ output: ctx.metadata?.rawOutput || undefined })
}

export function flushAndClose(ctx) {
  const key = sessionKey(ctx)
  const state = sessions.get(key)
  if (!state) return
  closeGeneration(state)
  while (state.toolStack.length > 0) {
    const entry = state.toolStack.pop()
    entry.observation.update({ level: 'WARNING', statusMessage: 'auto-closed' })
    entry.observation.end()
  }
  state.root.end()
  sessions.delete(key)
}
```

- [ ] **Step 5: Create global `hooks.yaml`**

Create `demo/agent-reliability-guardrails/shared-hooks/hooks.yaml`:

```yaml
hooks:
  BEFORE_TURN:
    - handler: structured-log.beforeTurnHandler
  BEFORE_LLM:
    - handler: structured-log.beforeLlmHandler
    - handler: langfuse-trace.beforeLlmHandler
  BEFORE_TOOL_CALL:
    - handler: structured-log.beforeToolHandler
    - handler: langfuse-trace.beforeToolHandler
  AFTER_TOOL_CALL:
    - handler: structured-log.afterToolHandler
    - handler: langfuse-trace.afterToolHandler
  AFTER_TURN:
    - handler: structured-log.afterTurnHandler
    - handler: langfuse-trace.afterTurnHandler
  TASK_COMPLETE:
    - handler: structured-log.taskCompleteHandler
    - handler: langfuse-trace.taskCompleteHandler
  SESSION_END:
    - handler: structured-log.sessionEndHandler
    - handler: langfuse-trace.flushAndClose

strategies:
  - class: retry-tracker.RetryTracker
    config:
      maxRetries: 3
    hooks:
      AFTER_TOOL_CALL: afterToolHandler

  - class: cost-guard.CostGuard
    config:
      budgetUsd: 1
    hooks:
      AFTER_TURN: afterTurnHandler
      BEFORE_TOOL_CALL: beforeToolHandler

  - class: loop-detector.LoopDetector
    config:
      threshold: 3
    hooks:
      AFTER_TOOL_CALL: afterToolHandler
      AFTER_TURN: afterTurnHandler
```

- [ ] **Step 6: Run handler tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/handlers.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit observability**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/src/instrumentation.js \
  demo/agent-reliability-guardrails/shared-hooks/structured-log.js \
  demo/agent-reliability-guardrails/shared-hooks/langfuse-trace.js \
  demo/agent-reliability-guardrails/shared-hooks/hooks.yaml \
  demo/agent-reliability-guardrails/tests/handlers.test.js
git commit -m "feat: add guardrail observability hooks"
```

---

### Task 6: Workspace, Skill Loader, And Sandbox

**Files:**
- Create: `demo/agent-reliability-guardrails/src/agent/skill-loader.js`
- Create: `demo/agent-reliability-guardrails/src/agent/sandbox.js`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/soul.md`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/user.md`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/agent.md`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/memory.md`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/skills/load-skills.yaml`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/skills/sop-design/SKILL.md`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/hooks/hooks.yaml`
- Create: `demo/agent-reliability-guardrails/workspace/demo-agent/hooks/task-audit.js`
- Create: `demo/agent-reliability-guardrails/tests/workspace.test.js`

- [ ] **Step 1: Write workspace tests**

Create `demo/agent-reliability-guardrails/tests/workspace.test.js`:

```js
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildBootstrapPrompt, loadSkillRegistry, loadSkillContent } from '../src/agent/skill-loader.js'
import { OutputSandbox } from '../src/agent/sandbox.js'

describe('workspace helpers', () => {
  it('builds a bootstrap prompt from four workspace files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'guardrails-workspace-'))
    await fs.writeFile(path.join(root, 'soul.md'), '你追求可靠交付。')
    await fs.writeFile(path.join(root, 'user.md'), '用户喜欢直接的技术说明。')
    await fs.writeFile(path.join(root, 'agent.md'), '你是可靠性工程助手。')
    await fs.writeFile(path.join(root, 'memory.md'), '上一篇文章讲了 Langfuse。')

    const prompt = await buildBootstrapPrompt(root)
    expect(prompt).toContain('soul.md')
    expect(prompt).toContain('Langfuse')
  })

  it('loads skill registry and selected skill content', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'guardrails-skills-'))
    const skillsDir = path.join(root, 'skills')
    await fs.mkdir(path.join(skillsDir, 'sop-design'), { recursive: true })
    await fs.writeFile(path.join(skillsDir, 'load-skills.yaml'), 'skills:\\n  - name: sop_design\\n    path: sop-design/SKILL.md\\n')
    await fs.writeFile(path.join(skillsDir, 'sop-design', 'SKILL.md'), '# SOP\\n写设计文档。\\n')

    const registry = await loadSkillRegistry(skillsDir)
    const content = await loadSkillContent(skillsDir, registry, 'sop_design')
    expect(content).toContain('写设计文档')
  })

  it('OutputSandbox writes only under output directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'guardrails-output-'))
    const sandbox = new OutputSandbox({ outputDir: path.join(root, 'output') })
    await sandbox.writeOutput('design_doc.md', '# ok')
    await expect(sandbox.writeOutput('../escape.md', 'bad')).rejects.toThrow('outside output directory')
  })
})
```

- [ ] **Step 2: Implement skill loader**

Create `demo/agent-reliability-guardrails/src/agent/skill-loader.js`:

```js
import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

export async function buildBootstrapPrompt(workspaceDir) {
  const files = ['soul.md', 'user.md', 'agent.md', 'memory.md']
  const parts = []
  for (const file of files) {
    const fullPath = path.join(workspaceDir, file)
    const content = await fs.readFile(fullPath, 'utf8')
    parts.push(`## ${file}\n\n${content.trim()}`)
  }
  return parts.join('\n\n---\n\n')
}

export async function loadSkillRegistry(skillsDir) {
  const raw = await fs.readFile(path.join(skillsDir, 'load-skills.yaml'), 'utf8')
  const config = YAML.parse(raw) ?? {}
  const registry = {}
  for (const skill of config.skills ?? []) {
    registry[skill.name] = {
      name: skill.name,
      path: skill.path,
      description: skill.description || '',
    }
  }
  return registry
}

export async function loadSkillContent(skillsDir, registry, skillName) {
  const skill = registry[skillName]
  if (!skill) throw new Error(`unknown skill: ${skillName}`)
  const root = path.resolve(skillsDir)
  const fullPath = path.resolve(root, skill.path)
  const relative = path.relative(root, fullPath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`skill path outside skills directory: ${skill.path}`)
  }
  return fs.readFile(fullPath, 'utf8')
}
```

- [ ] **Step 3: Implement sandbox wrappers**

Create `demo/agent-reliability-guardrails/src/agent/sandbox.js`:

```js
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'

const execFileAsync = promisify(execFile)

function assertInside(parentDir, childPath, label) {
  const root = path.resolve(parentDir)
  const target = path.resolve(root, childPath)
  const relative = path.relative(root, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} outside output directory: ${childPath}`)
  }
  return target
}

export class OutputSandbox {
  constructor({ outputDir }) {
    this.outputDir = path.resolve(outputDir)
  }

  async writeOutput(relPath, content) {
    const target = assertInside(this.outputDir, relPath, 'path')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
    return target
  }
}

export class PodmanSandbox {
  constructor({
    image = process.env.SANDBOX_IMAGE || 'agent-reliability-sandbox:latest',
    timeoutMs = Number(process.env.SANDBOX_TIMEOUT_MS || 30000),
    workspaceDir,
    skillsDir,
    outputDir,
  } = {}) {
    this.image = image
    this.timeoutMs = timeoutMs
    this.workspaceDir = path.resolve(workspaceDir)
    this.skillsDir = path.resolve(skillsDir)
    this.outputDir = path.resolve(outputDir)
  }

  buildMounts() {
    return [
      '-v', `${this.skillsDir}:/mnt/skills:ro`,
      '-v', `${this.outputDir}:/workspace/output:rw`,
      '-v', `${this.workspaceDir}:/workspace/context:ro`,
    ]
  }

  async execute(scriptPath, args = []) {
    const fullScript = path.resolve(scriptPath)
    const relative = path.relative(this.skillsDir, fullScript)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`script outside skills directory: ${scriptPath}`)
    }
    const cmd = [
      'run', '--rm',
      `--timeout=${Math.ceil(this.timeoutMs / 1000)}`,
      ...this.buildMounts(),
      this.image,
      'node',
      `/mnt/skills/${relative}`,
      ...args,
    ]
    try {
      const { stdout, stderr } = await execFileAsync('podman', cmd, { timeout: this.timeoutMs })
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (error) {
      if (error.killed) return `执行超时（${this.timeoutMs / 1000}s）`
      return `执行失败: ${error.stderr || error.message}`
    }
  }

  async executeCode(code) {
    const cmd = [
      'run', '--rm', '-i',
      `--timeout=${Math.ceil(this.timeoutMs / 1000)}`,
      ...this.buildMounts(),
      this.image,
      'node',
      '-e',
      code,
    ]
    try {
      const { stdout, stderr } = await execFileAsync('podman', cmd, { timeout: this.timeoutMs })
      if (stderr) console.error('[Sandbox stderr]', stderr)
      return stdout.trim()
    } catch (error) {
      if (error.killed) return `执行超时（${this.timeoutMs / 1000}s）`
      return `执行失败: ${error.stderr || error.message}`
    }
  }
}
```

- [ ] **Step 4: Create workspace files**

Create these files:

`demo/agent-reliability-guardrails/workspace/demo-agent/soul.md`:

```markdown
你是一个重视可靠性的技术设计助手。你在执行任务时会主动使用 Skill，先理解约束，再产出清晰、可验证的设计文档。
```

`demo/agent-reliability-guardrails/workspace/demo-agent/user.md`:

```markdown
用户偏好中文技术文章风格，喜欢真实运行、关键代码和工程取舍，不喜欢空泛概念。
```

`demo/agent-reliability-guardrails/workspace/demo-agent/agent.md`:

```markdown
你需要先加载合适的 Skill，再执行任务。输出文件必须写入 workspace/demo-agent/output/。
```

`demo/agent-reliability-guardrails/workspace/demo-agent/memory.md`:

```markdown
前一篇文章已经介绍了 Hook 骨架和 Langfuse 全链路追踪。本篇要在这个基础上展示运行时可靠性护栏。
```

`demo/agent-reliability-guardrails/workspace/demo-agent/skills/load-skills.yaml`:

```yaml
skills:
  - name: sop_design
    path: sop-design/SKILL.md
    description: 为一个软件功能产出技术设计文档
```

`demo/agent-reliability-guardrails/workspace/demo-agent/skills/sop-design/SKILL.md`:

```markdown
---
name: sop_design
description: 为一个软件功能产出技术设计文档
---

# 技术设计文档 SOP

你需要产出一份 Markdown 技术设计文档，包含：

1. 背景与目标
2. 用户需求
3. 核心模块
4. 数据模型
5. 接口设计
6. 可靠性与错误处理
7. 测试计划

文档必须写入 `workspace/demo-agent/output/design_doc.md`。
```

- [ ] **Step 5: Create workspace audit hook**

Create `demo/agent-reliability-guardrails/workspace/demo-agent/hooks/hooks.yaml`:

```yaml
hooks:
  TASK_COMPLETE:
    - handler: task-audit.writeAuditEntry
```

Create `demo/agent-reliability-guardrails/workspace/demo-agent/hooks/task-audit.js`:

```js
import fs from 'node:fs/promises'
import path from 'node:path'

let auditFile = ''

export function setAuditFile(file) {
  auditFile = file
}

export async function writeAuditEntry(ctx) {
  const target = auditFile || path.resolve('workspace/demo-agent/audit.log')
  await fs.mkdir(path.dirname(target), { recursive: true })
  const record = {
    timestamp: ctx.timestamp,
    event: ctx.eventType,
    session_id: ctx.sessionId,
    output_preview: String(ctx.metadata?.rawOutput ?? '').slice(0, 200),
  }
  await fs.appendFile(target, `${JSON.stringify(record)}\n`)
}
```

- [ ] **Step 6: Run workspace tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/workspace.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit workspace**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/src/agent/skill-loader.js \
  demo/agent-reliability-guardrails/src/agent/sandbox.js \
  demo/agent-reliability-guardrails/workspace/demo-agent \
  demo/agent-reliability-guardrails/tests/workspace.test.js
git commit -m "feat: add reliability demo workspace and sandbox"
```

---

### Task 7: Agent Adapter And Real Agent Loop

**Files:**
- Create: `demo/agent-reliability-guardrails/src/hook-framework/agent-adapter.js`
- Create: `demo/agent-reliability-guardrails/src/agent/real-agent.js`
- Create: `demo/agent-reliability-guardrails/tests/agent-loop.test.js`

- [ ] **Step 1: Write agent loop integration test**

Create `demo/agent-reliability-guardrails/tests/agent-loop.test.js`:

```js
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AgentObservabilityAdapter } from '../src/hook-framework/agent-adapter.js'
import { HookRegistry } from '../src/hook-framework/registry.js'
import { loadSkillRegistry } from '../src/agent/skill-loader.js'
import { runRealAgent } from '../src/agent/real-agent.js'

describe('real agent loop', () => {
  it('runs skill_loader then write_design_doc with mocked chat client', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'guardrails-agent-'))
    const workspaceDir = path.join(tmp, 'workspace')
    const skillsDir = path.join(workspaceDir, 'skills')
    await fs.mkdir(path.join(skillsDir, 'sop-design'), { recursive: true })
    await fs.mkdir(path.join(workspaceDir, 'output'), { recursive: true })
    await fs.writeFile(path.join(skillsDir, 'load-skills.yaml'), 'skills:\\n  - name: sop_design\\n    path: sop-design/SKILL.md\\n')
    await fs.writeFile(path.join(skillsDir, 'sop-design', 'SKILL.md'), '# SOP\\n写设计文档。\\n')

    const registry = new HookRegistry({ logger: vi.fn() })
    const adapter = new AgentObservabilityAdapter(registry, { sessionId: 's-test' })
    const skills = await loadSkillRegistry(skillsDir)
    const chatClient = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: { name: 'skill_loader', arguments: JSON.stringify({ skill_name: 'sop_design' }) },
            }],
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call-2',
              type: 'function',
              function: {
                name: 'write_design_doc',
                arguments: JSON.stringify({ content: '# 技术设计文档\\n\\n短链接服务。' }),
              },
            }],
          },
        }],
        usage: { prompt_tokens: 120, completion_tokens: 50 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: JSON.stringify({ errcode: 0, file_path: 'output/design_doc.md' }) } }],
        usage: { prompt_tokens: 50, completion_tokens: 20 },
      })

    const result = await runRealAgent({
      adapter,
      workspaceDir,
      skillsDir,
      taskDesc: '为一个短链接服务产出技术设计文档',
      backstory: '你是可靠性工程助手。',
      skills,
      chatClient,
      llmConfig: { apiKey: 'test', baseUrl: 'http://localhost/v1', model: 'test-model' },
      maxIterations: 5,
    })

    expect(result.result.errcode).toBe(0)
    expect(await fs.readFile(path.join(workspaceDir, 'output', 'design_doc.md'), 'utf8')).toContain('短链接服务')
  })
})
```

- [ ] **Step 2: Implement agent adapter**

Create `demo/agent-reliability-guardrails/src/hook-framework/agent-adapter.js`:

```js
import { EventType, createHookContext } from './registry.js'

const MAX_TEXT = 2000

function truncate(value, limit = MAX_TEXT) {
  const text = String(value ?? '')
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}... [truncated, ${text.length} chars total]`
}

export class AgentObservabilityAdapter {
  constructor(registry, { sessionId = '' } = {}) {
    this.registry = registry
    this.sessionId = sessionId
    this.turnCount = 0
    this.currentTurnHasLlm = false
    this.cleaned = false
    this.lastAgentRole = ''
    this.taskDescription = ''
    this.lastPromptPreview = ''
  }

  async beforeLlm({ agentId = 'demo-agent', taskDescription = '', messages = [], llm = {} } = {}) {
    this.lastAgentRole = agentId
    if (taskDescription && !this.taskDescription) this.taskDescription = truncate(taskDescription)
    if (!this.currentTurnHasLlm) {
      this.turnCount += 1
      this.currentTurnHasLlm = true
      await this.registry.dispatch(EventType.BEFORE_TURN, createHookContext({
        eventType: EventType.BEFORE_TURN,
        agentId,
        sessionId: this.sessionId,
        turnNumber: this.turnCount,
      }))
    }
    const last = messages.at(-1)
    const preview = truncate(typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? ''), 500)
    this.lastPromptPreview = preview
    await this.registry.dispatch(EventType.BEFORE_LLM, createHookContext({
      eventType: EventType.BEFORE_LLM,
      agentId,
      sessionId: this.sessionId,
      turnNumber: this.turnCount,
      metadata: { promptPreview: preview, model: llm.model || process.env.AGENT_MODEL },
    }))
  }

  async beforeToolCall({ toolName, toolInput = {} }) {
    const ctx = createHookContext({
      eventType: EventType.BEFORE_TOOL_CALL,
      toolName,
      toolInput,
      sessionId: this.sessionId,
      turnNumber: this.turnCount,
    })
    await this.registry.dispatch(EventType.BEFORE_TOOL_CALL, ctx)
    await this.registry.dispatchGate(EventType.BEFORE_TOOL_CALL, ctx)
  }

  async afterToolCall({ toolName, toolInput = {}, toolOutput = '', durationMs = 0, success = true, metadata = {} }) {
    const ctx = createHookContext({
      eventType: EventType.AFTER_TOOL_CALL,
      toolName,
      toolInput,
      durationMs,
      success,
      sessionId: this.sessionId,
      turnNumber: this.turnCount,
      metadata: { ...metadata, toolOutput: truncate(toolOutput) },
    })
    await this.registry.dispatch(EventType.AFTER_TOOL_CALL, ctx)
    await this.registry.dispatchGate(EventType.AFTER_TOOL_CALL, ctx)
  }

  async afterTurn({ agentId = this.lastAgentRole, toolName = '', output = '', llmResponse = '', inputTokens = 0, outputTokens = 0 } = {}) {
    const ctx = createHookContext({
      eventType: EventType.AFTER_TURN,
      sessionId: this.sessionId,
      turnNumber: this.turnCount,
      agentId,
      toolName,
      inputTokens,
      outputTokens,
      metadata: {
        output: truncate(output),
        llmResponse: truncate(llmResponse),
        promptPreview: this.lastPromptPreview,
      },
    })
    await this.registry.dispatch(EventType.AFTER_TURN, ctx)
    await this.registry.dispatchGate(EventType.AFTER_TURN, ctx)
    this.currentTurnHasLlm = false
    this.lastPromptPreview = ''
  }

  async taskComplete({ rawOutput = '', description = '' } = {}) {
    await this.registry.dispatch(EventType.TASK_COMPLETE, createHookContext({
      eventType: EventType.TASK_COMPLETE,
      sessionId: this.sessionId,
      taskName: truncate(description || this.taskDescription, 500),
      agentId: this.lastAgentRole,
      metadata: {
        rawOutput: truncate(rawOutput),
        taskDescription: truncate(description || this.taskDescription, 500),
      },
    }))
  }

  async cleanup() {
    if (this.cleaned) return
    this.cleaned = true
    await this.registry.dispatch(EventType.SESSION_END, createHookContext({
      eventType: EventType.SESSION_END,
      sessionId: this.sessionId,
    }))
  }
}
```

- [ ] **Step 3: Implement real agent loop**

Create `demo/agent-reliability-guardrails/src/agent/real-agent.js`:

```js
import fs from 'node:fs/promises'
import path from 'node:path'
import { GuardrailDeny } from '../hook-framework/registry.js'
import { loadSkillContent } from './skill-loader.js'
import { OutputSandbox } from './sandbox.js'

function estimateTokens(text) {
  return Math.max(1, Math.floor(String(text ?? '').length * 2 / 3))
}

function parseToolArguments(call) {
  const raw = call.function?.arguments || '{}'
  return JSON.parse(raw)
}

export async function defaultChatClient({ baseUrl, apiKey, model, messages, tools }) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
  })
  if (!res.ok) throw new Error(`LLM request failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export function makeTools({ workspaceDir, skillsDir, skills, scenario = '' }) {
  const output = new OutputSandbox({ outputDir: path.join(workspaceDir, 'output') })
  let retryFailures = 0
  return {
    skill_loader: {
      definition: {
        type: 'function',
        function: {
          name: 'skill_loader',
          description: 'Load detailed instructions for a named skill.',
          parameters: {
            type: 'object',
            properties: { skill_name: { type: 'string' } },
            required: ['skill_name'],
          },
        },
      },
      execute: async ({ skill_name }) => loadSkillContent(skillsDir, skills, skill_name),
    },
    write_design_doc: {
      definition: {
        type: 'function',
        function: {
          name: 'write_design_doc',
          description: 'Write the final design document to output/design_doc.md.',
          parameters: {
            type: 'object',
            properties: { content: { type: 'string' } },
            required: ['content'],
          },
        },
      },
      execute: async ({ content }) => {
        const target = await output.writeOutput('design_doc.md', content)
        return JSON.stringify({ errcode: 0, file_path: target })
      },
    },
    repeat_state: {
      definition: {
        type: 'function',
        function: {
          name: 'repeat_state',
          description: 'Return a repeated state for loop guardrail demonstration.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      execute: async () => scenario === 'loop' ? 'same state' : 'not used',
    },
    flaky_tool: {
      definition: {
        type: 'function',
        function: {
          name: 'flaky_tool',
          description: 'Fail twice then recover for retry tracker demonstration.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      execute: async () => {
        retryFailures += 1
        if (retryFailures <= 2) throw new Error('transient failure')
        return 'recovered'
      },
    },
  }
}

export async function runGuardedToolCall({ adapter, toolName, args, tool }) {
  const started = Date.now()
  try {
    await adapter.beforeToolCall({ toolName, toolInput: args })
  } catch (error) {
    const denied = error instanceof GuardrailDeny
    await adapter.afterToolCall({
      toolName,
      toolInput: args,
      toolOutput: error.message,
      durationMs: Date.now() - started,
      success: false,
      metadata: denied ? { guardrailDeny: true, denyReason: error.reason, deniedBeforeExecution: true } : {},
    })
    throw error
  }

  try {
    const result = await tool.execute(args)
    await adapter.afterToolCall({
      toolName,
      toolInput: args,
      toolOutput: result,
      durationMs: Date.now() - started,
      success: true,
    })
    return result
  } catch (error) {
    const denied = error instanceof GuardrailDeny
    await adapter.afterToolCall({
      toolName,
      toolInput: args,
      toolOutput: error.message,
      durationMs: Date.now() - started,
      success: false,
      metadata: denied ? { guardrailDeny: true, denyReason: error.reason } : {},
    })
    throw error
  }
}

export async function runRealAgent({
  adapter,
  workspaceDir,
  skillsDir,
  taskDesc,
  backstory,
  skills,
  llmConfig,
  chatClient = defaultChatClient,
  maxIterations = 8,
  scenario = process.env.GUARDRAIL_SCENARIO || '',
}) {
  const tools = makeTools({ workspaceDir, skillsDir, skills, scenario })
  const messages = [
    { role: 'system', content: `${backstory}\n\n你必须先调用 skill_loader，再按 Skill 指引完成任务。` },
    { role: 'user', content: taskDesc },
  ]
  const toolDefinitions = Object.values(tools).map(t => t.definition)
  let lastUsage = { prompt_tokens: 0, completion_tokens: 0 }

  for (let turn = 1; turn <= maxIterations; turn += 1) {
    await adapter.beforeLlm({
      agentId: 'demo-agent',
      taskDescription: taskDesc,
      messages,
      llm: { model: llmConfig.model },
    })
    const response = await chatClient({ ...llmConfig, messages, tools: toolDefinitions })
    lastUsage = response.usage ?? { prompt_tokens: estimateTokens(JSON.stringify(messages)), completion_tokens: 1 }
    const message = response.choices?.[0]?.message ?? {}
    const toolCalls = message.tool_calls ?? []

    if (toolCalls.length === 0) {
      const content = message.content || ''
      await adapter.afterTurn({
        output: content,
        llmResponse: content,
        inputTokens: lastUsage.prompt_tokens || 0,
        outputTokens: lastUsage.completion_tokens || 0,
      })
      let parsed
      try { parsed = JSON.parse(content) } catch { parsed = { errcode: 0, text: content } }
      await adapter.taskComplete({ rawOutput: content, description: taskDesc })
      return { result: parsed, designDocPath: path.join(workspaceDir, 'output', 'design_doc.md') }
    }

    messages.push(message)
    for (const call of toolCalls) {
      const toolName = call.function?.name
      const tool = tools[toolName]
      if (!tool) throw new Error(`unknown tool: ${toolName}`)
      const args = parseToolArguments(call)
      const result = await runGuardedToolCall({ adapter, toolName, args, tool })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: toolName,
        content: String(result),
      })
    }
    await adapter.afterTurn({
      toolName: toolCalls.at(-1)?.function?.name || '',
      output: messages.at(-1)?.content || '',
      inputTokens: lastUsage.prompt_tokens || 0,
      outputTokens: lastUsage.completion_tokens || 0,
    })
  }

  throw new Error(`max iterations reached: ${maxIterations}`)
}
```

- [ ] **Step 4: Run agent loop test**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/agent-loop.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit agent loop**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/src/hook-framework/agent-adapter.js \
  demo/agent-reliability-guardrails/src/agent/real-agent.js \
  demo/agent-reliability-guardrails/tests/agent-loop.test.js
git commit -m "feat: add guarded agent loop"
```

---

### Task 8: CLI Entry Point And Scenario Integration

**Files:**
- Create: `demo/agent-reliability-guardrails/src/demo.js`
- Create: `demo/agent-reliability-guardrails/tests/e2e.test.js`

- [ ] **Step 1: Write e2e test for loader + strategies + agent**

Create `demo/agent-reliability-guardrails/tests/e2e.test.js`:

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { HookLoader } from '../src/hook-framework/loader.js'
import { HookRegistry } from '../src/hook-framework/registry.js'
import { AgentObservabilityAdapter } from '../src/hook-framework/agent-adapter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEMO_DIR = path.resolve(__dirname, '..')

describe('integrated hooks', () => {
  it('loads global strategies and exposes metrics', async () => {
    const registry = new HookRegistry({ logger: vi.fn() })
    const loader = new HookLoader(registry, { logger: vi.fn() })
    const workspaceDir = path.join(DEMO_DIR, 'workspace', 'demo-agent')
    await loader.loadTwoLayers(path.join(DEMO_DIR, 'shared-hooks'), workspaceDir)

    const adapter = new AgentObservabilityAdapter(registry, { sessionId: 's-e2e' })
    await adapter.afterTurn({ inputTokens: 10, outputTokens: 5, output: 'ok' })
    await adapter.cleanup()

    expect(Object.keys(loader.strategies)).toEqual(expect.arrayContaining(['retry-tracker', 'cost-guard', 'loop-detector']))
  })
})
```

- [ ] **Step 2: Implement CLI**

Create `demo/agent-reliability-guardrails/src/demo.js`:

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { AgentObservabilityAdapter } from './hook-framework/agent-adapter.js'
import { GuardrailDeny, HookRegistry } from './hook-framework/registry.js'
import { HookLoader } from './hook-framework/loader.js'
import { buildBootstrapPrompt, loadSkillRegistry } from './agent/skill-loader.js'
import { runRealAgent } from './agent/real-agent.js'
import { shutdownLangfuseSdk, startLangfuseSdk } from './instrumentation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEMO_DIR = path.resolve(__dirname, '..')
const WORKSPACE_DIR = path.join(DEMO_DIR, 'workspace', 'demo-agent')
const SKILLS_DIR = path.join(WORKSPACE_DIR, 'skills')
const SHARED_HOOKS_DIR = path.join(DEMO_DIR, 'shared-hooks')
const DEFAULT_TASK = '为一个短链接服务产出技术设计文档'

dotenv.config({ path: path.join(DEMO_DIR, '.env'), override: true, quiet: true })

function makeSessionId() {
  return `sess_${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
}

function resolveLlmConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  const baseUrl = process.env.OPENAI_API_BASE || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.AGENT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY or ANTHROPIC_API_KEY')
  return { apiKey, baseUrl, model }
}

function printMetrics(strategies) {
  console.log('\nGuardrail Metrics:')
  for (const [name, strategy] of Object.entries(strategies)) {
    if (typeof strategy.getMetrics !== 'function') continue
    console.log(`\n  [${name}]`)
    for (const [key, value] of Object.entries(strategy.getMetrics())) {
      console.log(`    ${key}: ${JSON.stringify(value)}`)
    }
  }
}

async function main() {
  const taskDesc = process.argv.slice(2).join(' ').trim() || DEFAULT_TASK
  const sessionId = makeSessionId()
  startLangfuseSdk()

  const registry = new HookRegistry()
  const loader = new HookLoader(registry)
  await loader.loadTwoLayers(SHARED_HOOKS_DIR, WORKSPACE_DIR)

  const summary = registry.summary()
  const totalHandlers = Object.values(summary).reduce((sum, list) => sum + list.length, 0)
  console.log(`Session: ${sessionId}`)
  console.log(`HookRegistry: ${totalHandlers} handlers loaded`)
  console.log(`Strategies: ${Object.keys(loader.strategies).join(', ')}`)

  const adapter = new AgentObservabilityAdapter(registry, { sessionId })
  try {
    const backstory = await buildBootstrapPrompt(WORKSPACE_DIR)
    const skills = await loadSkillRegistry(SKILLS_DIR)
    const { result, designDocPath } = await runRealAgent({
      adapter,
      workspaceDir: WORKSPACE_DIR,
      skillsDir: SKILLS_DIR,
      taskDesc,
      backstory,
      skills,
      llmConfig: resolveLlmConfig(),
      scenario: process.env.GUARDRAIL_SCENARIO || '',
    })
    console.log('\nResult:')
    console.log(JSON.stringify(result, null, 2))
    console.log(`Design doc: ${designDocPath}`)
  } catch (error) {
    if (error instanceof GuardrailDeny) {
      console.log(`\nGuardrail triggered: ${error.reason}`)
    } else {
      throw error
    }
  } finally {
    await adapter.cleanup()
    printMetrics(loader.strategies)
    console.log(`\nLangfuse: ${process.env.LANGFUSE_BASE_URL || 'http://localhost:3000'}`)
    await shutdownLangfuseSdk()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
```

- [ ] **Step 3: Run e2e test**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test -- tests/e2e.test.js
```

Expected: PASS.

- [ ] **Step 4: Run all tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit CLI**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/src/demo.js \
  demo/agent-reliability-guardrails/tests/e2e.test.js
git commit -m "feat: add guardrails demo cli"
```

---

### Task 9: Real Demo Verification And README Update

**Files:**
- Modify: `demo/agent-reliability-guardrails/README.md`

- [ ] **Step 1: Build sandbox image**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm run build:sandbox
```

Expected: Podman builds `agent-reliability-sandbox:latest`.

- [ ] **Step 2: Run normal real LLM scenario**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm start -- "为一个短链接服务产出技术设计文档"
```

Expected:

- command exits with status 0
- output includes `Design doc:`
- `workspace/demo-agent/output/design_doc.md` exists
- terminal prints `Guardrail Metrics`
- Langfuse URL is printed

- [ ] **Step 3: Run cost guard scenario**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
COST_GUARD_BUDGET=0.001 npm start
```

Expected:

- command prints `Guardrail triggered: Budget exceeded`
- metrics include `[cost-guard]`
- command cleans up and prints Langfuse URL

- [ ] **Step 4: Run loop detector scenario**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
GUARDRAIL_SCENARIO=loop npm start -- "反复检查同一个状态，直到你认为可以停止"
```

Expected:

- command prints `Guardrail triggered: Loop detected`
- metrics include `[loop-detector]`
- `loop_detections` is at least 1

- [ ] **Step 5: Run retry tracker scenario**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
GUARDRAIL_SCENARIO=retry npm start -- "调用不稳定工具并继续完成任务"
```

Expected:

- terminal shows retry tracker warning if the tool fails twice
- metrics include `[retry-tracker]`
- `total_retries` is at least 1

- [ ] **Step 6: Update README with observed commands**

Modify `demo/agent-reliability-guardrails/README.md` so it contains this extra section:

```markdown
## Verified Scenarios

The article uses these commands:

```bash
npm start -- "为一个短链接服务产出技术设计文档"
COST_GUARD_BUDGET=0.001 npm start
GUARDRAIL_SCENARIO=loop npm start -- "反复检查同一个状态，直到你认为可以停止"
GUARDRAIL_SCENARIO=retry npm start -- "调用不稳定工具并继续完成任务"
```

Successful runs print `Guardrail Metrics` and a Langfuse URL.
```

- [ ] **Step 7: Commit verification docs**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails/README.md \
  demo/agent-reliability-guardrails/workspace/demo-agent/output/design_doc.md
git commit -m "docs: record guardrails demo scenarios"
```

---

### Task 10: Write The Article

**Files:**
- Create: `source/_posts/ai-agent-reliability-guardrails.md`
- Create: `source/_posts/ai-agent-reliability-guardrails/`

- [ ] **Step 1: Invoke required writing skill**

Use `write-tech-article` before drafting. The article must follow the repo writing convention and use the approved structure:

1. 前言：能看见还不够
2. 三个失控场景
3. 架构：Hook 从日志系统升级成控制面
4. 三个策略
5. 跑一次真实任务
6. 故意触发护栏
7. 结语

- [ ] **Step 2: Create article file**

Create `source/_posts/ai-agent-reliability-guardrails.md`:

```markdown
---
title: 让 Agent 学会自动刹车：重试、循环控制与成本围栏
date: 2026-05-15 20:00:00
tags:
  - ai
  - agent
  - reliability
categories:
  - ai
description: 可观测性只能让我们看见 Agent 怎么失控，可靠性护栏才能让系统在失败、循环和成本爆掉之前自动停下来。
---

# 前言：能看见还不够

上一篇文章里，我们把 Hook 接进 Agent Loop，又把关键事件送进 Langfuse。那一步解决的是“看见”：每一轮 LLM 调用、每一次工具执行、每个最终结果都能被追踪。但真实系统里，能看见并不等于能控制。Agent 一旦开始重复调用失败工具、在相似状态里打转，或者把成本一路推高，只有日志是不够的；我们需要让这些观测点反过来参与决策，在风险扩大前把执行拦下来。
```

- [ ] **Step 3: Create asset directory**

Run:

```bash
mkdir -p /Users/youxingzhi/ayou/blog/source/_posts/ai-agent-reliability-guardrails
```

- [ ] **Step 4: Draft sections 1-4**

Write sections:

- 前言：承接 Langfuse 文章，说明“看见”不是“干预”
- 三个失控场景：失败、循环、成本
- 架构：目录结构、事件流、`dispatch` / `dispatchGate`
- 三个策略：`RetryTracker`、`LoopDetector`、`CostGuard`

Include short code snippets only. The longest snippet should stay under 35 lines.

- [ ] **Step 5: Draft sections 5-7 with real run evidence**

Write sections:

- 跑一次真实任务：include command and selected terminal output from Task 9
- 故意触发护栏：include low-budget, loop, and retry metrics
- 结语：reliability prevents loops, runaway cost, and failure spread; security comes next

Keep the article focused on this demo's design and run results. Do not frame it as a port, migration, or comparison with other demos.

- [ ] **Step 6: Scan article constraints**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
rg -n "占位说明|移植|参考.*版本|另一个语言|其他 demo" source/_posts/ai-agent-reliability-guardrails.md
```

Expected: no matches.

- [ ] **Step 7: Commit article draft**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add source/_posts/ai-agent-reliability-guardrails.md source/_posts/ai-agent-reliability-guardrails
git commit -m "blog: add agent reliability guardrails article"
```

---

### Task 11: Final Verification

**Files:**
- Verify: `demo/agent-reliability-guardrails/**`
- Verify: `source/_posts/ai-agent-reliability-guardrails.md`

- [ ] **Step 1: Run all demo tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-reliability-guardrails
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run article static scan**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
rg -n "占位说明|移植|参考.*版本|另一个语言|其他 demo" source/_posts/ai-agent-reliability-guardrails.md demo/agent-reliability-guardrails
```

Expected: no matches in article. Matches inside docs/specs are acceptable only if outside article/demo reader-facing files.

- [ ] **Step 3: Check changed files**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git status --short
```

Expected: only unrelated pre-existing workspace changes remain. Files from this plan should be committed.

- [ ] **Step 4: Commit any final fixes**

If Step 1 or Step 2 required fixes, commit them:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-reliability-guardrails source/_posts/ai-agent-reliability-guardrails.md source/_posts/ai-agent-reliability-guardrails
git commit -m "chore: finalize agent reliability guardrails demo"
```

Expected: no new commit is needed if Step 1 and Step 2 were already clean.
