import { tool, type RunContext, type RunConfig, type FunctionTool } from "@openai/agents";
import { z } from "zod";
import { Profile } from "@/lib/schemas";
import { compilePath, compareJurisdictions, computeObligations, scoreBankability, whatIf } from "@/lib/engines";
import { activities, jurisdictions, rules, steps } from "@/lib/engines/seed-data";
import type { ManzilRunContext } from "./context";
import { createActivityMatcherTool } from "./activity-matcher";

const emptyInput = z.object({}).strict();
type ToolCallDetails = Parameters<FunctionTool<ManzilRunContext>["invoke"]>[2];
const stepInput = z.object({ stepId: z.string().min(1).max(64) }).strict();
// Zod 4 retains inner defaults under partial(): omitted patch fields must stay omitted.
const whatIfInput = z.object({
  revenue12mAED: Profile.shape.revenue12mAED.removeDefault().optional(),
  hires12m: Profile.shape.hires12m.removeDefault().optional(),
  jurisdiction: Profile.shape.jurisdiction,
  incorporationDate: Profile.shape.incorporationDate,
}).strict();
const proposedPatch = whatIfInput.extend({
  activityCode: Profile.shape.activityCode,
  businessDescription: Profile.shape.businessDescription.optional(),
}).strict();

/** The SDK supplies context; no model parameter can replace the session profile. */
function contextTool<T extends z.ZodObject>(
  agent: string,
  name: string,
  description: string,
  parameters: T,
  execute: (input: z.output<T>, profile: Profile, context: RunContext<ManzilRunContext>, details?: ToolCallDetails) => unknown | Promise<unknown>,
) {
  return tool<z.ZodObject, ManzilRunContext, unknown>({
    name, description, parameters, strict: true, errorFunction: null,
    execute: async (input, runContext?: RunContext<ManzilRunContext>, details?: ToolCallDetails) => {
      if (!runContext?.context) throw new Error("Manzil tools require a session run context.");
      const context = runContext.context;
      const profile = Profile.parse(context.profile);
      const parsed = parameters.parse(input);
      const start = performance.now();
      context.emit({ agent, kind: "tool_call", name, data: parsed });
      const result = await execute(parsed, profile, runContext, details);
      context.toolResults.push(result);
      context.emit({ agent, kind: "tool_result", name, data: result, ms: Math.max(0, performance.now() - start) });
      return result;
    },
  });
}

function dependencies(profile: Profile, stepId: string) {
  const path = compilePath(profile, steps);
  const node = path.nodes.find((candidate) => candidate.id === stepId);
  if (!node) {
    return { stepId, applicable: false, ancestors: [], descendants: [], reason: path.excludedSteps.find((step) => step.stepId === stepId)?.reason ?? "Unknown step ID." };
  }
  function traverse(direction: "ancestors" | "descendants") {
    const found = new Set<string>();
    const pending = [stepId];
    while (pending.length) {
      const current = pending.pop()!;
      for (const edge of path.edges) {
        const adjacent = direction === "ancestors"
          ? edge.to === current ? edge.from : undefined
          : edge.from === current ? edge.to : undefined;
        if (adjacent && !found.has(adjacent)) {
          found.add(adjacent);
          pending.push(adjacent);
        }
      }
    }
    return path.nodes.filter((candidate) => found.has(candidate.id)).map(({ id, title, status }) => ({ id, title, status }));
  }
  return { stepId, applicable: true, ancestors: traverse("ancestors"), descendants: traverse("descendants") };
}

export function createTools(agent: string, runConfig?: Partial<RunConfig>) {
  return {
    compilePath: contextTool(agent, "compile_path", "Compile the session founder's path, timing and sourced costs. Includes the first twelve nodes, every pre-arrival node and every critical node.", emptyInput, (_input, profile) => {
      const path = compilePath(profile, steps);
      return {
        ...path, nodes: path.nodes.slice(0, 12),
        preArrivalNodes: path.nodes.filter((node) => node.canStartBeforeArrival),
        criticalNodes: path.nodes.filter((node) => node.critical),
      };
    }),
    getStep: contextTool(agent, "get_step", "Read a sourced step and trusted session profile fields for a draft. Missing fields remain unknown; never submit anything.", stepInput, ({ stepId }, profile) => {
      const step = steps.find((candidate) => candidate.id === stepId);
      if (!step) return { found: false, stepId, message: "Unknown step ID. Choose a step from the compiled path." };
      const path = compilePath(profile, steps);
      return {
        found: true, step, profileFields: profile,
        applicable: path.nodes.some((node) => node.id === stepId),
        excludedReason: path.excludedSteps.find((candidate) => candidate.stepId === stepId)?.reason ?? null,
      };
    }),
    explainDependencies: contextTool(agent, "explain_dependencies", "Return the ancestors and descendants of a step in the session founder's compiled path.", stepInput, ({ stepId }, profile) => dependencies(profile, stepId)),
    compareJurisdictions: contextTool(agent, "compare_jurisdictions", "Compare sourced three-year jurisdiction totals for the session founder. Unknown cost components are not zero; quote source notes and qualifications.", emptyInput, (_input, profile) => ({
      comparisons: compareJurisdictions(profile, jurisdictions),
      sources: jurisdictions.map(({ id, name, sourceUrl, verifiedOn, confidence, verify, notes }) => ({ id, name, sourceUrl, verifiedOn, confidence, verify, notes })),
    })),
    runBankability: contextTool(agent, "run_bankability", "Run deterministic bank-readiness checks. Quote this score and finding IDs. profileFacts supplies the trusted description for additional AI-review questions, which never change the score.", emptyInput, (_input, profile) => ({
      ...scoreBankability(profile, activities),
      profileFacts: { businessDescription: profile.businessDescription, revenueModel: profile.revenueModel, activityCode: profile.activityCode ?? null },
    })),
    getActivity: contextTool(agent, "get_activity", "Search the activity catalogue by activity ID or revenue model. These illustrative identifiers need licensing-authority verification.", z.object({ query: z.string().min(1).max(200) }).strict(), ({ query }, profile) => {
      const search = query.trim().toLowerCase();
      return {
        selectedActivityCode: profile.activityCode ?? null,
        revenueModel: profile.revenueModel,
        activities: activities.filter((activity) => activity.id.includes(search) || activity.revenueModels.some((model) => model.includes(search))),
        note: "Official activity codes vary by authority; verify with the licensing authority before applying.",
      };
    }),
    computeObligations: contextTool(agent, "compute_obligations", "Compute sourced deadlines and penalties for the session founder. Preserve projected dates, estimates and UNKNOWN labels.", emptyInput, (_input, profile) => computeObligations(profile, rules)),
    matchActivities: contextTool(agent, "match_activities", "Ask the Activity Matcher for the top three seeded activity IDs for the trusted session description, with reasons. Suggestions never change the profile.", emptyInput, async (_input, _profile, context, details) => {
      context.context.signal?.throwIfAborted();
      const result = await createActivityMatcherTool(runConfig, context.context.signal).invoke(context, "{}", details);
      if (typeof result !== "string") throw new Error("Activity Matcher returned an invalid tool result.");
      return JSON.parse(result);
    }),
    whatIf: contextTool(agent, "what_if", "Simulate only the named revenue, hiring, jurisdiction or incorporation-date changes. Returns before/after/diff without changing the session profile.", whatIfInput, (patch, profile) => whatIf(profile, patch)),
    getRules: contextTool(agent, "get_rules", "Read exact sourced rules by ID. Missing IDs are reported, not invented.", z.object({ ids: z.array(z.string().min(1).max(64)).max(50) }).strict(), ({ ids }) => ({
      rules: rules.filter((rule) => ids.includes(rule.id)),
      missingIds: ids.filter((id) => !rules.some((rule) => rule.id === id)),
    })),
    applyProfilePatch: contextTool(agent, "apply_profile_patch", "Propose a limited profile patch for explicit client confirmation. This tool does not apply changes, submit forms or contact anyone.", z.object({ patch: proposedPatch }).strict(), ({ patch }) => ({
      proposedPatch: patch, applied: false, requiresConfirmation: true,
    })),
  };
}
