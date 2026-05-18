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
    this.budget = parseBudget(process.env.COST_GUARD_BUDGET ?? budgetUsd);
    this.budgetUsd = this.budget;
    this.model = model ?? process.env.AGENT_MODEL ?? 'gpt-4o-mini';
    this.logger = logger;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.estimatedCost = 0;
    this.totalCostUsd = this.estimatedCost;
    this.denyCount = 0;
  }

  afterTurnHandler(ctx) {
    this.inputTokens += Number(ctx.inputTokens ?? 0);
    this.outputTokens += Number(ctx.outputTokens ?? 0);
    this.estimatedCost = this.calculateCost();
    this.totalCostUsd = this.estimatedCost;

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
      estimated_cost_usd: roundUsd(this.estimatedCost),
      budget_usd: roundUsd(this.budget),
      remaining_usd: this.remainingUsd(),
    }));
  }

  denyIfOverBudget(ctx = {}) {
    if (this.estimatedCost < this.budget) {
      return;
    }

    this.denyCount += 1;
    const logMessage = 'Budget exceeded - blocking';
    const reason = `Budget exceeded: $${this.estimatedCost.toFixed(6)} >= limit $${this.budget.toFixed(6)}`;

    this.logger(JSON.stringify({
      level: 'CRITICAL',
      guardrail: 'cost_guard',
      message: logMessage,
      turn: ctx.turnNumber ?? ctx.turn ?? 0,
      estimated_cost_usd: roundUsd(this.estimatedCost),
      budget_usd: roundUsd(this.budget),
    }));

    throw new GuardrailDeny(reason, { guardrail: 'cost_guard' });
  }

  calculateCost() {
    const price = MODEL_PRICES[this.model] ?? FALLBACK_PRICE;

    return (this.inputTokens * price.input + this.outputTokens * price.output) / 1_000_000;
  }

  remainingUsd() {
    return roundUsd(Math.max(this.budget - this.estimatedCost, 0));
  }

  getMetrics() {
    return {
      model: this.model,
      total_input_tokens: this.inputTokens,
      total_output_tokens: this.outputTokens,
      estimated_cost_usd: roundUsd(this.estimatedCost),
      budget_usd: roundUsd(this.budget),
      remaining_usd: this.remainingUsd(),
      budget_utilization: Number((this.estimatedCost / Math.max(this.budget, 0.001)).toFixed(2)),
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

function roundUsd(value) {
  return Number(value.toFixed(6));
}
