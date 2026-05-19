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
