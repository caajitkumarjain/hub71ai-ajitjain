import { randomUUID } from "node:crypto";
import { TraceEvent } from "@/lib/schemas";
import { memoryStore } from "@/lib/store";
import type { TraceInput } from "@/lib/agents/context";

export function createTraceEmitter(runId: string, onEvent: (event: TraceEvent) => void) {
  const parentId = randomUUID();
  return (input: TraceInput): void => {
    const event = TraceEvent.parse({ ...input, runId, spanId: input.kind === "run_start" ? parentId : randomUUID(),
      parentId: input.kind === "run_start" ? null : parentId, ts: new Date().toISOString() });
    memoryStore.appendTrace(event);
    onEvent(event);
  };
}
