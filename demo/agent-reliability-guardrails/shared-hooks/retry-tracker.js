export class RetryTracker {
  constructor({ maxRetries = 3, logger = console.error } = {}) {
    this.maxRetries = parsePositiveInteger(maxRetries, 'maxRetries');
    this.logger = logger;
    this.failures = new Map();
    this.repeatedFailuresAfterFirst = 0;
    this.recoveriesAfterFailure = 0;
  }

  afterToolHandler(ctx) {
    const toolName = ctx.toolName || 'unknown';
    const currentFailures = this.failures.get(toolName) ?? 0;

    if (ctx.success) {
      if (currentFailures > 0) {
        this.recoveriesAfterFailure += 1;
        this.failures.set(toolName, 0);
      }
      return;
    }

    const nextFailures = currentFailures + 1;
    this.failures.set(toolName, nextFailures);

    if (currentFailures > 0) {
      this.repeatedFailuresAfterFirst += 1;
    }

    if (nextFailures >= this.maxRetries) {
      this.logger(JSON.stringify({
        level: 'WARNING',
        guardrail: 'retry_tracker',
        message: `Tool '${toolName}' failed ${nextFailures} times consecutively`,
        tool: toolName,
        consecutive_failures: nextFailures,
        max_retries: this.maxRetries,
      }));
    }
  }

  getMetrics() {
    return {
      repeated_failures_after_first: this.repeatedFailuresAfterFirst,
      recoveries_after_failure: this.recoveriesAfterFailure,
      active_failures: Object.fromEntries(this.failures),
    };
  }
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}
