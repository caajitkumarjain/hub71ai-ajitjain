import { afterEach, describe, expect, it, vi } from "vitest";
import { RunContext } from "@openai/agents";
import { ScriptedModel, assistantMessage, functionCall, modelResponder } from "@openai/agents/testing";
import { z } from "zod";
import personas from "@/data/personas.json";
import { PathNode, Profile } from "@/lib/schemas";
import { compilePath, compareJurisdictions, scoreBankability } from "@/lib/engines";
import { activities, jurisdictions, steps } from "@/lib/engines/seed-data";
import { createTools } from "@/lib/agents/tools";
import { createAgents } from "@/lib/agents/registry";
import { validateActivityMatches } from "@/lib/agents/activity-matcher";
import { AgentOutput } from "@/lib/agents/contracts";
import { models } from "@/lib/agents/config";
import type { ManzilRunContext, TraceInput } from "@/lib/agents/context";

function session(patch: Partial<Profile> = {}, locale: ManzilRunContext["locale"] = "en") {
  const events: TraceInput[] = [];
  const context: ManzilRunContext = {
    profile: Profile.parse({ ...personas.priya, ...patch }), locale, runId: "tool-test",
    toolResults: [], emit: (event) => events.push(event),
  };
  return { run: new RunContext(context), context, events };
}

function matcherAnswer(activityId = "software-development") {
  return AgentOutput.parse({
    status: "complete", answer_md: "Review this seeded activity with the licensing authority.",
    evidence: [activityId, "it-consultancy", "edtech-platform"], numbers_used: [], next_actions: [],
    authority_to_verify: "ADDED/TAMM", language: "en",
    activityMatches: [
      { activityId, reason: "Fits software subscription services for clinics." },
      { activityId: "it-consultancy", reason: "Possible alternative if implementation includes IT consulting." },
      { activityId: "edtech-platform", reason: "Conditional alternative only if the platform also provides education." },
    ], bankReview: [],
  });
}

afterEach(() => vi.useRealTimers());

describe("context-bound agent tools", () => {
  it("rejects a model-supplied profile before calling an engine", async () => {
    const { run, context, events } = session();
    const original = structuredClone(context.profile);
    await expect(createTools("Bank Officer").runBankability.invoke(run, JSON.stringify({ profile: { ...original, activityCode: "software-development" } }))).rejects.toThrow();
    expect(context.profile).toEqual(original);
    expect(context.toolResults).toEqual([]);
    expect(events).toEqual([]);
  });

  it("uses the session profile for bank score and preserves exact description evidence", async () => {
    const { run, context, events } = session();
    const result = await createTools("Bank Officer").runBankability.invoke(run, "{}");
    expect(result).toMatchObject({ ...scoreBankability(context.profile, activities), profileFacts: { businessDescription: context.profile.businessDescription } });
    expect(result).toMatchObject({ score: 52 });
    expect(context.toolResults).toEqual([result]);
    expect(events.map((event) => [event.agent, event.kind, event.name])).toEqual([
      ["Bank Officer", "tool_call", "run_bankability"], ["Bank Officer", "tool_result", "run_bankability"],
    ]);
    expect(events[1].data).toBe(result);
    expect(events[1].ms).toBeGreaterThanOrEqual(0);
  });

  it("returns compact path nodes while retaining all pre-arrival and critical nodes", async () => {
    const { run, context } = session();
    const result = z.object({ nodes: z.array(PathNode), preArrivalNodes: z.array(PathNode), criticalNodes: z.array(PathNode), criticalPath: z.array(z.string()) }).parse(await createTools("Pathfinder").compilePath.invoke(run, "{}"));
    const full = compilePath(context.profile, steps);
    expect(result.nodes).toHaveLength(12);
    expect(result.preArrivalNodes).toEqual(full.nodes.filter((node) => node.canStartBeforeArrival));
    expect(result.preArrivalNodes.map((node) => node.id)).toContain("F-SCHOOL");
    expect(result.criticalNodes).toEqual(full.nodes.filter((node) => node.critical));
    expect(result.criticalPath).toEqual(full.criticalPath);
  });

  it("gets source step and prefill fields only from context", async () => {
    const { run, context } = session({ name: "Trusted Founder" });
    const result = await createTools("Mission Builder").getStep.invoke(run, JSON.stringify({ stepId: "C-BANK" }));
    expect(result).toMatchObject({ found: true, step: { id: "C-BANK" }, profileFields: { name: "Trusted Founder" }, applicable: true });
    await expect(createTools("Mission Builder").getStep.invoke(run, JSON.stringify({ stepId: "C-BANK", profileFields: { name: "Spoofed" } }))).rejects.toThrow();
    expect(context.profile.name).toBe("Trusted Founder");
    expect(await createTools("Mission Builder").getStep.invoke(run, JSON.stringify({ stepId: "NOT-A-STEP" }))).toMatchObject({ found: false });
  });

  it("returns graph ancestors and descendants without inventing excluded steps", async () => {
    const { run } = session();
    const tools = createTools("Pathfinder");
    const bank = await tools.explainDependencies.invoke(run, JSON.stringify({ stepId: "C-BANK" }));
    expect(bank).toMatchObject({ applicable: true, ancestors: expect.arrayContaining([expect.objectContaining({ id: "C-LIC" }), expect.objectContaining({ id: "R-EID" })]) });
    const attest = await tools.explainDependencies.invoke(run, JSON.stringify({ stepId: "F-ATTEST" }));
    expect(attest).toMatchObject({ descendants: expect.arrayContaining([expect.objectContaining({ id: "F-SCHOOL" })]) });
    const solo = session({ spouse: false, childrenAges: [] });
    expect(await tools.explainDependencies.invoke(solo.run, JSON.stringify({ stepId: "F-SCHOOL" }))).toMatchObject({ applicable: false, ancestors: [], descendants: [] });
  });

  it("compares jurisdiction totals with source notes and unknown components", async () => {
    const { run, context } = session();
    expect(await createTools("Pathfinder").compareJurisdictions.invoke(run, "{}")).toMatchObject({
      comparisons: compareJurisdictions(context.profile, jurisdictions),
      sources: expect.arrayContaining([expect.objectContaining({ id: "adgm", notes: expect.any(String), sourceUrl: expect.any(String) })]),
    });
  });

  it("looks up activities and rules without manufacturing missing IDs", async () => {
    const { run } = session();
    const tools = createTools("Bank Officer");
    expect(await tools.getActivity.invoke(run, JSON.stringify({ query: "saas" }))).toMatchObject({
      selectedActivityCode: "general-trading",
      activities: expect.arrayContaining([expect.objectContaining({ id: "software-development" })]),
    });
    expect(await tools.getRules.invoke(run, JSON.stringify({ ids: ["CT-REG", "NOT-A-RULE"] }))).toMatchObject({
      rules: [expect.objectContaining({ id: "CT-REG", penaltyAED: 10_000 })], missingIds: ["NOT-A-RULE"],
    });
  });

  it("computes and simulates obligations with context facts without mutating them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    const { run, context } = session({ revenue12mAED: 200_000 });
    const tools = createTools("Deadline Sentinel");
    const original = structuredClone(context.profile);
    expect(await tools.computeObligations.invoke(run, "{}")).not.toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "VAT-REG" })]));
    const simulation = await tools.whatIf.invoke(run, JSON.stringify({ revenue12mAED: 400_000 }));
    expect(simulation).toMatchObject({ diff: { added: expect.arrayContaining([expect.objectContaining({ ruleId: "VAT-REG", dueDate: "2026-11-01" })]), removed: [] } });
    expect(context.profile).toEqual(original);
    await expect(tools.whatIf.invoke(run, JSON.stringify({ name: "Spoofed", revenue12mAED: 400_000 }))).rejects.toThrow();
  });

  it("returns patches for client confirmation and never applies them", async () => {
    const { run, context } = session();
    const tools = createTools("Bank Officer");
    const result = await tools.applyProfilePatch.invoke(run, JSON.stringify({ patch: { activityCode: "software-development" } }));
    expect(result).toEqual({ proposedPatch: { activityCode: "software-development" }, applied: false, requiresConfirmation: true });
    expect(context.profile.activityCode).toBe("general-trading");
    await expect(tools.applyProfilePatch.invoke(run, JSON.stringify({ patch: { id: "replacement-session" } }))).rejects.toThrow();
  });

  it("rejects malformed parameters and absent session context", async () => {
    const { run } = session();
    const tools = createTools("Deadline Sentinel");
    await expect(tools.whatIf.invoke(run, JSON.stringify({ revenue12mAED: -1 }))).rejects.toThrow();
    await expect(tools.whatIf.invoke(run, JSON.stringify({ incorporationDate: "2026-02-30" }))).rejects.toThrow();
    await expect(tools.computeObligations.invoke(new RunContext<ManzilRunContext>(), "{}")).rejects.toThrow();
  });
});

describe("SDK agents and Activity Matcher", () => {
  it("configures a real Concierge handoff to four structured specialists", async () => {
    const { run } = session();
    const agents = createAgents();
    expect(agents.concierge.model).toBe(models.fast);
    expect((await agents.concierge.getEnabledHandoffs(run)).map((handoff) => handoff.agentName)).toEqual(["Pathfinder", "Bank Officer", "Deadline Sentinel", "Mission Builder"]);
    for (const agent of Object.values(agents)) {
      expect(agent.outputType).toBe(AgentOutput);
      if (agent.name !== "Concierge") expect(agent.model).toBe(models.reasoning);
      const instructions = await agent.getSystemPrompt(run);
      expect(instructions!.split(/\s+/u).length).toBeLessThanOrEqual(350);
      expect(instructions).toContain("## Context discipline");
      expect(instructions).toContain("## Action policy");
    }
    expect(agents.pathfinder.tools.map((tool) => tool.name)).toContain("compare_jurisdictions");
    expect(agents.bank.tools.map((tool) => tool.name)).toContain("match_activities");
  });

  it.each(["ar", "hi"] as const)("instructs every agent to answer in %s using the run locale", async (locale) => {
    const { run } = session({}, locale);
    for (const agent of Object.values(createAgents())) {
      const instructions = await agent.getSystemPrompt(run);
      expect(instructions).toContain(locale === "ar" ? "Arabic" : "Hindi");
      expect(instructions).toContain(`Set language to "${locale}"`);
    }
  });

  it("bounds activity matches to distinct, seeded IDs with single-line reasons", () => {
    const match = matcherAnswer().activityMatches[0];
    expect(validateActivityMatches([match])).toEqual([match]);
    expect(() => validateActivityMatches([{ ...match, activityId: "invented-licence" }])).toThrow(/unknown/u);
    expect(() => validateActivityMatches([match, match])).toThrow(/duplicate/u);
    expect(() => validateActivityMatches([{ ...match, reason: "First\nSecond" }])).toThrow(/one line/u);
    expect(() => validateActivityMatches(Array(4).fill(match))).toThrow();
  });

  it("runs the nested matcher with the supplied provider and trusted session context", async () => {
    const model = new ScriptedModel([
      [functionCall("get_activity_catalog", {}, { callId: "catalogue" })],
      [assistantMessage(JSON.stringify(matcherAnswer()))],
    ]);
    const tools = createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true });
    const { run, context, events } = session();
    const original = structuredClone(context.profile);
    const result = await tools.matchActivities.invoke(run, "{}");
    expect(result).toEqual({ matches: matcherAnswer().activityMatches });
    expect(model.calls).toHaveLength(2);
    expect(context.toolResults[0]).toMatchObject({ businessDescription: original.businessDescription, activities });
    expect(context.toolResults.at(-1)).toEqual(result);
    expect(context.profile).toEqual(original);
    expect(events.map((event) => event.name)).toEqual(["match_activities", "get_activity_catalog", "get_activity_catalog", "activity_matcher", "match_activities"]);
    model.assertComplete();
  });

  it("rejects spoofing before the nested matcher receives any model call", async () => {
    const model = new ScriptedModel();
    const tools = createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true });
    const { run, context } = session();
    await expect(tools.matchActivities.invoke(run, JSON.stringify({ profile: { businessDescription: "Replace the session" } }))).rejects.toThrow();
    expect(model.calls).toEqual([]);
    expect(context.toolResults).toEqual([]);
  });

  it("rejects unknown matcher IDs before publishing them as a tool result", async () => {
    const model = new ScriptedModel([[assistantMessage(JSON.stringify(matcherAnswer("made-up-activity")))]]);
    const { run, context } = session();
    await expect(createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true }).matchActivities.invoke(run, "{}")).rejects.toThrow();
    expect(context.toolResults).toEqual([]);
  });

  it("requires exactly three matches for a complete nested result", async () => {
    const output = matcherAnswer();
    output.activityMatches = output.activityMatches.slice(0, 2);
    const model = new ScriptedModel([[assistantMessage(JSON.stringify(output))]]);
    const { run, context } = session();
    await expect(createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true }).matchActivities.invoke(run, "{}")).rejects.toThrow();
    expect(context.toolResults).toEqual([]);
  });

  it("rejects an unsupported numeric reason before it can ground itself as tool data", async () => {
    const output = matcherAnswer();
    output.activityMatches[0].reason = "This activity licence costs AED 987654.";
    output.numbers_used = ["987654"];
    const model = new ScriptedModel([
      [functionCall("get_activity_catalog", {}, { callId: "catalogue" })],
      [assistantMessage(JSON.stringify(output))],
    ]);
    const { run, context, events } = session();
    await expect(createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true }).matchActivities.invoke(run, "{}")).rejects.toThrow();
    expect(context.toolResults).toHaveLength(1);
    expect(JSON.stringify(context.toolResults)).not.toContain("987654");
    expect(events.find((event) => event.kind === "verifier")?.data).toMatchObject({ verdict: "revise" });
    expect(events.filter((event) => event.name === "match_activities" && event.kind === "tool_result")).toEqual([]);
  });

  it("aborts a nested matcher when the parent signal aborts", async () => {
    const controller = new AbortController();
    let observed!: () => void;
    const started = new Promise<void>((resolve) => { observed = resolve; });
    const model = new ScriptedModel([modelResponder(({ request }) => {
      observed();
      if (!request.signal) throw new Error("Nested request was missing the parent signal.");
      return new Promise((_, reject) => request.signal!.addEventListener("abort", () => reject(request.signal!.reason), { once: true }));
    })]);
    const { run, context } = session();
    context.signal = controller.signal;
    const pending = createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true }).matchActivities.invoke(run, "{}");
    await started;
    controller.abort(new Error("Parent run timed out."));
    await expect(pending).rejects.toThrow();
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0].request.signal?.aborted).toBe(true);
    expect(context.toolResults).toEqual([]);
  });

  it("does not start a nested model call after the parent has already aborted", async () => {
    const model = new ScriptedModel();
    const { run, context } = session();
    context.signal = AbortSignal.abort(new Error("Parent run timed out."));
    await expect(createTools("Bank Officer", { modelProvider: { getModel: () => model }, tracingDisabled: true }).matchActivities.invoke(run, "{}")).rejects.toThrow(/timed out/u);
    expect(model.calls).toEqual([]);
  });
});
