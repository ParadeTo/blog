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
    if (!policyPath) {
      return;
    }

    const resolved = path.resolve(policyPath);
    if (!fs.existsSync(resolved)) {
      return;
    }

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
    const toolKey = tool.toLowerCase();
    const level = this.toolPermissions.get(toolKey) ?? this.defaultLevel;
    const decision = {
      tool,
      permission: level,
      policy_source: this.toolPermissions.has(toolKey) ? 'explicit' : 'default',
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
      denied_tools: this.decisions
        .filter((item) => item.permission === 'deny')
        .map((item) => item.tool),
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
