import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { HookLoader } from '../src/hook-framework/loader.js';
import { HookRegistry } from '../src/hook-framework/registry.js';

describe('hook loader', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hook-loader-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('loads stateless hooks from hooks.yaml', async () => {
    await fs.writeFile(
      path.join(tempRoot, 'hooks.yaml'),
      [
        'hooks:',
        '  BEFORE_TURN:',
        '    - handler: observer.onTurn',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(tempRoot, 'observer.js'),
      [
        'export function onTurn(ctx) {',
        "  ctx.metadata.hit.push('observer');",
        '}',
        '',
      ].join('\n'),
    );
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });
    const metadata = { hit: [] };

    await loader.loadFromDirectory(tempRoot, 'workspace');
    await registry.dispatch('BEFORE_TURN', { metadata });

    expect(metadata.hit).toEqual(['observer']);
  });

  test('loads stateful strategies and shares instance state across events', async () => {
    await fs.writeFile(
      path.join(tempRoot, 'hooks.yaml'),
      [
        'strategies:',
        '  counter:',
        '    class: counter.CounterStrategy',
        '    config:',
        '      label: cost',
        '    hooks:',
        '      BEFORE_TOOL_CALL: beforeTool',
        '      AFTER_TURN: afterTurn',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(tempRoot, 'counter.js'),
      [
        'export class CounterStrategy {',
        '  constructor(config) {',
        '    this.label = config.label;',
        '    this.count = 0;',
        '  }',
        '  beforeTool() {',
        '    this.count += 1;',
        '  }',
        '  afterTurn() {',
        '    this.count += 1;',
        '  }',
        '  getMetrics() {',
        '    return { label: this.label, count: this.count };',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });

    await loader.loadFromDirectory(tempRoot, 'workspace');
    await registry.dispatchGate('before_tool_call', {});
    await registry.dispatchGate('after_turn', {});

    expect(loader.strategies.counter.getMetrics()).toEqual({ label: 'cost', count: 2 });
  });

  test('rejects handler path traversal', async () => {
    await fs.writeFile(
      path.join(tempRoot, 'hooks.yaml'),
      [
        'hooks:',
        '  BEFORE_TURN:',
        '    - handler: ../evil.onTurn',
        '',
      ].join('\n'),
    );
    const logger = vi.fn();
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger });

    await loader.loadFromDirectory(tempRoot, 'workspace');

    expect(registry.handlerCount('BEFORE_TURN')).toBe(0);
    expect(logger).toHaveBeenCalled();
  });
});
