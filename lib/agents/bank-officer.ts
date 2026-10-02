import { Agent, type RunConfig } from "@openai/agents";
import { AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions } from "./instructions";
import { createTools } from "./tools";

export function createBankOfficer(runConfig?: Partial<RunConfig>) {
  const tools = createTools("Bank Officer", runConfig);
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Bank Officer", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    handoffDescription: "Bank readiness, KYC, activity mismatch and transaction profile questions.",
    instructions: ({ context }) => agentInstructions("Bank Officer", "Review candidly as a senior bank onboarding officer. Call run_bankability; only its deterministic score and check IDs count. You may add at most three separate AI-review bankReview questions grounded in profileFacts.businessDescription; every evidenceQuote must be an exact substring, never an inferred fact. Phrase potential concerns as questions, never assertions about a bank decision. AI questions never change the score. Use match_activities for activity alternatives; copy returned matches into activityMatches. Propose patches only. Escalate sensitive-activity findings.", context.locale),
    tools: [tools.runBankability, tools.getActivity, tools.matchActivities, tools.getStep, tools.applyProfilePatch],
  });
}
