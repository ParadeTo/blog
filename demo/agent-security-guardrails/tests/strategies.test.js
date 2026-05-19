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

    expect(() =>
      guard.beforeToolHandler({
        toolName: 'knowledge_search',
        toolInput: { query: '../../etc/passwd' },
      }),
    ).toThrow(GuardrailDeny);

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

    expect(() =>
      guard.beforeToolHandler({
        toolName: 'write_doc',
        toolInput: { content: '| a | b |\n|---|---|' },
      }),
    ).not.toThrow();
  });

  test('PermissionGate denies explicit deny tool', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-'));
    const policy = path.join(tmp, 'security.yaml');
    fs.writeFileSync(policy, 'permissions:\n  default: ask\n  tools:\n    shell_executor: deny\n');
    const audit = { recordEvent: vi.fn() };
    const gate = new PermissionGate({ policyPath: policy, audit });

    expect(() => gate.beforeToolHandler({ toolName: 'shell_executor' })).toThrow(GuardrailDeny);
    expect(gate.getMetrics()).toMatchObject({
      deny_count: 1,
      denied_tools: ['shell_executor'],
    });
    expect(audit.recordEvent).toHaveBeenCalledWith(
      'permission_deny',
      expect.objectContaining({ tool: 'shell_executor' }),
    );
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

    const lines = fs.readFileSync(auditFile, 'utf8').trim().split('\n').map(JSON.parse);
    expect(lines).toHaveLength(2);
    expect(logger.getMetrics().total_security_events).toBe(2);
  });
});
