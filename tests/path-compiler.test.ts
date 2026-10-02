import { describe, expect, it, vi } from "vitest";
import { PathResult, Profile, type Step } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { steps } from "@/lib/engines/seed-data";
import { compilePath } from "@/lib/engines/path-compiler";

const priya = Profile.parse(personas.priya);
const makeStep = (id: string, duration: number, dependsOn: string[] = [], extra: Partial<Step> = {}): Step => ({
  id, title: id, lane: "company", authority: "Test authority", description: id,
  durationDays: { min: duration, likely: duration, max: duration }, dependsOn,
  documents: [], ruleIds: [], costAED: null, confidence: "high", verify: true, ...extra,
});

describe("§8.2 path compiler", () => {
  it("produces Priya's complete acyclic path with pre-arrival attestation and a shorter schedule", () => {
    const result = compilePath(priya, steps);
    expect(PathResult.parse(result)).toEqual(result);
    expect(result.nodes.length).toBeGreaterThanOrEqual(30);
    expect(result.nodes.find((node) => node.id === "F-ATTEST")?.earliestStart).toBe(-30);
    expect(result.parallelOpportunities.some((opportunity) => opportunity.stepId === "F-ATTEST")).toBe(true);
    expect(result.optimizedDays).toBeLessThan(result.naiveDays);
    expect(result.savedDays).toBe(result.naiveDays - result.optimizedDays);
    expect(result.nodes.some((node) => node.id === "R-DL")).toBe(false);
    expect(result.excludedSteps.find((step) => step.stepId === "R-DL")?.reason).toMatch(/India.*not an eligible exchange country/);
    const order = result.nodes.map((node) => node.id);
    for (const node of result.nodes) for (const dependency of node.dependsOn) expect(order.indexOf(dependency)).toBeLessThan(order.indexOf(node.id));
    for (const edge of result.edges) expect(result.nodes.find((n) => n.id === edge.to)!.earliestStart).toBeGreaterThanOrEqual(result.nodes.find((n) => n.id === edge.from)!.earliestFinish);
  });
  it("marking the first recommended critical step done reduces optimized days without mutating inputs", () => {
    const original = JSON.stringify({ priya, steps });
    const before = compilePath(priya, steps);
    const first = before.criticalPath[0];
    const after = compilePath({ ...priya, stepStatus: { [first]: "done" } }, steps);
    expect(after.optimizedDays).toBeLessThan(before.optimizedDays);
    expect(after.nodes.find((n) => n.id === first)!.earliestFinish).toBe(after.nodes.find((n) => n.id === first)!.earliestStart);
    expect(JSON.stringify({ priya, steps })).toBe(original);
  });
  it("removes all family steps when the founder has no family", () => {
    expect(compilePath({ ...priya, spouse: false, childrenAges: [] }, steps).nodes.every((n) => n.lane !== "family")).toBe(true);
  });
  it("transitively relinks excluded prerequisites and deduplicates inherited edges", () => {
    const graph = [makeStep("a", 3), makeStep("b", 9, ["a"], { appliesIf: { field: "hasFamily", op: "truthy" } }), makeStep("c", 9, ["b"], { appliesIf: { field: "hasFamily", op: "truthy" } }), makeStep("d", 2, ["c", "a"])];
    const result = compilePath({ ...priya, spouse: false, childrenAges: [] }, graph);
    expect(result.nodes.map((n) => n.id)).toEqual(["a", "d"]);
    expect(result.nodes[1]).toMatchObject({ dependsOn: ["a"], earliestStart: 3, earliestFinish: 5 });
    expect(result.excludedSteps.map((n) => n.stepId)).toEqual(["b", "c"]);
  });
  it("computes backward slack and keeps tied critical branches while recommending their shared bottleneck", () => {
    const result = compilePath(priya, [makeStep("a", 3), makeStep("b", 3), makeStep("c", 5, ["a", "b"]), makeStep("short", 2)]);
    expect(result.optimizedDays).toBe(8);
    expect(result.nodes.filter((n) => n.critical).map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(result.nodes.find((n) => n.id === "short")?.slack).toBe(6);
    expect(result.criticalPath[0]).toBe("c");
    expect(result.edges.filter((e) => e.critical)).toHaveLength(2);
    expect(compilePath({ ...priya, stepStatus: { a: "done" } }, [makeStep("a", 3), makeStep("b", 3), makeStep("c", 5, ["a", "b"])]).optimizedDays).toBe(8);
  });
  it("respects arrival floor and pre-arrival prerequisites", () => {
    const result = compilePath(priya, [makeStep("remote", 21, [], { canStartBeforeArrival: true }), makeStep("land", 2, ["remote"])]);
    expect(result.nodes[0]).toMatchObject({ earliestStart: -30, earliestFinish: -9 });
    expect(result.nodes[1]).toMatchObject({ earliestStart: 0, earliestFinish: 2 });
  });
  it("throws on cycles; production policy removes the lowest-confidence edge in the actual cycle and reports it", () => {
    const graph = [makeStep("a", 2, ["c"], { confidence: "medium" }), makeStep("b", 3, ["a"]), makeStep("c", 4, ["b"], { confidence: "low" }), makeStep("downstream", 1, ["c"], { confidence: "low" })];
    expect(() => compilePath(priya, graph)).toThrow(/cycle/);
    const onCycle = vi.fn();
    const result = compilePath(priya, graph, { cyclePolicy: "break", onCycle });
    expect(onCycle).toHaveBeenCalledExactlyOnceWith({ from: "b", to: "c" });
    expect(result.edges).not.toContainEqual(expect.objectContaining({ from: "b", to: "c" }));
    expect(result.edges).toContainEqual(expect.objectContaining({ from: "c", to: "downstream" }));
    expect(graph[2].dependsOn).toEqual(["b"]);
  });
  it("handles excluded cycles, self loops and invalid graph references explicitly", () => {
    expect(() => compilePath(priya, [makeStep("self", 1, ["self"])] )).toThrow(/cycle/);
    expect(() => compilePath(priya, [makeStep("bad", 1, ["missing"])] )).toThrow(/Unknown dependency/);
    expect(() => compilePath(priya, [makeStep("same", 1), makeStep("same", 2)] )).toThrow(/Duplicate/);
    expect(() => compilePath(priya, [makeStep("excluded", 1, ["excluded"], { appliesIf: { field: "isADGM", op: "truthy" } })] )).toThrow(/cycle/);
  });
  it("totals known costs, counts unknowns, preserves statuses, and handles empty/done paths", () => {
    const graph = [makeStep("paid", 3, [], { costAED: { min: 10, max: 20 } }), makeStep("unknown", 1, ["paid"])];
    const result = compilePath({ ...priya, stepStatus: { paid: "blocked", unknown: "in_progress" } }, graph);
    expect(result).toMatchObject({ costAED: { min: 10, max: 20 }, nullCostCount: 1 });
    expect(result.nodes.map((n) => n.status)).toEqual(["blocked", "in_progress"]);
    expect(compilePath(priya, [])).toMatchObject({ nodes: [], edges: [], criticalPath: [], optimizedDays: 0, naiveDays: 0, savedDays: 0 });
    expect(compilePath({ ...priya, stepStatus: { paid: "done", unknown: "done" } }, graph)).toMatchObject({ optimizedDays: 0, naiveDays: 0, parallelOpportunities: [] });
  });
});
