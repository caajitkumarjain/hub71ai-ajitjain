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
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 4000 },
    handoffDescription: "Prepare or draft a step's mission pack, checklist and prefilled message; never submit it.",
    instructions: ({ context }) => agentInstructions("Mission Builder", "Call get_step and get_rules. Return the document as pack JSON, never markdown. Keep answer_md a brief draft summary. For Company Studio, draft only the requested document. Each field value must exactly match profileFields or tool output; otherwise null, provenance needed. Do not assume identity, ownership, signatures, company names, funding origins or board decisions. Numbers in paragraphs must appear in verified fields/tool output. Use tool URLs and verified dates; unknown dates, email recipient, rule/step IDs and optional content are null. Include purpose, sections, fields, checklist, officialUrl and sources. A complete draft requires pack. This pack is exempt from the summary word limit.", context.locale),
    tools: [tools.getStep, tools.getRules, tools.explainDependencies],
  });
}
