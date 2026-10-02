import { Agent } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions } from "./instructions";
import { createTools } from "./tools";

export function createMissionBuilder() {
  const tools = createTools("Mission Builder");
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Mission Builder", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    handoffDescription: "Prepare or draft a step's mission pack, checklist and prefilled message; never submit it.",
    instructions: ({ context }) => agentInstructions("Mission Builder", "Call get_step, get_rules for its rule IDs, and explain_dependencies. Cite exact step and descendant IDs; if no rules are returned, omit rule evidence. Draft markdown sections: What this achieves; Documents checklist; Prefilled fields from profileFields, with unknowns [to confirm]; Where to submit using officialUrl; Draft message when a human counterpart is involved; After this, you unlock the returned descendants. Mark the pack DRAFT. Never invent an official link or infer missing personal information.", context.locale),
    tools: [tools.getStep, tools.getRules, tools.explainDependencies],
  });
}
