import type { Model, ModelProvider } from "@openai/agents";
import { approximatePrices } from "./config";

export class BudgetReachedError extends Error {
  constructor() { super("budget reached"); this.name = "BudgetReachedError"; }
}

/** Shared by the Concierge, handoffs, nested matcher tool and the single repair attempt. */
export class RunBudget {
  calls = 0;
  costUSD = 0;
  constructor(readonly maxCalls: number, readonly maxUSD: number) {}
  admit(): void {
    if (this.calls >= this.maxCalls || this.costUSD >= this.maxUSD) throw new BudgetReachedError();
    this.calls++;
  }
  record(model: string, usage: { inputTokens: number; outputTokens: number }): void {
    // Unknown env override is conservatively estimated at the highest listed rate.
    const price = approximatePrices[model] ?? { input: 10, output: 50 };
    this.costUSD += (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
    if (this.costUSD >= this.maxUSD) throw new BudgetReachedError();
  }
}

export function budgetedProvider(provider: ModelProvider, budget: RunBudget): ModelProvider {
  return {
    async getModel(name) {
      const model = await provider.getModel(name);
      const wrapper: Model = {
        async getResponse(request) {
          budget.admit();
          const response = await model.getResponse(request);
          budget.record(name ?? "", response.usage);
          return response;
        },
        async *getStreamedResponse(request) {
          budget.admit();
          for await (const event of model.getStreamedResponse(request)) {
            if (event.type === "response_done") budget.record(name ?? "", event.response.usage);
            yield event;
          }
        },
      };
      return wrapper;
    },
  };
}
