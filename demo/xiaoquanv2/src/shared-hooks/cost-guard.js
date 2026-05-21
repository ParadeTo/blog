import {DenyReason, GuardrailDeny} from '../hook-framework/registry.js'

export class CostGuard {
  constructor(config = {}) {
    this.budgetUsd = Number(config.budgetUsd ?? 1.0)
    this.inputUsdPerMillion = Number(config.inputUsdPerMillion ?? 0.5)
    this.outputUsdPerMillion = Number(config.outputUsdPerMillion ?? 1.5)
    this.sessionCosts = new Map()
    this.sessionUsage = new Map()
  }

  async beforeToolHandler(ctx) {
    const spent = this.sessionCosts.get(ctx.sessionId) || 0
    if (spent > this.budgetUsd) {
      const usage = this.sessionUsage.get(ctx.sessionId) || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        spentUsd: roundUsd(spent),
      }
      const costUsage = {
        spentUsd: roundUsd(spent),
        budgetUsd: this.budgetUsd,
        exceededByUsd: roundUsd(spent - this.budgetUsd),
        inputUsdPerMillion: this.inputUsdPerMillion,
        outputUsdPerMillion: this.outputUsdPerMillion,
      }
      throw new GuardrailDeny(
        DenyReason.BUDGET_EXCEEDED,
        `Budget exceeded: $${spent.toFixed(6)} > $${this.budgetUsd}`,
        {
          metadata: {
            usage: {
              ...usage,
              budgetUsd: this.budgetUsd,
              exceededByUsd: costUsage.exceededByUsd,
            },
            costUsage,
          },
        },
      )
    }
  }

  async afterTurnHandler(ctx) {
    const inputTokens = ctx.inputTokens || 0
    const outputTokens = ctx.outputTokens || 0
    const inputCost = (inputTokens / 1_000_000) * this.inputUsdPerMillion
    const outputCost = (outputTokens / 1_000_000) * this.outputUsdPerMillion
    const turnCost = inputCost + outputCost
    const previousCost = this.sessionCosts.get(ctx.sessionId) || 0
    const nextCost = previousCost + turnCost
    const previousUsage = this.sessionUsage.get(ctx.sessionId) || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }

    this.sessionCosts.set(ctx.sessionId, nextCost)
    this.sessionUsage.set(ctx.sessionId, {
      inputTokens: previousUsage.inputTokens + inputTokens,
      outputTokens: previousUsage.outputTokens + outputTokens,
      totalTokens: previousUsage.totalTokens + inputTokens + outputTokens,
      spentUsd: roundUsd(nextCost),
      lastTurn: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: roundUsd(turnCost),
      },
    })
  }
}

function roundUsd(value) {
  return Number(value.toFixed(12))
}
