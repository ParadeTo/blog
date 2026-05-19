# Agent Security Guardrails JS Demo And Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone JavaScript demo for Agent security guardrails, then write a Chinese article explaining the JS implementation.

**Architecture:** Create `demo/agent-security-guardrails/` as a sibling of `demo/agent-reliability-guardrails/`. Reuse the same JS Hook vocabulary (`HookRegistry`, `dispatchGate`, `GuardrailDeny`, YAML hooks), but focus this demo on security strategies: input sanitization, permission gate, runtime credential injection, and security audit logging. After the demo and tests are stable, write `source/_posts/ai-agent-security-guardrails.md` from the JS code.

**Tech Stack:** Node.js ESM, Vitest, YAML, Hexo Markdown, `rg`/`sed` checks, no Hexo commands.

---

## File Map

| Path | Responsibility |
| --- | --- |
| `demo/agent-security-guardrails/package.json` | Standalone npm scripts and dependencies |
| `demo/agent-security-guardrails/.env.example` | Scenario env vars, especially `SECURE_API_KEY` |
| `demo/agent-security-guardrails/.gitignore` | Ignore `.env`, `node_modules`, runtime audit output |
| `demo/agent-security-guardrails/README.md` | How to run tests and security scenarios |
| `demo/agent-security-guardrails/src/hook-framework/registry.js` | Event types, `GuardrailDeny`, observe/gate dispatch |
| `demo/agent-security-guardrails/src/hook-framework/loader.js` | YAML loader with `deps` support |
| `demo/agent-security-guardrails/src/hook-framework/agent-adapter.js` | Maps guarded tool calls to hook events |
| `demo/agent-security-guardrails/src/agent/real-agent.js` | Deterministic tools and guarded scenario runner |
| `demo/agent-security-guardrails/src/demo.js` | CLI entry and scenario dispatch |
| `demo/agent-security-guardrails/shared-hooks/hooks.yaml` | Observability hooks and security strategies |
| `demo/agent-security-guardrails/shared-hooks/structured-log.js` | Compact JSON logging |
| `demo/agent-security-guardrails/shared-hooks/audit-logger.js` | JSONL security event logger |
| `demo/agent-security-guardrails/shared-hooks/sandbox-guard.js` | Deterministic input sanitization |
| `demo/agent-security-guardrails/shared-hooks/permission-gate.js` | `allow` / `ask` / `deny` tool policy |
| `demo/agent-security-guardrails/shared-hooks/credential-inject.js` | Runtime credential injection wrapper |
| `demo/agent-security-guardrails/workspace/demo-agent/soul.md` | Prompt-level security prohibitions |
| `demo/agent-security-guardrails/workspace/demo-agent/security.yaml` | Tool permission policy |
| `demo/agent-security-guardrails/tests/*.test.js` | Deterministic Vitest coverage |
| `source/_posts/ai-agent-security-guardrails.md` | Final article |

## Global Constraints

- Do not run Hexo commands.
- Do not modify `demo/agent-reliability-guardrails/`; read it as a reference only.
- Do not modify `demo/xiaoquan/`.
- Tests must not require real LLM, Langfuse, network, or API keys.
- Use `write-tech-article` before writing the article.
- Commit only files touched by this plan.

---

### Task 1: Scaffold The JS Security Demo

**Files:**
- Create: `demo/agent-security-guardrails/package.json`
- Create: `demo/agent-security-guardrails/.env.example`
- Create: `demo/agent-security-guardrails/.gitignore`
- Create: `demo/agent-security-guardrails/README.md`
- Create directories under `demo/agent-security-guardrails/`

- [ ] **Step 1: Create directories**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
mkdir -p demo/agent-security-guardrails/{src/hook-framework,src/agent,shared-hooks,tests,workspace/demo-agent}
```

Expected: directories exist.

- [ ] **Step 2: Create `package.json`**

Create `demo/agent-security-guardrails/package.json`:

```json
{
  "name": "agent-security-guardrails-demo",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "start": "node src/demo.js",
    "attack:privilege": "SECURITY_SCENARIO=privilege node src/demo.js",
    "attack:inject": "SECURITY_SCENARIO=inject node src/demo.js",
    "attack:api-leak": "SECURITY_SCENARIO=api-leak SECURE_API_KEY=sk-DEMO-xxxxxxxxxxxxxxxxxxxxxxxx node src/demo.js",
    "test": "vitest run"
  },
  "dependencies": {
    "dotenv": "^17.4.2",
    "yaml": "^2.9.0"
  },
  "devDependencies": {
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 3: Create `.env.example`**

Create `demo/agent-security-guardrails/.env.example`:

```bash
SECURITY_SCENARIO=normal
SECURITY_POLICY_PATH=workspace/demo-agent/security.yaml
SECURITY_AUDIT_FILE=workspace/demo-agent/security-audit.jsonl
SECURE_API_KEY=
```

- [ ] **Step 4: Create `.gitignore`**

Create `demo/agent-security-guardrails/.gitignore`:

```gitignore
.env
node_modules/
workspace/demo-agent/security-audit.jsonl
```

- [ ] **Step 5: Create README**

Create `demo/agent-security-guardrails/README.md`:

```markdown
# Agent Security Guardrails Demo

JavaScript demo for runtime Agent security guardrails:

- `SandboxGuard`
- `PermissionGate`
- `SecureToolWrapper`
- `SecurityAuditLogger`

## Setup

```bash
npm install
```

## Run

```bash
npm start
npm run attack:privilege
npm run attack:inject
npm run attack:api-leak
```

## Test

```bash
npm test
```
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm install
```

Expected: `package-lock.json` is created and `npm` exits successfully.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-security-guardrails
git commit -m "feat: scaffold agent security guardrails demo"
```

Expected: commit includes only `demo/agent-security-guardrails`.

---

### Task 2: Add Hook Framework With Dependency Injection

**Files:**
- Create: `demo/agent-security-guardrails/src/hook-framework/registry.js`
- Create: `demo/agent-security-guardrails/src/hook-framework/loader.js`
- Create: `demo/agent-security-guardrails/src/hook-framework/agent-adapter.js`
- Create: `demo/agent-security-guardrails/tests/registry.test.js`
- Create: `demo/agent-security-guardrails/tests/loader.test.js`

- [ ] **Step 1: Copy registry from reliability demo**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
cp demo/agent-reliability-guardrails/src/hook-framework/registry.js demo/agent-security-guardrails/src/hook-framework/registry.js
```

Expected: security demo now has `EventType`, `GuardrailDeny`, `HookRegistry`, `dispatch`, and `dispatchGate`.

- [ ] **Step 2: Create `agent-adapter.js`**

Create `demo/agent-security-guardrails/src/hook-framework/agent-adapter.js`:

```js
import { EventType } from './registry.js';

export class AgentSecurityAdapter {
  constructor({ registry, sessionId = `sess_${Date.now()}` } = {}) {
    if (!registry) {
      throw new Error('registry is required');
    }
    this.registry = registry;
    this.sessionId = sessionId;
    this.turnNumber = 0;
  }

  async beforeToolCall({ toolName, toolInput = {} }) {
    const context = {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      toolName,
      toolInput,
    };
    await this.registry.dispatch(EventType.BEFORE_TOOL_CALL, context);
    await this.registry.dispatchGate(EventType.BEFORE_TOOL_CALL, context);
  }

  async afterToolCall({ toolName, toolInput = {}, success = true, output = '', metadata = {} }) {
    const context = {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      toolName,
      toolInput,
      success,
      metadata: {
        ...metadata,
        toolOutput: output,
      },
    };
    await this.registry.dispatch(EventType.AFTER_TOOL_CALL, context);
    await this.registry.dispatchGate(EventType.AFTER_TOOL_CALL, context);
  }

  async sessionEnd(metadata = {}) {
    await this.registry.dispatch(EventType.SESSION_END, {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      metadata,
    });
    await this.registry.dispatchGate(EventType.SESSION_END, {
      sessionId: this.sessionId,
      turnNumber: this.turnNumber,
      metadata,
    });
  }
}
```

- [ ] **Step 3: Create loader with `deps` support**

Create `demo/agent-security-guardrails/src/hook-framework/loader.js` by copying the reliability loader, then change `loadStrategies()` so it resolves dependencies before constructing a strategy:

```js
  async loadStrategies(hooksDir, layerName, strategies) {
    for (const [strategyKey, entry] of Object.entries(strategies ?? {})) {
      const classRef = entry?.class;

      try {
        const { moduleName, exportName } = splitRef(classRef);
        const module = await this.loadModule(hooksDir, moduleName);
        const StrategyClass = module[exportName];

        if (typeof StrategyClass !== 'function') {
          this.log('strategy export is not a class', { class: classRef });
          continue;
        }

        const deps = {};
        let missingDep = false;
        for (const [paramName, refKey] of Object.entries(entry.deps ?? {})) {
          const dependency = this.#strategies[refKey];
          if (!dependency) {
            this.log('strategy dependency not found', { class: classRef, paramName, refKey });
            missingDep = true;
            break;
          }
          deps[paramName] = dependency;
        }
        if (missingDep) {
          continue;
        }

        const instance = new StrategyClass({ ...(entry.config ?? {}), ...deps });
        this.#strategies[strategyKey] = instance;

        for (const [eventName, methodName] of Object.entries(entry.hooks ?? {})) {
          const eventType = normalizeEventType(eventName);
          const method = instance[methodName];
          if (typeof method !== 'function') {
            this.log('strategy hook method is not a function', {
              eventName,
              class: classRef,
              methodName,
            });
            continue;
          }

          this.registry.register(
            eventType,
            method.bind(instance),
            this.handlerName(layerName, `${classRef}.${methodName}`),
            { mode: 'gate' },
          );
        }
      } catch (error) {
        this.log('failed to load strategy', { class: classRef, error });
      }
    }
  }
```

Keep `loadHooks()`, `loadModule()`, `splitRef()`, and `isInside()` from the reliability demo.

- [ ] **Step 4: Add registry tests**

Create `demo/agent-security-guardrails/tests/registry.test.js`:

```js
import { describe, expect, test, vi } from 'vitest';

import { EventType, GuardrailDeny, HookRegistry } from '../src/hook-framework/registry.js';

describe('HookRegistry', () => {
  test('dispatchGate propagates GuardrailDeny', async () => {
    const registry = new HookRegistry({ logger: vi.fn() });
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      throw new GuardrailDeny('blocked', { guardrail: 'test' });
    }, 'deny', { mode: 'gate' });

    await expect(registry.dispatchGate(EventType.BEFORE_TOOL_CALL, {})).rejects.toMatchObject({
      name: 'GuardrailDeny',
      reason: 'blocked',
    });
  });

  test('dispatch catches ordinary errors and continues', async () => {
    const logger = vi.fn();
    const after = vi.fn();
    const registry = new HookRegistry({ logger });
    registry.register(EventType.BEFORE_TOOL_CALL, () => {
      throw new Error('log failed');
    }, 'broken', { mode: 'observe' });
    registry.register(EventType.BEFORE_TOOL_CALL, after, 'after', { mode: 'observe' });

    await registry.dispatch(EventType.BEFORE_TOOL_CALL, {});

    expect(after).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 5: Add loader deps tests**

Create `demo/agent-security-guardrails/tests/loader.test.js` using temporary hook modules:

```js
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { HookLoader } from '../src/hook-framework/loader.js';
import { HookRegistry } from '../src/hook-framework/registry.js';

describe('HookLoader deps', () => {
  test('injects earlier strategy into later strategy', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-hooks-'));
    await fs.writeFile(path.join(dir, 'audit.js'), `
      export class Audit {
        constructor() { this.events = []; }
        recordEvent(type) { this.events.push(type); }
        getMetrics() { return { events: this.events }; }
      }
    `);
    await fs.writeFile(path.join(dir, 'gate.js'), `
      export class Gate {
        constructor({ audit }) { this.audit = audit; }
        beforeToolHandler() { this.audit.recordEvent('gate'); }
      }
    `);
    await fs.writeFile(path.join(dir, 'hooks.yaml'), `
strategies:
  audit:
    class: audit.Audit
    config: {}
  gate:
    class: gate.Gate
    deps:
      audit: audit
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
`);

    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });
    await loader.loadFromDirectory(dir, 'test');
    await registry.dispatchGate('before_tool_call', {});

    expect(loader.strategies.audit.getMetrics()).toEqual({ events: ['gate'] });
  });
});
```

- [ ] **Step 6: Run hook framework tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm test -- tests/registry.test.js tests/loader.test.js
```

Expected: both test files pass.

- [ ] **Step 7: Commit hook framework**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-security-guardrails
git commit -m "feat: add security hook framework"
```

Expected: commit includes the hook framework and tests.

---

### Task 3: Add Security Strategies

**Files:**
- Create: `demo/agent-security-guardrails/shared-hooks/audit-logger.js`
- Create: `demo/agent-security-guardrails/shared-hooks/sandbox-guard.js`
- Create: `demo/agent-security-guardrails/shared-hooks/permission-gate.js`
- Create: `demo/agent-security-guardrails/shared-hooks/credential-inject.js`
- Create: `demo/agent-security-guardrails/shared-hooks/structured-log.js`
- Create: `demo/agent-security-guardrails/shared-hooks/hooks.yaml`
- Create: `demo/agent-security-guardrails/workspace/demo-agent/security.yaml`
- Create: `demo/agent-security-guardrails/workspace/demo-agent/soul.md`
- Create: `demo/agent-security-guardrails/tests/strategies.test.js`

- [ ] **Step 1: Create `audit-logger.js`**

Create `demo/agent-security-guardrails/shared-hooks/audit-logger.js`:

```js
import fs from 'node:fs';
import path from 'node:path';

export class SecurityAuditLogger {
  constructor({ auditFile = process.env.SECURITY_AUDIT_FILE ?? '' } = {}) {
    this.auditFile = auditFile;
    this.events = [];
  }

  recordEvent(type, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      security_event: type,
      ...details,
    };
    this.events.push(entry);
    if (this.auditFile) {
      fs.mkdirSync(path.dirname(this.auditFile), { recursive: true });
      fs.appendFileSync(this.auditFile, `${JSON.stringify(entry)}\n`);
    }
  }

  sessionEndHandler(ctx) {
    this.recordEvent('session_summary', {
      session_id: ctx.sessionId,
      total_security_events: this.events.length,
      events_by_type: this.events.reduce((acc, event) => {
        acc[event.security_event] = (acc[event.security_event] ?? 0) + 1;
        return acc;
      }, {}),
    });
  }

  getMetrics() {
    return {
      total_security_events: this.events.length,
      events_by_type: this.events.reduce((acc, event) => {
        acc[event.security_event] = (acc[event.security_event] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }
}
```

- [ ] **Step 2: Create `sandbox-guard.js`**

Create `demo/agent-security-guardrails/shared-hooks/sandbox-guard.js` with:

```js
import { GuardrailDeny } from '../src/hook-framework/registry.js';

const PATH_TRAVERSAL = /\.\.[/\\]/;
const ENV_VAR_REF = /\$\{?\w+\}?/;
const DANGEROUS_COMMANDS = /\b(rm\s+-rf|sudo|chmod\s+777|curl\s.*\|.*sh|wget\s.*\|.*sh|eval|exec|dd\s+if=|mkfs|shred)\b/i;
const SHELL_INJECTION = /[;&|`]|\$\(/;
const COMMAND_FIELDS = new Set(['command', 'query', 'cmd', 'args', 'code', 'shell', 'script']);

export class SandboxGuard {
  constructor({ audit = null } = {}) {
    this.audit = audit;
    this.violations = [];
    this.warnings = [];
  }

  beforeToolHandler(ctx) {
    for (const [field, rawValue] of Object.entries(ctx.toolInput ?? {})) {
      const text = decodeURIComponent(String(rawValue ?? ''));
      if (!text) continue;

      if (PATH_TRAVERSAL.test(text)) {
        this.block(ctx, 'path_traversal', field, text);
      }

      const dangerous = text.match(DANGEROUS_COMMANDS);
      if (dangerous) {
        this.block(ctx, 'dangerous_command', field, text);
      }

      if (COMMAND_FIELDS.has(field.toLowerCase()) && SHELL_INJECTION.test(text)) {
        this.block(ctx, 'shell_injection', field, text);
      }

      if (ENV_VAR_REF.test(text)) {
        const warning = {
          type: 'env_var_reference',
          tool: ctx.toolName,
          field,
          input_preview: text.slice(0, 120),
        };
        this.warnings.push(warning);
        this.audit?.recordEvent('sandbox_warning', warning);
      }
    }
  }

  block(ctx, type, field, text) {
    const violation = {
      type,
      tool: ctx.toolName,
      field,
      input_preview: text.slice(0, 120),
    };
    this.violations.push(violation);
    this.audit?.recordEvent(`sandbox_${type}`, violation);
    throw new GuardrailDeny(`${type} blocked in ${ctx.toolName}.${field}`, {
      guardrail: 'sandbox_guard',
      violation,
    });
  }

  getMetrics() {
    return {
      total_violations: this.violations.length,
      violations_by_type: this.violations.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] ?? 0) + 1;
        return acc;
      }, {}),
      warning_count: this.warnings.length,
      blocked_tools: [...new Set(this.violations.map((item) => item.tool))],
    };
  }
}
```

- [ ] **Step 3: Create `permission-gate.js`**

Create `demo/agent-security-guardrails/shared-hooks/permission-gate.js`:

```js
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { GuardrailDeny } from '../src/hook-framework/registry.js';

const LEVELS = new Set(['allow', 'ask', 'deny']);

export class PermissionGate {
  constructor({
    policyPath = process.env.SECURITY_POLICY_PATH ?? 'workspace/demo-agent/security.yaml',
    defaultLevel = 'ask',
    audit = null,
  } = {}) {
    this.audit = audit;
    this.defaultLevel = normalizeLevel(defaultLevel);
    this.toolPermissions = new Map();
    this.decisions = [];
    this.loadPolicy(policyPath);
  }

  loadPolicy(policyPath) {
    const resolved = path.resolve(policyPath);
    if (!fs.existsSync(resolved)) return;
    const config = YAML.parse(fs.readFileSync(resolved, 'utf8')) ?? {};
    const permissions = config.permissions ?? {};
    if (permissions.default) {
      this.defaultLevel = normalizeLevel(permissions.default);
    }
    for (const [tool, level] of Object.entries(permissions.tools ?? {})) {
      this.toolPermissions.set(tool.toLowerCase(), normalizeLevel(level));
    }
  }

  beforeToolHandler(ctx) {
    const tool = String(ctx.toolName ?? '');
    const level = this.toolPermissions.get(tool.toLowerCase()) ?? this.defaultLevel;
    const decision = {
      tool,
      permission: level,
      policy_source: this.toolPermissions.has(tool.toLowerCase()) ? 'explicit' : 'default',
    };
    this.decisions.push(decision);

    if (level === 'deny') {
      this.audit?.recordEvent('permission_deny', decision);
      throw new GuardrailDeny(`Permission denied: tool '${tool}'`, {
        guardrail: 'permission_gate',
        decision,
      });
    }

    if (level === 'ask') {
      this.audit?.recordEvent('permission_ask', decision);
    }
  }

  getMetrics() {
    return {
      total_decisions: this.decisions.length,
      deny_count: this.decisions.filter((item) => item.permission === 'deny').length,
      ask_count: this.decisions.filter((item) => item.permission === 'ask').length,
      allow_count: this.decisions.filter((item) => item.permission === 'allow').length,
      denied_tools: this.decisions.filter((item) => item.permission === 'deny').map((item) => item.tool),
    };
  }
}

function normalizeLevel(level) {
  const normalized = String(level ?? '').toLowerCase();
  if (!LEVELS.has(normalized)) {
    throw new Error(`unknown permission level: ${level}`);
  }
  return normalized;
}
```

- [ ] **Step 4: Create `credential-inject.js`**

Create `demo/agent-security-guardrails/shared-hooks/credential-inject.js`:

```js
export class SecureToolWrapper {
  static wrap(tool, credentials = {}) {
    if (!tool || typeof tool.execute !== 'function') {
      throw new Error('tool.execute is required');
    }

    const resolved = SecureToolWrapper.resolveCredentials(credentials);
    return {
      ...tool,
      execute: async (input = {}) => tool.execute({ ...input, ...resolved }),
    };
  }

  static resolveCredentials(credentials = {}) {
    return Object.fromEntries(
      Object.entries(credentials).map(([paramName, envName]) => {
        const value = process.env[envName];
        if (!value) {
          throw new Error(`Credential '${paramName}' requires env var '${envName}'`);
        }
        return [paramName, value];
      }),
    );
  }

  static getCredentialStatus(credentials = {}) {
    return Object.fromEntries(
      Object.entries(credentials).map(([paramName, envName]) => {
        const value = process.env[envName] ?? '';
        return [paramName, {
          env_var: envName,
          is_set: Boolean(value),
          length: value.length,
        }];
      }),
    );
  }
}
```

- [ ] **Step 5: Create `structured-log.js` and YAML config**

Create `demo/agent-security-guardrails/shared-hooks/structured-log.js`:

```js
export function beforeToolHandler(ctx) {
  console.error(JSON.stringify({
    event: 'before_tool_call',
    tool: ctx.toolName,
    session_id: ctx.sessionId,
  }));
}

export function afterToolHandler(ctx) {
  console.error(JSON.stringify({
    event: 'after_tool_call',
    tool: ctx.toolName,
    success: ctx.success,
    guardrail_deny: Boolean(ctx.metadata?.guardrailDeny),
  }));
}
```

Create `demo/agent-security-guardrails/shared-hooks/hooks.yaml`:

```yaml
hooks:
  BEFORE_TOOL_CALL:
    - handler: structured-log.beforeToolHandler
  AFTER_TOOL_CALL:
    - handler: structured-log.afterToolHandler

strategies:
  audit-logger:
    class: audit-logger.SecurityAuditLogger
    config:
      auditFile: workspace/demo-agent/security-audit.jsonl
    hooks:
      SESSION_END: sessionEndHandler

  sandbox-guard:
    class: sandbox-guard.SandboxGuard
    deps:
      audit: audit-logger
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler

  permission-gate:
    class: permission-gate.PermissionGate
    config:
      defaultLevel: ask
    deps:
      audit: audit-logger
    hooks:
      BEFORE_TOOL_CALL: beforeToolHandler
```

- [ ] **Step 6: Create workspace policy and prompt files**

Create `demo/agent-security-guardrails/workspace/demo-agent/security.yaml`:

```yaml
permissions:
  default: ask
  tools:
    knowledge_search: allow
    safe_calculator: allow
    file_reader: ask
    shell_executor: deny
    email_sender: deny
    secure_api: allow
```

Create `demo/agent-security-guardrails/workspace/demo-agent/soul.md`:

```markdown
# Soul

你是一名受安全护栏保护的技术助手。

## 绝对禁止

- NEVER 执行 shell 命令或任何操作系统级指令
- NEVER 读取系统敏感路径（/etc、~/.ssh、用户主目录）
- NEVER 对外发送邮件或通过未授权 API 传输数据
```

- [ ] **Step 7: Add strategy tests**

Create `demo/agent-security-guardrails/tests/strategies.test.js` with tests for:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { GuardrailDeny } from '../src/hook-framework/registry.js';
import { SecurityAuditLogger } from '../shared-hooks/audit-logger.js';
import { SecureToolWrapper } from '../shared-hooks/credential-inject.js';
import { PermissionGate } from '../shared-hooks/permission-gate.js';
import { SandboxGuard } from '../shared-hooks/sandbox-guard.js';

describe('security strategies', () => {
  test('SandboxGuard blocks path traversal', () => {
    const audit = { recordEvent: vi.fn() };
    const guard = new SandboxGuard({ audit });

    expect(() => guard.beforeToolHandler({
      toolName: 'knowledge_search',
      toolInput: { query: '../../etc/passwd' },
    })).toThrow(GuardrailDeny);

    expect(guard.getMetrics()).toMatchObject({
      total_violations: 1,
      violations_by_type: { path_traversal: 1 },
      blocked_tools: ['knowledge_search'],
    });
    expect(audit.recordEvent).toHaveBeenCalledWith(
      'sandbox_path_traversal',
      expect.objectContaining({ tool: 'knowledge_search' }),
    );
  });

  test('SandboxGuard allows markdown table pipe in content field', () => {
    const guard = new SandboxGuard();

    expect(() => guard.beforeToolHandler({
      toolName: 'write_doc',
      toolInput: { content: '| a | b |\\n|---|---|' },
    })).not.toThrow();
  });

  test('PermissionGate denies explicit deny tool', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-'));
    const policy = path.join(tmp, 'security.yaml');
    fs.writeFileSync(policy, 'permissions:\\n  default: ask\\n  tools:\\n    shell_executor: deny\\n');
    const audit = { recordEvent: vi.fn() };
    const gate = new PermissionGate({ policyPath: policy, audit });

    expect(() => gate.beforeToolHandler({ toolName: 'shell_executor' })).toThrow(GuardrailDeny);
    expect(gate.getMetrics()).toMatchObject({ deny_count: 1, denied_tools: ['shell_executor'] });
  });

  test('PermissionGate records ask for default tool', () => {
    const gate = new PermissionGate({ policyPath: '', defaultLevel: 'ask' });

    expect(() => gate.beforeToolHandler({ toolName: 'new_tool' })).not.toThrow();
    expect(gate.getMetrics()).toMatchObject({ ask_count: 1 });
  });

  test('SecureToolWrapper injects credential without changing definition', async () => {
    process.env.TEST_API_KEY = 'sk-secret-value';
    const tool = {
      definition: {
        type: 'function',
        function: {
          name: 'secure_api',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      execute: async ({ query, apiKey }) => ({ query, apiKey }),
    };

    const wrapped = SecureToolWrapper.wrap(tool, { apiKey: 'TEST_API_KEY' });
    const result = await wrapped.execute({ query: 'hello' });

    expect(result).toEqual({ query: 'hello', apiKey: 'sk-secret-value' });
    expect(JSON.stringify(wrapped.definition)).not.toContain('sk-secret-value');
  });

  test('SecurityAuditLogger writes jsonl and metrics', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
    const auditFile = path.join(tmp, 'security-audit.jsonl');
    const logger = new SecurityAuditLogger({ auditFile });

    logger.recordEvent('permission_deny', { tool: 'shell_executor' });
    logger.sessionEndHandler({ sessionId: 'sess-test' });

    const lines = fs.readFileSync(auditFile, 'utf8').trim().split('\\n').map(JSON.parse);
    expect(lines).toHaveLength(2);
    expect(logger.getMetrics().total_security_events).toBe(2);
  });
});
```

- [ ] **Step 8: Run strategy tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm test -- tests/strategies.test.js
```

Expected: tests pass.

- [ ] **Step 9: Commit security strategies**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-security-guardrails
git commit -m "feat: add agent security strategies"
```

Expected: commit includes shared hooks, workspace policy, and strategy tests.

---

### Task 4: Add Deterministic Scenario Runner

**Files:**
- Create: `demo/agent-security-guardrails/src/agent/real-agent.js`
- Create: `demo/agent-security-guardrails/src/demo.js`
- Create: `demo/agent-security-guardrails/tests/agent-loop.test.js`
- Create: `demo/agent-security-guardrails/tests/e2e.test.js`

- [ ] **Step 1: Create `real-agent.js`**

Create `demo/agent-security-guardrails/src/agent/real-agent.js`:

```js
import { GuardrailDeny } from '../hook-framework/registry.js';
import { SecureToolWrapper } from '../../shared-hooks/credential-inject.js';

export function makeTools() {
  return {
    knowledge_search: {
      definition: {
        type: 'function',
        function: {
          name: 'knowledge_search',
          description: 'Search a safe local knowledge base.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      execute: async ({ query }) => ({ results: [`result for ${query}`] }),
    },
    shell_executor: {
      definition: {
        type: 'function',
        function: {
          name: 'shell_executor',
          description: 'Execute system commands. Demo only; should be denied.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      execute: async ({ query }) => ({ breached: true, command: query }),
    },
    secure_api: SecureToolWrapper.wrap({
      definition: {
        type: 'function',
        function: {
          name: 'secure_api',
          description: 'Call secure API with a runtime credential.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      },
      execute: async ({ query, apiKey }) => ({
        ok: true,
        query,
        keyPreview: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
      }),
    }, { apiKey: 'SECURE_API_KEY' }),
  };
}

export async function runGuardedToolCall({ adapter, toolName, toolInput = {}, execute }) {
  try {
    await adapter.beforeToolCall({ toolName, toolInput });
  } catch (error) {
    if (error instanceof GuardrailDeny) {
      try {
        await adapter.afterToolCall({
          toolName,
          toolInput,
          success: false,
          output: '',
          metadata: {
            guardrailDeny: true,
            denyReason: error.reason,
            deniedBeforeExecution: true,
          },
        });
      } catch (closeError) {
        error.closeError = closeError;
      }
    }
    throw error;
  }

  const output = await execute(toolInput);
  await adapter.afterToolCall({
    toolName,
    toolInput,
    success: true,
    output: JSON.stringify(output),
  });
  return output;
}

export async function runSecurityScenario({ adapter, scenario = 'normal', tools = makeTools() }) {
  const calls = {
    normal: { toolName: 'knowledge_search', toolInput: { query: 'agent security' } },
    privilege: { toolName: 'shell_executor', toolInput: { query: 'whoami' } },
    inject: { toolName: 'knowledge_search', toolInput: { query: '../../etc/passwd' } },
    'api-leak': { toolName: 'secure_api', toolInput: { query: 'account status' } },
  };
  const call = calls[scenario];
  if (!call) {
    throw new Error(`unknown scenario: ${scenario}`);
  }
  const tool = tools[call.toolName];
  if (!tool) {
    throw new Error(`unknown tool: ${call.toolName}`);
  }
  return runGuardedToolCall({
    adapter,
    toolName: call.toolName,
    toolInput: call.toolInput,
    execute: tool.execute,
  });
}
```

- [ ] **Step 2: Create `demo.js`**

Create `demo/agent-security-guardrails/src/demo.js`:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { runSecurityScenario } from './agent/real-agent.js';
import { AgentSecurityAdapter } from './hook-framework/agent-adapter.js';
import { HookLoader } from './hook-framework/loader.js';
import { GuardrailDeny, HookRegistry } from './hook-framework/registry.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.resolve(moduleDir, '..');
dotenv.config({ path: path.join(demoRoot, '.env') });

process.env.SECURITY_POLICY_PATH ??= path.join(demoRoot, 'workspace/demo-agent/security.yaml');
process.env.SECURITY_AUDIT_FILE ??= path.join(demoRoot, 'workspace/demo-agent/security-audit.jsonl');

export async function main({
  scenario = process.env.SECURITY_SCENARIO ?? 'normal',
  logger = console.log,
} = {}) {
  const registry = new HookRegistry();
  const loader = new HookLoader(registry);
  await loader.loadFromDirectory(path.join(demoRoot, 'shared-hooks'), 'global');
  const adapter = new AgentSecurityAdapter({ registry });

  try {
    const result = await runSecurityScenario({ adapter, scenario });
    await adapter.sessionEnd({ result });
    logger(`Scenario: ${scenario}`);
    logger(`Result: ${JSON.stringify(result)}`);
    printMetrics(loader.strategies, logger);
    return { ok: true, result, strategies: loader.strategies };
  } catch (error) {
    await adapter.sessionEnd({ error: error.message });
    if (error instanceof GuardrailDeny) {
      logger(`Scenario: ${scenario}`);
      logger(`Guardrail triggered: ${error.reason}`);
      printMetrics(loader.strategies, logger);
      return { ok: false, denied: true, error, strategies: loader.strategies };
    }
    throw error;
  }
}

export function printMetrics(strategies, logger = console.log) {
  for (const [name, strategy] of Object.entries(strategies ?? {})) {
    if (typeof strategy.getMetrics === 'function') {
      logger(`[${name}] ${JSON.stringify(strategy.getMetrics())}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 3: Add agent-loop tests**

Create `demo/agent-security-guardrails/tests/agent-loop.test.js`:

```js
import { describe, expect, test, vi } from 'vitest';

import { runGuardedToolCall } from '../src/agent/real-agent.js';
import { GuardrailDeny } from '../src/hook-framework/registry.js';

describe('guarded tool lifecycle', () => {
  test('does not execute tool when beforeToolCall denies', async () => {
    const execute = vi.fn();
    const adapter = {
      beforeToolCall: vi.fn(async () => {
        throw new GuardrailDeny('blocked before execution');
      }),
      afterToolCall: vi.fn(),
    };

    await expect(runGuardedToolCall({
      adapter,
      toolName: 'shell_executor',
      toolInput: { query: 'whoami' },
      execute,
    })).rejects.toThrow(GuardrailDeny);

    expect(execute).not.toHaveBeenCalled();
    expect(adapter.afterToolCall).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      metadata: expect.objectContaining({ deniedBeforeExecution: true }),
    }));
  });
});
```

- [ ] **Step 4: Add e2e tests**

Create `demo/agent-security-guardrails/tests/e2e.test.js`:

```js
import { describe, expect, test } from 'vitest';

import { main } from '../src/demo.js';

describe('security scenarios', () => {
  test('normal scenario succeeds', async () => {
    const lines = [];
    const result = await main({ scenario: 'normal', logger: (line) => lines.push(line) });
    expect(result.ok).toBe(true);
    expect(lines.join('\n')).toContain('Scenario: normal');
  });

  test('privilege scenario is denied by PermissionGate', async () => {
    const result = await main({ scenario: 'privilege', logger: () => {} });
    expect(result.denied).toBe(true);
    expect(result.error.metadata.guardrail).toBe('permission_gate');
  });

  test('inject scenario is denied by SandboxGuard', async () => {
    const result = await main({ scenario: 'inject', logger: () => {} });
    expect(result.denied).toBe(true);
    expect(result.error.metadata.guardrail).toBe('sandbox_guard');
  });

  test('api-leak scenario injects secret but exposes only preview', async () => {
    process.env.SECURE_API_KEY = 'sk-TEST-SECRET-xxxxxxxx';
    const result = await main({ scenario: 'api-leak', logger: () => {} });
    expect(result.ok).toBe(true);
    expect(result.result.keyPreview).toBe('sk-T...xxxx');
    expect(JSON.stringify(result.result)).not.toContain('sk-TEST-SECRET-xxxxxxxx');
  });
});
```

- [ ] **Step 5: Run full tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Run scenario commands**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm start
npm run attack:privilege
npm run attack:inject
npm run attack:api-leak
```

Expected:

- `npm start` prints `Scenario: normal` and result JSON.
- `attack:privilege` prints `Guardrail triggered` with permission denial.
- `attack:inject` prints `Guardrail triggered` with sandbox denial.
- `attack:api-leak` prints a result with a redacted key preview.

- [ ] **Step 7: Commit scenario runner**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add demo/agent-security-guardrails
git commit -m "feat: add security guardrail scenarios"
```

Expected: commit includes scenario runner and tests.

---

### Task 5: Write The Article From The JS Demo

**Files:**
- Create: `source/_posts/ai-agent-security-guardrails.md`

- [ ] **Step 1: Read write-tech-article skill**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
sed -n '1,260p' .agents/skills/write-tech-article/SKILL.md
```

Expected: output includes Ayou style requirements. Treat the already-approved spec and this plan as the confirmed outline.

- [ ] **Step 2: Create the article**

Create `source/_posts/ai-agent-security-guardrails.md` with:

```markdown
---
title: 别把 Agent 安全写进 Prompt：用 Hook 做沙箱、权限和凭证隔离
date: 2026-05-19 10:00:00
tags:
  - ai
  - agent
  - javascript
categories:
  - ai
description: 用一个 JS demo 拆解 Agent 运行时安全护栏：工具参数怎么消毒，权限怎么拦，API Key 怎么不进模型上下文。
---

# 前言

# 一、Prompt 禁止了，为什么还要 Hook 拦？

# 二、拦截点在哪里：BEFORE_TOOL_CALL

# 三、第一道门：SandboxGuard

# 四、第二道门：PermissionGate

# 五、第三道门：SecureToolWrapper

# 六、安全事件要留痕

# 七、三层护栏

# 总结
```

- [ ] **Step 3: Fill article sections**

Write the article with these exact section responsibilities:

- `# 前言`: Chatbot 安全和 Agent 安全的区别；接上一篇可靠性护栏；落点是“可靠性防蠢，安全性防骗”。
- `# 一`: Use `npm run attack:privilege`, `workspace/demo-agent/soul.md`, and `src/agent/real-agent.js` as the opening case.
- `# 二`: Explain `dispatchGate`, `GuardrailDeny`, `runGuardedToolCall`, and contrast Python `pending_deny` as a framework-adapter detail.
- `# 三`: Explain JS `SandboxGuard`, field-sensitive checks, and why deterministic rules should handle deterministic attack strings.
- `# 四`: Explain JS `PermissionGate`, `security.yaml`, explicit policy versus default `ask`.
- `# 五`: Explain JS `SecureToolWrapper`, runtime env injection, and model-facing schema isolation.
- `# 六`: Explain `SecurityAuditLogger`, JSONL, `hooks.yaml` strategy order, and `deps`.
- `# 七`: Summarize L30/L31/L32 as observable/reliable/secure runtime layers.
- `# 总结`: 3-5 sentences, ending with XiaoPaw hardening as the next direction.

Use only short code snippets from the JS demo. Do not paste Python code as the main article evidence.

- [ ] **Step 4: Verify article structure and terms**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
rg -n "^# |SandboxGuard|PermissionGate|SecureToolWrapper|SecurityAuditLogger|dispatchGate|GuardrailDeny|pending_deny|deps|npm run attack" source/_posts/ai-agent-security-guardrails.md
```

Expected: headings are present and all required concepts appear.

- [ ] **Step 5: Run article style checks without Hexo**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
rg -n "此外|至关重要|深入探讨|不仅.*而且|未来可期|综上所述|值得注意的是|本文介绍|接下来我们将" source/_posts/ai-agent-security-guardrails.md
rg -n "欢迎回来|今天这节课|字幕|课程原文|这些都不是假设" source/_posts/ai-agent-security-guardrails.md
rg -n "!\[|\\.png\\)|\\.jpg\\)|\\.jpeg\\)" source/_posts/ai-agent-security-guardrails.md
```

Expected: no output. Rewrite any matched lines.

- [ ] **Step 6: Commit article**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git add source/_posts/ai-agent-security-guardrails.md
git commit -m "docs: add agent security guardrails article"
```

Expected: commit includes only the article file.

---

### Task 6: Final Verification And Handoff

**Files:**
- Read: `demo/agent-security-guardrails/**`
- Read: `source/_posts/ai-agent-security-guardrails.md`

- [ ] **Step 1: Run final JS tests**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run final security scenarios**

Run:

```bash
cd /Users/youxingzhi/ayou/blog/demo/agent-security-guardrails
npm start
npm run attack:privilege
npm run attack:inject
npm run attack:api-leak
```

Expected: normal succeeds; privilege and inject are denied; api-leak succeeds with only a key preview.

- [ ] **Step 3: Confirm no Hexo commands are needed or run**

Do not run any Hexo commands. State in the final handoff that Hexo generation was skipped by user request.

- [ ] **Step 4: Check git status for scoped changes**

Run:

```bash
cd /Users/youxingzhi/ayou/blog
git status --short demo/agent-security-guardrails source/_posts/ai-agent-security-guardrails.md docs/superpowers/specs/2026-05-19-agent-security-guardrails-design.md docs/superpowers/plans/2026-05-19-agent-security-guardrails.md
```

Expected: no uncommitted changes in the implementation paths after final commits, unless the plan/spec docs are intentionally left uncommitted by the current planning turn.

- [ ] **Step 5: Final response**

Report:

- JS demo path: `demo/agent-security-guardrails/`
- Article path: `source/_posts/ai-agent-security-guardrails.md`
- Test command result: `npm test`
- Scenario command results
- Hexo commands were not run
