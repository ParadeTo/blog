import { GuardrailDeny } from '../src/hook-framework/registry.js';

const PATH_TRAVERSAL = /\.\.[/\\]/;
const ENV_VAR_REF = /\$\{?\w+\}?/;
const DANGEROUS_COMMANDS =
  /\b(rm\s+-rf|sudo|chmod\s+777|curl\s.*\|.*sh|wget\s.*\|.*sh|eval|exec|dd\s+if=|mkfs|shred)\b/i;
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
      const text = safeDecode(String(rawValue ?? ''));
      if (!text) {
        continue;
      }

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

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
