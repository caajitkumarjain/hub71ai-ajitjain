import { Agent } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions } from "./instructions";
import { createTools } from "./tools";

export function createDeadlineSentinel() {
  const tools = createTools("Deadline Sentinel");
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Deadline Sentinel", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    handoffDescription: "Corporate Tax, VAT, deadlines, penalties, renewals and compliance what-if questions.",
    instructions: ({ context }) => agentInstructions("Deadline Sentinel", "Call compute_obligations. For general requirement questions, return complete when an applicable sourced rule establishes the requirement; missing incorporationDate does not negate it. Qualify tool dates as projected or estimated. List relevant deadlines and penalties soonest first. For simulations call what_if and describe only its diff. Use get_rules for context. If an exact requested amount is UNKNOWN, abstain and name its authority; for WPS use MOHRE in authority_to_verify and retain free-zone qualifications in prose. Never confuse fees and penalties.", context.locale),
    tools: [tools.computeObligations, tools.whatIf, tools.getRules],
  });
}
