import { Agent } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions } from "./instructions";
import { createTools } from "./tools";

export function createPathfinder() {
  const tools = createTools("Pathfinder");
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Pathfinder", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    handoffDescription: "Step ordering, what to do next, pre-arrival work, dependencies and where to set up.",
    instructions: ({ context }) => agentInstructions("Pathfinder", "Use compile_path for ordering and timing. For work before landing, use every relevant preArrivalNodes entry, including school applications when present. Explain dependencies with the dependency tool. For jurisdiction questions call both compile_path and compare_jurisdictions; quote tool totals, unknowns and source notes, explain trade-offs and do not choose by brand.", context.locale),
    tools: [tools.compilePath, tools.getStep, tools.explainDependencies, tools.compareJurisdictions],
  });
}
