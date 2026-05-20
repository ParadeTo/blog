import {DenyReason, GuardrailDeny} from '../hook-framework/registry.js'

export class CostGuard {
  constructor(config = {}) {
    this.budgetUsd = Number(config.budgetUsd ?? 1.0)
    this.inputUsdPerMillion = Number(config.inputUsdPerMillion ?? 0.5)
    this.outputUsdPerMillion = Number(config.outputUsdPerMillion ?? 1.5)
    this.sessionCosts = new Map()
  }

  async beforeToolHandler(ctx) {
    const spent = this.sessionCosts.get(ctx.sessionId) || 0
    if (spent > this.budgetUsd) {
      throw new GuardrailDeny(
        DenyReason.BUDGET_EXCEEDED,
        `Budget exceeded: $${spent.toFixed(6)} > $${this.budgetUsd}`,
      )
    }
  }

  async afterTurnHandler(ctx) {
    const inputCost = (ctx.inputTokens / 1_000_000) * this.inputUsdPerMillion
    const outputCost = (ctx.outputTokens / 1_000_000) * this.outputUsdPerMillion
    this.sessionCosts.set(
      ctx.sessionId,
      (this.sessionCosts.get(ctx.sessionId) || 0) + inputCost + outputCost,
    )
  }
}
