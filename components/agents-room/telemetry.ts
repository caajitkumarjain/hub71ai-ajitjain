import { z } from "zod";

const duration = z.number().finite().nonnegative();
const label = z.string().min(1).max(160);
const traceSchema = z.object({
  kind: z.enum(["run_start", "agent_start", "handoff", "tool_call", "tool_result", "guardrail", "verifier", "message_delta", "final", "error", "fallback"]),
  agent: label,
  runId: label.optional(),
  spanId: label.optional(),
  name: label.optional(),
  ts: z.iso.datetime().optional(),
  ms: duration.optional(),
  durationMs: duration.optional(),
  data: z.unknown().optional(),
});
const runSchema = z.object({
  id: label.optional(),
  runId: label.optional(),
  agent: label.optional(),
  agentId: label.optional(),
  startedAt: z.iso.datetime().optional(),
  status: z.enum(["complete", "abstain", "escalate", "running", "error"]).optional(),
  durationMs: duration.optional(),
  ms: duration.optional(),
  verified: z.boolean().nullable().optional(),
  events: z.array(traceSchema).max(1000).optional(),
  trace: z.array(traceSchema).max(1000).optional(),
}).refine((run) => Boolean(run.id || run.runId), "A run ID is required");
const runsSchema = z.union([z.array(runSchema).max(500), z.array(z.array(traceSchema).min(1).max(1000)).max(500)]);
const responseSchema = z.union([z.object({ runs: runsSchema }), runsSchema]);
const verdictSchema = z.object({
  passed: z.boolean().optional(),
  ok: z.boolean().optional(),
  valid: z.boolean().optional(),
  approved: z.boolean().optional(),
  verdict: z.enum(["approve", "revise", "pass", "fail"]).optional(),
});
const resultSchema = z.object({ status: z.enum(["complete", "abstain", "escalate"]) });
const finalSchema = z.union([resultSchema, z.object({ result: resultSchema }).transform((value) => value.result)]);

export type RunTrace = z.infer<typeof traceSchema>;
export type FleetRun = {
  id: string;
  agent: string;
  startedAt?: string;
  status?: string;
  durationMs?: number;
  verified: boolean | null;
  trace: RunTrace[];
};
export type AgentStats = { runs: number; avgMs: number | null; verifiedPct: number | null };

export function agentKey(value: string): string {
  return value.trim().toLowerCase().replace(/[ _]+/g, "-");
}

function traceVerdict(trace: RunTrace[]): boolean | null {
  const verifier = [...trace].reverse().find((event) => event.kind === "verifier");
  if (!verifier) return null;
  const result = verdictSchema.safeParse(verifier.data);
  if (!result.success) return null;
  const data = result.data;
  if (data.passed !== undefined) return data.passed;
  if (data.ok !== undefined) return data.ok;
  if (data.valid !== undefined) return data.valid;
  if (data.approved !== undefined) return data.approved;
  return data.verdict ? data.verdict === "approve" || data.verdict === "pass" : null;
}

export function parseFleetRuns(input: unknown): FleetRun[] {
  const parsed = responseSchema.parse(input);
  const runs = Array.isArray(parsed) ? parsed : parsed.runs;
  const normalized = runs.map((run): FleetRun => {
    const raw = Array.isArray(run) ? undefined : run;
    const trace = Array.isArray(run) ? run : run.events ?? run.trace ?? [];
    const first = trace[0];
    const final = [...trace].reverse().find((event) => event.kind === "final");
    const result = finalSchema.safeParse(final?.data);
    const id = raw?.id ?? raw?.runId ?? first?.runId;
    if (!id) throw new Error("Run ID missing");
    return {
      id,
      agent: raw?.agentId ?? raw?.agent ?? [...trace].reverse().find((event) => event.kind === "agent_start")?.agent ?? first?.agent ?? "Unknown agent",
      startedAt: raw?.startedAt ?? first?.ts,
      status: raw?.status ?? (result.success ? result.data.status : undefined),
      durationMs: raw?.durationMs ?? raw?.ms ?? final?.durationMs ?? final?.ms,
      verified: raw?.verified ?? traceVerdict(trace),
      trace,
    };
  });
  if (new Set(normalized.map((run) => run.id)).size !== normalized.length) throw new Error("Duplicate run IDs");
  return normalized.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

// Statistics describe only the returned telemetry window. Missing measurements stay unknown.
export function statsForAgent(runs: FleetRun[], id: string): AgentStats | null {
  const matching = runs.filter((run) => agentKey(run.agent) === id || run.trace.some((event) => agentKey(event.agent) === id));
  if (!matching.length) return null;
  const durations = matching.map((run) => {
    const spans = run.trace.filter((event) => agentKey(event.agent) === id && event.kind === "agent_start");
    const reported = spans.map((event) => event.durationMs ?? event.ms).filter((ms): ms is number => ms !== undefined);
    return reported.length ? reported.reduce((sum, ms) => sum + ms, 0) : !run.trace.length && agentKey(run.agent) === id ? run.durationMs : undefined;
  }).filter((ms): ms is number => ms !== undefined);
  const verified = matching.filter((run) => run.verified !== null);
  return {
    runs: matching.length,
    avgMs: durations.length ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length) : null,
    verifiedPct: verified.length ? Math.round(verified.filter((run) => run.verified).length / verified.length * 100) : null,
  };
}

export async function loadFleetRuns(signal: AbortSignal): Promise<FleetRun[]> {
  const response = await fetch("/api/admin/runs", { signal, cache: "no-store", credentials: "omit", redirect: "error" });
  if (!response.ok) throw new Error("Telemetry unavailable");
  return parseFleetRuns(await response.json());
}
