import { z } from "zod";
import { Jurisdiction, type TraceEvent } from "@/lib/schemas";
import { steps } from "@/lib/engines/seed-data";
import { type FounderEvent } from "@/lib/store";
import { syntheticCohort, type SyntheticFounder } from "@/lib/synthetic-cohort";

export const AdminFilter = z.object({ family: z.enum(["all", "family", "single"]).default("all"), jurisdiction: z.union([Jurisdiction, z.literal("all")]).default("all") });
export type AdminFilter = z.infer<typeof AdminFilter>;
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}
function accepts(item: { hasSpouse: boolean; childrenCount: number; jurisdiction: string | null }, filter: AdminFilter) {
  const family = item.hasSpouse || item.childrenCount > 0;
  return (filter.family === "all" || family === (filter.family === "family")) && (filter.jurisdiction === "all" || item.jurisdiction === filter.jurisdiction);
}

export function summarizeRuns(runs: readonly TraceEvent[][]) {
  return runs.slice(0, 20).map((events) => {
    const first = events[0];
    const final = events.findLast((event) => event.kind === "final");
    const verifier = events.findLast((event) => event.kind === "verifier");
    const startData = first?.data as { question?: unknown } | undefined;
    const approved = Boolean(verifier?.data && typeof verifier.data === "object" && "approved" in verifier.data && verifier.data.approved === true);
    return { runId: first?.runId ?? "", ts: first?.ts ?? "", question: typeof startData?.question === "string" ? startData.question : "Question not retained", agents: [...new Set(events.filter((event) => event.kind === "agent_start").map((event) => event.agent))], tools: events.filter((event) => event.kind === "tool_call").length, verified: approved, complete: Boolean(final), ms: final?.ms ?? null, cached: events.some((event) => event.kind === "fallback"), events };
  });
}

export function adminStats(events: readonly FounderEvent[], runs: readonly TraceEvent[][], filter: AdminFilter = { family: "all", jurisdiction: "all" }, cohort: readonly SyntheticFounder[] = syntheticCohort()) {
  const founders = cohort.filter((founder) => accepts(founder, filter));
  const samples = new Map<string, { days: number[]; live: number }>();
  for (const founder of founders) for (const stall of founder.stalls) {
    const current = samples.get(stall.stepId) ?? { days: [], live: 0 };
    current.days.push(stall.days); samples.set(stall.stepId, current);
  }
  const liveFounderIds = new Set<string>();
  for (const event of events) {
    if (String(event.type) !== "duration_report" || !event.stepId || !steps.some((step) => step.id === event.stepId)) continue;
    const payload = event.payload;
    if (!payload || typeof payload.days !== "number" || !Number.isFinite(payload.days) || payload.days <= 0 || typeof payload.hasSpouse !== "boolean" || typeof payload.childrenCount !== "number") continue;
    const jurisdiction = typeof payload.jurisdiction === "string" ? payload.jurisdiction : null;
    if (!accepts({ hasSpouse: payload.hasSpouse, childrenCount: payload.childrenCount, jurisdiction }, filter)) continue;
    liveFounderIds.add(event.founderId);
    const current = samples.get(event.stepId) ?? { days: [], live: 0 };
    current.days.push(payload.days); current.live += 1; samples.set(event.stepId, current);
  }
  const friction = [...samples].map(([stepId, sample]) => {
    const step = steps.find((item) => item.id === stepId)!;
    return { stepId, title: step.title, authority: step.authority, medianDays: median(sample.days)!, count: sample.days.length, liveReports: sample.live };
  }).sort((a, b) => b.medianDays - a.medianDays || a.stepId.localeCompare(b.stepId)).slice(0, 12);
  const completedRuns = runs.filter((run) => run.some((event) => event.kind === "final"));
  const verifiedRuns = completedRuns.filter((run) => {
    const verdict = run.findLast((event) => event.kind === "verifier");
    return verdict?.data && typeof verdict.data === "object" && "approved" in verdict.data && verdict.data.approved === true;
  });
  const insights = friction.length ? [
    `${friction[0].title} has the highest median in this selection: ${friction[0].medianDays} days across ${friction[0].count} observations. Could earlier document checks reduce repeat visits?`,
    `${friction.reduce((sum, row) => sum + row.liveReports, 0)} live duration reports appear in these radar rows. Compare observed timings with the labelled synthetic sample before drawing a policy conclusion.`,
  ] : ["No duration observations match these filters.", "Add a duration report from a completed step to contribute a live observation."];
  return { syntheticFounders: founders.length, liveFounders: liveFounderIds.size, founders: founders.length + liveFounderIds.size, medianReadyDays: median(founders.map((item) => item.readyDays)), exposureAED: Math.round(founders.reduce((sum, item) => sum + item.exposureAED, 0) * 100) / 100, unknownPenalties: founders.reduce((sum, item) => sum + item.unknownPenalties, 0), verifiedPercent: completedRuns.length ? Math.round(verifiedRuns.length / completedRuns.length * 100) : null, completedRuns: completedRuns.length, friction, authorities: [...new Set(friction.map((row) => row.authority))], topStalls: friction.slice(0, 5), insights };
}
export type AdminStats = ReturnType<typeof adminStats>;
export type AdminRun = ReturnType<typeof summarizeRuns>[number];
