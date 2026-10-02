import { Agent } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions } from "./instructions";
import { createTools } from "./tools";

export function createBawsala() {
  const tools = createTools("Bawsala");
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Bawsala", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 2400 },
    handoffDescription: "All where-to-set-up questions: jurisdiction selection, mainland versus free zone, company location, cost and tax comparisons.",
    instructions: ({ context }) => agentInstructions("Bawsala", `Read missingFacts from navigate_jurisdiction. Ask at most four unanswered questions: customer locations (mainland/freezone/abroad/government), regulated finance, foreign investors, physical goods. Abstain until answered; facts may contain only explicit answers, never guesses. Preserve supplied calculator inputs and priorities, including zeros. Then call navigate_jurisdiction, simulate_jurisdiction, flip_points and get_rules. Give winner, runner-up, confidence, three reasons, checked deal-breakers and what would change your mind. Cite rule/jurisdiction IDs. Never recommend knockouts. Label estimates and excluded unknowns; preserve tax qualifications. No eligible winner means abstain. The founder applies the choice in /navigator.`, context.locale),
    tools: [tools.navigateJurisdiction, tools.simulateJurisdiction, tools.flipPoints, tools.getRules],
  });
}
