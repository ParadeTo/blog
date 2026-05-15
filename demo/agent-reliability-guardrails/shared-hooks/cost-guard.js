import { GuardrailDeny } from '../src/hook-framework/registry.js';

const MODEL_PRICES = Object.freeze({
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5.4-nano-2026-03-17': { input: 0.05, output: 0.4 },
  'qwen-plus': { input: 0.8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
});

const FALLBACK_PRICE = Object.freeze({ input: 1, output: 3 });

export class CostGuard {
  constructor({ budgetUsd = 1, model, logger = console.error } = {}) {
    this.budgetUsd = parseBudget(process.env.COST_GUARD_BUDGET ?? budgetUsd);
    this.model = model ?? process.env.AGENT_MODEL ?? 'gpt-4o-mini';
    this.logger = logger;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.totalCostUsd = 0;
    this.denyCount = 0;
  }

  beforeToolHandler(ctx = {}) {
    this.denyIfOverBudget(ctx);
  }

  afterTurnHandler(ctx) {
    this.inputTokens += Number(ctx.inputTokens ?? 0);
    this.outputTokens += Number(ctx.outputTokens ?? 0);
    this.totalCostUsd = this.calculateCost();

    this.emitCostUpdate(ctx);
    this.denyIfOverBudget(ctx);
  }

  emitCostUpdate(ctx) {
    this.logger(JSON.stringify({
      level: 'INFO',
      guardrail: 'cost_guard',
      turn: ctx.turnNumber ?? ctx.turn ?? 0,
      input_tokens: this.inputTokens,
      output_tokens: this.outputTokens,
      estimated_cost_usd: this.totalCostUsd,
      budget_usd: this.budgetUsd,
      remaining_usd: this.remainingUsd(),
    }));
  }

  denyIfOverBudget(ctx = {}) {
    if (this.totalCostUsd < this.budgetUsd) {
      return;
    }

    this.denyCount += 1;
    const reason = 'Cost budget exceeded - terminating';

    this.logger(JSON.stringify({
      level: 'CRITICAL',
      guardrail: 'cost_guard',
      message: reason,
      turn: ctx.turnNumber ?? ctx.turn ?? 0,
      estimated_cost_usd: this.totalCostUsd,
      budget_usd: this.budgetUsd,
    }));

    throw new GuardrailDeny(reason, { guardrail: 'cost_guard' });
  }

  calculateCost() {
    const price = MODEL_PRICES[this.model] ?? FALLBACK_PRICE;

    return (this.inputTokens * price.input + this.outputTokens * price.output) / 1_000_000;
  }

  remainingUsd() {
    return Math.max(this.budgetUsd - this.totalCostUsd, 0);
  }

  getMetrics() {
    return {
      model: this.model,
      total_input_tokens: this.inputTokens,
      total_output_tokens: this.outputTokens,
      estimated_cost_usd: this.totalCostUsd,
      budget_usd: this.budgetUsd,
      remaining_usd: this.remainingUsd(),
      budget_utilization: this.budgetUsd === 0 ? 1 : this.totalCostUsd / this.budgetUsd,
      deny_count: this.denyCount,
    };
  }
}

function parseBudget(value) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('cost guard budget must be a non-negative finite number');
  }

  return parsed;
}
