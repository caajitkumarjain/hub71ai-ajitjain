import { Agent } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions, type ManzilAgent } from "./instructions";
import { createTools } from "./tools";

export function createPathfinder(navigator: ManzilAgent) {
  const tools = createTools("Pathfinder");
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Pathfinder", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    handoffDescription: "Step ordering, what to do next, pre-arrival work and dependencies.",
    instructions: ({ context }) => agentInstructions("Pathfinder", "Use compile_path for ordering and timing. For work before landing, use every relevant preArrivalNodes entry, including school applications when present. Explain dependencies with the dependency tool. Hand ALL where-to-set-up, jurisdiction, mainland versus free-zone and location cost/tax comparisons to Bawsala using the SDK handoff, even when the request starts on the Path page. Do not make location recommendations yourself.", context.locale),
    tools: [tools.compilePath, tools.getStep, tools.explainDependencies],
    handoffs: [navigator],
  });
}
