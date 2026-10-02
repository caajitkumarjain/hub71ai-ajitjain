import { describe, expect, it } from "vitest";
import agents from "@/data/agents.json";
import { agentContractSchema, agentManifestSchema } from "@/components/agents-room/manifest";
import { parseFleetRuns, statsForAgent } from "@/components/agents-room/telemetry";

const expectedFleet = [
  "concierge", "pathfinder", "bank-officer", "deadline-sentinel", "mission-builder",
  "activity-matcher", "name-agent", "bank-pack-agent", "governance-agent", "tax-prep-agent",
  "input-guardrail", "verifier",
];
const contractFields = [
  "id", "name", "monogram", "role", "mission", "tier", "tools", "guardrails", "deliverable",
  "outputContract", "humanCheckpoint", "killCondition", "budget", "acceptanceCases",
];

describe("agent fleet manifest", () => {
  it("includes the entire requested fleet with unique ids and complete contracts", () => {
    expect(agentManifestSchema.parse(agents)).toEqual(agents);
    expect(agents.map((agent) => agent.id).sort()).toEqual([...expectedFleet].sort());
    expect(new Set(agents.map((agent) => agent.id)).size).toBe(agents.length);
    for (const agent of agents) {
      expect(Object.keys(agent).sort()).toEqual([...contractFields].sort());
      expect(agent.role).not.toMatch(/[\r\n]/);
      expect(agent.outputContract).toBe("complete | abstain | escalate + evidence ids");
      expect(new Set(agent.tools).size).toBe(agent.tools.length);
      expect(new Set(agent.guardrails).size).toBe(agent.guardrails.length);
    }
  });

  it.each(agents)("$name defines five acceptance cases with the required outcomes and a holdout", (agent) => {
    expect(agent.acceptanceCases).toHaveLength(5);
    expect(new Set(agent.acceptanceCases.map((test) => test.name)).size).toBe(5);
    expect(agent.acceptanceCases).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringMatching(/^Standard:/), expected: "complete", holdout: false }),
      expect.objectContaining({ name: expect.stringMatching(/^Missing input:/), expected: "abstain", holdout: false }),
      expect.objectContaining({ name: expect.stringMatching(/^Prompt injection:/), expected: "escalate", holdout: false }),
      expect.objectContaining({ name: expect.stringMatching(/^Unauthorised external action:/), expected: "escalate", holdout: false }),
      expect.objectContaining({ name: expect.stringMatching(/^Holdout:/), holdout: true }),
    ]));
  });

  it("keeps deterministic checks distinct from model budgets", () => {
    const deterministic = agents.filter((agent) => agent.tier === "Deterministic");
    expect(deterministic.map((agent) => agent.id).sort()).toEqual(["input-guardrail", "verifier"]);
    for (const agent of agents) {
      expect(Number.isInteger(agent.budget.maxCalls)).toBe(true);
      expect(agent.budget.maxCalls).toBeGreaterThanOrEqual(0);
      expect(agent.budget.maxSeconds).toBeGreaterThan(0);
      expect(agent.budget.maxUSD).toBeGreaterThanOrEqual(0);
      if (agent.tier === "Deterministic") {
        expect(agent.budget.maxCalls).toBe(0);
        expect(agent.budget.maxUSD).toBe(0);
      }
    }
  });

  it("rejects a missing contract field, duplicate ids and incomplete acceptance coverage", () => {
    const { mission, ...missingMission } = agents[0];
    void mission;
    expect(agentContractSchema.safeParse(missingMission).success).toBe(false);
    expect(agentManifestSchema.safeParse([...agents, agents[0]]).success).toBe(false);
    expect(agentContractSchema.safeParse({ ...agents[0], budget: { maxCalls: -1, maxSeconds: 0, maxUSD: -1 } }).success).toBe(false);
    expect(agentContractSchema.safeParse({ ...agents[0], acceptanceCases: agents[0].acceptanceCases.slice(1) }).success).toBe(false);
    for (const expected of ["abstain", "escalate"]) {
      const cases = agents[0].acceptanceCases.map((test) => test.expected === expected ? { ...test, expected: "complete" } : test);
      expect(agentContractSchema.safeParse({ ...agents[0], acceptanceCases: cases }).success).toBe(false);
    }
    const noHoldout = agents[0].acceptanceCases.map((test) => ({ ...test, holdout: false }));
    expect(agentContractSchema.safeParse({ ...agents[0], acceptanceCases: noHoldout }).success).toBe(false);
  });
});

// Synthetic payloads test parsing only; they are never used as displayed run history.
describe("agent fleet telemetry", () => {
  it("keeps missing measurements and verification unknown", () => {
    const runs = parseFleetRuns({ runs: [{ id: "synthetic-unknown", agentId: "pathfinder", status: "complete" }] });
    expect(runs[0].verified).toBeNull();
    expect(statsForAgent(runs, "pathfinder")).toEqual({ runs: 1, avgMs: null, verifiedPct: null });
    expect(statsForAgent(runs, "bank-officer")).toBeNull();
    expect(parseFleetRuns({ runs: [] })).toEqual([]);
  });

  it.each([
    null,
    { runs: "unavailable" },
    [{ agent: "Pathfinder" }],
    [{ id: "synthetic-negative", ms: -1 }],
    [{ id: "synthetic-duration", durationMs: "12" }],
    [{ id: "synthetic-verdict", verified: "true" }],
    [{ id: "synthetic-trace", trace: [{ kind: "tool_call", agent: "Pathfinder", ms: -1 }] }],
    [{ id: "synthetic-duplicate" }, { runId: "synthetic-duplicate" }],
    [[{ kind: "agent_start", agent: "Pathfinder" }]],
  ])("rejects malformed or ambiguous telemetry %j", (payload) => {
    expect(() => parseFleetRuns(payload)).toThrow();
  });

  it("accepts raw trace runs, preserving explicit verdicts, status and trace durations", () => {
    const runs = parseFleetRuns({ runs: [[
      { runId: "synthetic-trace", kind: "run_start", agent: "Concierge", ts: "2026-10-02T09:00:00Z" },
      { runId: "synthetic-trace", kind: "agent_start", agent: "Pathfinder", durationMs: 120 },
      { runId: "synthetic-trace", kind: "handoff", agent: "Concierge", name: "Pathfinder", ms: 3 },
      { runId: "synthetic-trace", kind: "tool_result", agent: "Pathfinder", name: "compile_path", ms: 8 },
      { runId: "synthetic-trace", kind: "verifier", agent: "Verifier", data: { passed: true }, ms: 2 },
      { runId: "synthetic-trace", kind: "final", agent: "Pathfinder", data: { result: { status: "complete" } } },
    ]] });
    expect(runs[0]).toMatchObject({ id: "synthetic-trace", agent: "Pathfinder", status: "complete", verified: true });
    expect(runs[0].trace).toHaveLength(6);
    expect(statsForAgent(runs, "pathfinder")).toEqual({ runs: 1, avgMs: 120, verifiedPct: 100 });
    expect(statsForAgent(runs, "concierge")).toEqual({ runs: 1, avgMs: null, verifiedPct: 100 });
  });

  it("normalises source names and computes averages only from reported measurements", () => {
    const runs = parseFleetRuns([
      { id: "synthetic-first", agent: " Bank Officer ", ms: 100, verified: true },
      { id: "synthetic-second", agentId: "bank-officer", durationMs: 300, verified: false },
      { id: "synthetic-third", agent: "BANK_OFFICER", status: "complete" },
    ]);
    expect(statsForAgent(runs, "bank-officer")).toEqual({ runs: 3, avgMs: 200, verifiedPct: 50 });
  });

  it("uses the latest verifier event and never infers a pass from completion alone", () => {
    const runs = parseFleetRuns([
      { id: "synthetic-revised", agent: "Pathfinder", events: [
        { kind: "verifier", agent: "Verifier", data: { verdict: "approve" } },
        { kind: "verifier", agent: "Verifier", data: { verdict: "revise" } },
      ] },
      { id: "synthetic-no-verdict", agent: "Pathfinder", trace: [
        { kind: "verifier", agent: "Verifier", data: { message: "finished" } },
        { kind: "final", agent: "Pathfinder", data: { status: "complete" } },
      ] },
    ]);
    expect(runs[0].verified).toBe(false);
    expect(runs[1].verified).toBeNull();
    expect(statsForAgent(runs, "pathfinder")?.verifiedPct).toBe(0);
  });

  it("reads runtime completion duration without attributing the whole run to each agent", () => {
    const runs = parseFleetRuns([[
      { runId: "synthetic-runtime", kind: "run_start", agent: "Manzil" },
      { runId: "synthetic-runtime", kind: "agent_start", agent: "Concierge" },
      { runId: "synthetic-runtime", kind: "agent_start", agent: "Pathfinder" },
      { runId: "synthetic-runtime", kind: "verifier", agent: "Verifier", data: { approved: true } },
      { runId: "synthetic-runtime", kind: "final", agent: "Manzil", ms: 500, data: { status: "complete" } },
    ]]);
    expect(runs[0]).toMatchObject({ agent: "Pathfinder", durationMs: 500, verified: true });
    expect(statsForAgent(runs, "pathfinder")).toEqual({ runs: 1, avgMs: null, verifiedPct: 100 });
    expect(statsForAgent(runs, "concierge")?.avgMs).toBeNull();
  });
});
