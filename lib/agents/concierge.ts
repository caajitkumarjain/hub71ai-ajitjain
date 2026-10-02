import { Agent } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions, type ManzilAgent } from "./instructions";

export function createConcierge(specialists: readonly ManzilAgent[]) {
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Concierge", model: models.fast, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    instructions: ({ context }) => agentInstructions("Concierge", "Route by genuine SDK handoff: ordering, what next, pre-arrival, jurisdiction, free-zone or cost questions to Pathfinder; bank, KYC or activity to Bank Officer; tax, VAT, deadlines, penalties or renewals to Deadline Sentinel; prepare or draft step X to Mission Builder. Do not answer specialist questions yourself. For small talk, give one friendly line and offer help with their path.", context.locale),
    handoffs: [...specialists],
  });
}
