import { z } from "zod";
import { Lane, TraceEvent } from "@/lib/schemas";

export const FounderEventInput = z.object({
  type: z.enum(["compile", "step_status", "step_status_change", "agent_run", "what_if", "bank_fix"]),
  stepId: z.string().max(80).optional(), lane: Lane.optional(), authority: z.string().max(120).optional(),
  payload: z.record(z.string().max(80), z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()])).optional(),
}).strict();
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
