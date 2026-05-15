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

  test('loaded strategies run once when dispatch and dispatchGate both run for one event', async () => {
    await fs.writeFile(
      path.join(tempRoot, 'hooks.yaml'),
      [
        'strategies:',
        '  counter:',
        '    class: counter.CounterStrategy',
        '    hooks:',
        '      AFTER_TURN: afterTurn',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(tempRoot, 'counter.js'),
      [
        'export class CounterStrategy {',
        '  constructor() {',
        '    this.count = 0;',
        '  }',
        '  afterTurn() {',
        '    this.count += 1;',
        '  }',
        '  getMetrics() {',
        '    return { count: this.count };',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });

    await loader.loadFromDirectory(tempRoot, 'workspace');
    await registry.dispatch('after_turn', {});
    await registry.dispatchGate('after_turn', {});

    expect(loader.strategies.counter.getMetrics()).toEqual({ count: 1 });
    expect(registry.summary().after_turn).toEqual([
      '[workspace] counter.CounterStrategy.afterTurn',
    ]);
  });

  test('loadTwoLayers registers global hooks before workspace hooks and tolerates missing workspace hooks', async () => {
    const globalDir = path.join(tempRoot, 'global');
    const workspaceDir = path.join(tempRoot, 'workspace');
    const workspaceHooksDir = path.join(workspaceDir, 'hooks');
    await fs.mkdir(globalDir, { recursive: true });
    await fs.mkdir(workspaceHooksDir, { recursive: true });
    await fs.writeFile(
      path.join(globalDir, 'hooks.yaml'),
      [
        'hooks:',
        '  BEFORE_TURN:',
        '    - handler: globalObserver.onTurn',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(globalDir, 'globalObserver.js'),
      [
        'export function onTurn(ctx) {',
        "  ctx.metadata.hit.push('global');",
        '}',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(workspaceHooksDir, 'hooks.yaml'),
      [
        'hooks:',
        '  BEFORE_TURN:',
        '    - handler: workspaceObserver.onTurn',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(workspaceHooksDir, 'workspaceObserver.js'),
      [
        'export function onTurn(ctx) {',
        "  ctx.metadata.hit.push('workspace');",
        '}',
        '',
      ].join('\n'),
    );
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger: vi.fn() });
    const metadata = { hit: [] };

    await loader.loadTwoLayers(globalDir, workspaceDir);
    await registry.dispatch('BEFORE_TURN', { metadata });

    expect(metadata.hit).toEqual(['global', 'workspace']);
    expect(registry.summary().before_turn).toEqual([
      '[global] globalObserver.onTurn',
      '[workspace] workspaceObserver.onTurn',
    ]);

    const missingWorkspaceRegistry = new HookRegistry({ logger: vi.fn() });
    const missingWorkspaceLoader = new HookLoader(missingWorkspaceRegistry, { logger: vi.fn() });

    await expect(
      missingWorkspaceLoader.loadTwoLayers(globalDir, path.join(tempRoot, 'missing-workspace')),
    ).resolves.toBeUndefined();
    expect(missingWorkspaceRegistry.summary().before_turn).toEqual([
      '[global] globalObserver.onTurn',
    ]);
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

  test('rejects handler symlinks that resolve outside hooks directory', async () => {
    const outsideModulePath = path.join(tempRoot, '..', `${path.basename(tempRoot)}-outside.js`);
    await fs.writeFile(
      path.join(tempRoot, 'hooks.yaml'),
      [
        'hooks:',
        '  BEFORE_TURN:',
        '    - handler: linked.onTurn',
        '',
      ].join('\n'),
    );
    await fs.writeFile(
      outsideModulePath,
      [
        'export function onTurn(ctx) {',
        "  ctx.metadata.hit.push('outside');",
        '}',
        '',
      ].join('\n'),
    );
    await fs.symlink(outsideModulePath, path.join(tempRoot, 'linked.js'));
    const logger = vi.fn();
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger });

    try {
      await loader.loadFromDirectory(tempRoot, 'workspace');

      expect(registry.handlerCount('BEFORE_TURN')).toBe(0);
      expect(logger).toHaveBeenCalled();
    } finally {
      await fs.rm(outsideModulePath, { force: true });
    }
  });

  test('rejects strategy class path traversal', async () => {
    await fs.writeFile(
      path.join(tempRoot, 'hooks.yaml'),
      [
        'strategies:',
        '  evil:',
        '    class: ../evil.EvilStrategy',
        '    hooks:',
        '      BEFORE_TOOL_CALL: beforeTool',
        '',
      ].join('\n'),
    );
    const logger = vi.fn();
    const registry = new HookRegistry({ logger: vi.fn() });
    const loader = new HookLoader(registry, { logger });

    await loader.loadFromDirectory(tempRoot, 'workspace');

    expect(registry.handlerCount('BEFORE_TOOL_CALL')).toBe(0);
    expect(logger).toHaveBeenCalled();
  });
});
