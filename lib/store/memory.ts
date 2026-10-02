import { z } from "zod";
import { Jurisdiction, Lane, TraceEvent } from "@/lib/schemas";
import { steps } from "@/lib/engines/seed-data";

const eventMetadata = {
  stepId: z.string().max(80).optional(), lane: Lane.optional(), authority: z.string().max(120).optional(),
};
const standardEventInput = z.object({
  type: z.enum(["compile", "step_status", "step_status_change", "agent_run", "what_if", "bank_fix"]),
  ...eventMetadata,
  payload: z.record(z.string().max(80), z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()])).optional(),
}).strict();
export const DurationReportPayload = z.object({
  days: z.number().int().min(1).max(3650),
  hasSpouse: z.boolean(),
  childrenCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  jurisdiction: Jurisdiction.nullable(),
}).strict();
const stepIds = new Set(steps.map((step) => step.id));
const durationReportInput = z.object({
  ...eventMetadata,
  type: z.literal("duration_report"),
  stepId: z.string().max(80).refine((id) => stepIds.has(id), "Select a known step."),
  payload: DurationReportPayload,
}).strict();
export const FounderEventInput = z.discriminatedUnion("type", [standardEventInput, durationReportInput]);
export type FounderEvent = z.infer<typeof FounderEventInput> & { id: string; founderId: string; ts: string };

// Process-local and ephemeral by design; each serverless instance has its own bounded history.
export class MemoryStore {
  private runs = new Map<string, TraceEvent[]>();
  private events: FounderEvent[] = [];
  constructor(private maxRuns = 500, private maxEvents = 5000, private maxTraceEvents = 300) {}
  appendTrace(input: TraceEvent): void {
    const event = TraceEvent.parse(input);
    let run = this.runs.get(event.runId);
    if (!run) {
      run = [];
      this.runs.set(event.runId, run);
      while (this.runs.size > this.maxRuns) this.runs.delete(this.runs.keys().next().value!);
    }
    if (run.length >= this.maxTraceEvents) run.splice(1, 1);
    run.push(structuredClone(event));
  }
  getRun(runId: string): TraceEvent[] { return structuredClone(this.runs.get(runId) ?? []); }
  listRuns(): TraceEvent[][] { return structuredClone([...this.runs.values()].reverse()); }
  appendEvent(event: FounderEvent): void {
    this.events.push(structuredClone(event));
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
  }
  listEvents(): FounderEvent[] { return structuredClone(this.events); }
}

const globalStore = globalThis as typeof globalThis & { manzilMemoryStore?: MemoryStore };
export const memoryStore = globalStore.manzilMemoryStore ??= new MemoryStore();
