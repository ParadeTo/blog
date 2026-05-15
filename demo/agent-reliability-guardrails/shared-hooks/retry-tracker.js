export class RetryTracker {
  constructor({ maxRetries = 3, logger = console.error } = {}) {
    this.maxRetries = maxRetries;
    this.logger = logger;
    this.failures = new Map();
    this.totalRetries = 0;
    this.successfulRetries = 0;
  }

  afterToolHandler(ctx) {
    const toolName = ctx.toolName || 'unknown';
    const currentFailures = this.failures.get(toolName) ?? 0;

    if (ctx.success) {
      if (currentFailures > 0) {
        this.successfulRetries += 1;
        this.failures.delete(toolName);
      }
      return;
    }

    const nextFailures = currentFailures + 1;
    this.failures.set(toolName, nextFailures);

    if (currentFailures > 0) {
      this.totalRetries += 1;
    }

    if (nextFailures >= this.maxRetries) {
      this.logger({
        level: 'WARN',
        guardrail: 'retry_tracker',
        message: 'tool has repeated consecutive failures',
        toolName,
        consecutiveFailures: nextFailures,
        maxRetries: this.maxRetries,
      });
    }
  }

  getMetrics() {
    return {
      total_retries: this.totalRetries,
      successful_retries: this.successfulRetries,
      retry_success_rate: roundToTwo(this.successfulRetries / Math.max(this.totalRetries, 1)),
      active_failures: Object.fromEntries(this.failures),
    };
  }
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}
