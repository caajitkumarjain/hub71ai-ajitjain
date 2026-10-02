import { Agent, tool, type RunConfig, type RunContext } from "@openai/agents";
import { z } from "zod";
import { Profile } from "@/lib/schemas";
import { activities } from "@/lib/engines/seed-data";
import { ActivityMatch, AgentOutput } from "./contracts";
import { models } from "./config";
import type { ManzilRunContext } from "./context";
import { agentInstructions } from "./instructions";
import { verifyAgentResult } from "./verifier";

const emptyInput = z.object({}).strict();

/** Validate model selections before another agent or the client can use them. */
export function validateActivityMatches(value: unknown) {
  const matches = z.array(ActivityMatch).max(3).parse(value);
  const seen = new Set<string>();
  for (const match of matches) {
    if (!activities.some((activity) => activity.id === match.activityId)) throw new Error("Activity Matcher returned an unknown activity ID.");
    if (seen.has(match.activityId)) throw new Error("Activity Matcher returned a duplicate activity ID.");
    if (/[\r\n]/u.test(match.reason)) throw new Error("Activity Matcher reasons must be one line.");
    seen.add(match.activityId);
  }
  return matches;
}

export function createActivityMatcher() {
  const catalogue = tool<typeof emptyInput, ManzilRunContext, unknown>({
    name: "get_activity_catalog", description: "Read the trusted session business description and the entire seeded activity catalogue. No profile arguments are accepted.",
    parameters: emptyInput, strict: true, errorFunction: null,
    execute: (_input, run?: RunContext<ManzilRunContext>) => {
      if (!run?.context) throw new Error("Activity matching requires a session run context.");
      const profile = Profile.parse(run.context.profile);
      const start = performance.now();
      run.context.emit({ agent: "Activity Matcher", kind: "tool_call", name: "get_activity_catalog", data: {} });
      const result = {
        businessDescription: profile.businessDescription, revenueModel: profile.revenueModel,
        selectedActivityCode: profile.activityCode ?? null, activities,
        note: "These seeded activity identifiers are illustrative; verify official licence codes with the licensing authority.",
      };
      run.context.toolResults.push(result);
      run.context.emit({ agent: "Activity Matcher", kind: "tool_result", name: "get_activity_catalog", data: result, ms: Math.max(0, performance.now() - start) });
      return result;
    },
  });
  return new Agent<ManzilRunContext, typeof AgentOutput>({
    name: "Activity Matcher", model: models.reasoning, outputType: AgentOutput,
    modelSettings: { reasoning: { effort: "low" }, maxTokens: 1800 },
    handoffDescription: "Suggest suitable seeded activity identifiers from a business description, with reasons for founder review.",
    instructions: ({ context }) => agentInstructions("Activity Matcher", "Call get_activity_catalog. Return the top three distinct seeded activity IDs ranked by relative fit with the trusted businessDescription and revenueModel. These are comparison candidates, not three confirmed suitable licences. Always return exactly three activityMatches for a meaningful business description, even when only one is a strong fit. Give one-line reasons in the requested language; explicitly label weaker candidates conditional or low fit, without inventing services the founder provides. Cite the exact selected catalogue IDs as evidence. Abstain with no matches only if the description is empty or does not describe a business. Suggestions require licensing-authority verification, never approvals. Never change the bank score. Keep bankReview empty.", context.locale),
    tools: [catalogue],
  });
}

export function createActivityMatcherTool(runConfig?: Partial<RunConfig>, signal?: AbortSignal) {
  return createActivityMatcher().asTool({
    toolName: "activity_matcher_internal",
    toolDescription: "Suggest activities from trusted session facts only.",
    parameters: emptyInput,
    inputBuilder: () => "Read the trusted session profile with get_activity_catalog and suggest the best matching seeded activities.",
    runConfig,
    runOptions: { maxTurns: 3, signal },
    customOutputExtractor: (result) => {
      const output = AgentOutput.parse(result.finalOutput);
      const matches = validateActivityMatches(output.activityMatches);
      if (output.status === "complete" && matches.length !== 3) throw new Error("A complete Activity Matcher result requires exactly three matches.");
      if (output.status !== "complete" && matches.length !== 0) throw new Error("An abstaining Activity Matcher cannot publish matches.");
      const context: ManzilRunContext = result.runContext.context;
      // Verify against prior engine/catalogue output, before the generated reasons become tool data.
      const verdict = verifyAgentResult(output, context.toolResults, context.profile, context.locale);
      context.emit({ agent: "Activity Matcher", kind: "verifier", name: "activity_matcher", data: verdict });
      if (verdict.verdict !== "approve") throw new Error(`Activity Matcher verification failed: ${verdict.reasons.join(" ")}`);
      return JSON.stringify({ matches });
    },
  });
}
