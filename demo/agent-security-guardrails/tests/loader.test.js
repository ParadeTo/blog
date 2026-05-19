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
