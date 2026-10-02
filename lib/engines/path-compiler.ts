import type { Condition, PathNode, PathResult, Profile, Step } from "@/lib/schemas";
import { deriveFacts, evaluate, type DerivedFacts } from "./conditions";
import { activities } from "./seed-data";

type Edge = { from: string; to: string };
export type CompilePathOptions = {
  cyclePolicy?: "throw" | "break";
  /** The API owns production logging; the engine has no ambient environment or I/O. */
  onCycle?: (edge: Edge) => void;
};

function cycleIn(steps: readonly Step[]): Edge[] | undefined {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const visited = new Set<string>();
  const active: string[] = [];
  function visit(id: string): Edge[] | undefined {
    const loopStart = active.indexOf(id);
    if (loopStart !== -1) {
      const loop = [...active.slice(loopStart), id];
      return loop.slice(0, -1).map((to, index) => ({ from: loop[index + 1], to }));
    }
    if (visited.has(id)) return;
    active.push(id);
    for (const dependency of byId.get(id)!.dependsOn) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    active.pop();
    visited.add(id);
  }
  for (const step of steps) {
    const cycle = visit(step.id);
    if (cycle) return cycle;
  }
}

function sortSteps(steps: readonly Step[]): Step[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const indegree = new Map(steps.map((step) => [step.id, step.dependsOn.length]));
  const next = new Map(steps.map((step) => [step.id, [] as string[]]));
  for (const step of steps) for (const parent of step.dependsOn) next.get(parent)!.push(step.id);
  const queue = steps.filter((step) => step.dependsOn.length === 0).map((step) => step.id);
  const sorted: Step[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    sorted.push(byId.get(id)!);
    for (const child of next.get(id)!) {
      const remaining = indegree.get(child)! - 1;
      indegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  if (sorted.length !== steps.length) throw new Error("Cycle remains in path dependencies.");
  return sorted;
}

function exclusionReason(step: Step, facts: DerivedFacts): string {
  if (step.id === "R-DL" && !facts.canConvertLicence) return `${facts.drivingLicenceCountry ?? "Driving licence country unknown"} is not an eligible exchange country in the seed list; verify with ${step.authority}.`;
  function explain(condition: Condition): string {
    if (condition.all) return condition.all.map(explain).join(" and ");
    if (condition.any) return condition.any.map(explain).join(" or ");
    if (condition.not) return `not (${explain(condition.not)})`;
    return `${condition.field} ${condition.op}${condition.value === undefined ? "" : ` ${JSON.stringify(condition.value)}`}`;
  }
  return `Does not apply to this profile: ${step.appliesIf ? explain(step.appliesIf) : "condition not met"}.`;
}

function forward(sorted: readonly Step[], profile: Profile, additionallyDone?: string) {
  const schedule = new Map<string, { earliestStart: number; earliestFinish: number }>();
  for (const step of sorted) {
    const earliestStart = Math.max(step.canStartBeforeArrival ? -30 : 0, ...step.dependsOn.map((id) => schedule.get(id)!.earliestFinish));
    const duration = profile.stepStatus[step.id] === "done" || step.id === additionallyDone ? 0 : step.durationDays.likely;
    schedule.set(step.id, { earliestStart, earliestFinish: earliestStart + duration });
  }
  return { schedule, finish: Math.max(0, ...[...schedule.values()].map((node) => node.earliestFinish)) };
}

export function compilePath(profile: Profile, steps: readonly Step[], options: CompilePathOptions = {}): PathResult {
  const facts = deriveFacts(profile, activities);
  const byId = new Map<string, Step>();
  for (const step of steps) {
    if (byId.has(step.id)) throw new Error(`Duplicate step ID: ${step.id}`);
    if (![step.durationDays.min, step.durationDays.likely, step.durationDays.max].every((days) => Number.isFinite(days) && days >= 0)) throw new Error(`Invalid duration: ${step.id}`);
    byId.set(step.id, { ...step, dependsOn: [...new Set(step.dependsOn)] });
  }
  for (const step of byId.values()) for (const id of step.dependsOn) {
    if (!byId.has(id)) throw new Error(`Unknown dependency ${id} for ${step.id}`);
  }
  // Validate before relinking too: an excluded cycle must not recurse forever.
  let cycle = cycleIn([...byId.values()]);
  while (cycle) {
    if (options.cyclePolicy !== "break") throw new Error(`Dependency cycle: ${cycle.map((edge) => `${edge.from} -> ${edge.to}`).join(", ")}`);
    const confidence = { low: 0, medium: 1, high: 2 };
    // The dependent step owns the confidence of its prerequisite assertion.
    const removed = [...cycle].sort((a, b) => confidence[byId.get(a.to)!.confidence] - confidence[byId.get(b.to)!.confidence] || a.to.localeCompare(b.to) || a.from.localeCompare(b.from))[0];
    const target = byId.get(removed.to)!;
    target.dependsOn = target.dependsOn.filter((id) => id !== removed.from);
    options.onCycle?.(removed);
    cycle = cycleIn([...byId.values()]);
  }
  const includedIds = new Set(steps.filter((step) => evaluate(step.appliesIf, facts)).map((step) => step.id));
  const excludedSteps = steps.filter((step) => !includedIds.has(step.id)).map((step) => ({ stepId: step.id, reason: exclusionReason(step, facts) }));
  function retainedAncestors(id: string): string[] {
    if (includedIds.has(id)) return [id];
    return byId.get(id)!.dependsOn.flatMap(retainedAncestors);
  }
  const included = [...byId.values()].filter((step) => includedIds.has(step.id)).map((step) => ({ ...step, dependsOn: [...new Set(step.dependsOn.flatMap(retainedAncestors))] }));
  const sorted = sortSteps(included);
  const { schedule, finish: optimizedDays } = forward(sorted, profile);
  const children = new Map(sorted.map((step) => [step.id, [] as string[]]));
  for (const step of sorted) for (const parent of step.dependsOn) children.get(parent)!.push(step.id);
  const latestStart = new Map<string, number>();
  for (const step of [...sorted].reverse()) {
    const successors = children.get(step.id)!;
    const latestFinish = successors.length ? Math.min(...successors.map((id) => latestStart.get(id)!)) : optimizedDays;
    const duration = profile.stepStatus[step.id] === "done" ? 0 : step.durationDays.likely;
    latestStart.set(step.id, latestFinish - duration);
  }
  const nodes: PathNode[] = sorted.map((step) => {
    const timing = schedule.get(step.id)!;
    const slack = latestStart.get(step.id)! - timing.earliestStart;
    return { ...step, ...timing, slack, critical: slack === 0, status: profile.stepStatus[step.id] ?? "todo" };
  });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = nodes.flatMap((node) => node.dependsOn.map((from) => ({ from, to: node.id, critical: node.critical && nodesById.get(from)!.critical && nodesById.get(from)!.earliestFinish === node.earliestStart })));
  const criticalNodes = nodes.filter((node) => node.critical && node.status !== "done" && node.durationDays.likely > 0);
  // With tied branches, start the recommended chain at the first shared bottleneck
  // whose completion actually advances readiness. All critical branches still appear
  // in nodes/edges, including parallel prerequisites before this chain's start.
  const firstCritical = criticalNodes.find((node) => forward(sorted, profile, node.id).finish < optimizedDays) ?? criticalNodes[0];
  const criticalPath: string[] = [];
  let current: PathNode | undefined = firstCritical;
  while (current) {
    criticalPath.push(current.id);
    const successor = edges.find((edge) => edge.from === current!.id && edge.critical);
    current = successor ? nodesById.get(successor.to) : undefined;
  }
  const naiveDays = nodes.reduce((total, node) => total + (node.status === "done" ? 0 : node.durationDays.likely), 0);
  const costAED = nodes.reduce((total, node) => ({ min: total.min + (node.costAED?.min ?? 0), max: total.max + (node.costAED?.max ?? 0) }), { min: 0, max: 0 });
  return {
    nodes, edges, criticalPath, naiveDays, optimizedDays, savedDays: Math.max(0, naiveDays - optimizedDays),
    costAED: { min: Math.round(costAED.min * 100) / 100, max: Math.round(costAED.max * 100) / 100 },
    nullCostCount: nodes.filter((node) => node.costAED === null).length,
    parallelOpportunities: nodes.filter((node) => node.status !== "done" && (node.canStartBeforeArrival || (node.earliestStart === 0 && node.durationDays.likely >= 7))).map((node) => ({
      stepId: node.id,
      message: firstCritical ? `Start ${node.title} now — runs alongside ${firstCritical.title}.` : `Start ${node.title} before arrival.`,
      savedDays: Math.max(0, node.durationDays.likely - node.slack),
    })),
    excludedSteps,
  };
}
