import { describe, expect, it } from "vitest";
import { MemoryStore, type FounderEvent } from "@/lib/store";
import type { TraceEvent } from "@/lib/schemas";

const trace = (runId: string, index = 0): TraceEvent => ({
  runId, spanId: `${runId}-${index}`, parentId: index ? `${runId}-0` : null,
  ts: "2026-10-02T08:00:00.000Z", agent: "Manzil", kind: index ? "tool_result" : "run_start", data: { index },
});
const event = (index: number): FounderEvent => ({
  id: `event-${index}`, founderId: "anonymous-founder", ts: "2026-10-02T08:00:00.000Z", type: "compile", payload: { index },
});

describe("ephemeral bounded history", () => {
  it("keeps the newest 500 runs and evicts whole oldest runs", () => {
    const store = new MemoryStore();
    for (let index = 0; index < 502; index++) store.appendTrace(trace(`run-${index}`));
    expect(store.listRuns()).toHaveLength(500);
    expect(store.getRun("run-0")).toEqual([]);
    expect(store.getRun("run-1")).toEqual([]);
    expect(store.listRuns()[0][0].runId).toBe("run-501");
    expect(store.listRuns().at(-1)?.[0].runId).toBe("run-2");
  });

  it("bounds traces per run while retaining run start and the newest events", () => {
    const store = new MemoryStore(5, 10, 3);
    for (let index = 0; index < 6; index++) store.appendTrace(trace("run", index));
    expect(store.getRun("run").map((item) => item.spanId)).toEqual(["run-0", "run-4", "run-5"]);
  });

  it("does not evict newer runs when an existing run receives another event", () => {
    const store = new MemoryStore(2);
    store.appendTrace(trace("old")); store.appendTrace(trace("new")); store.appendTrace(trace("old", 1));
    expect(store.listRuns()).toHaveLength(2);
    expect(store.getRun("old")).toHaveLength(2);
    store.appendTrace(trace("newest"));
    expect(store.getRun("old")).toEqual([]);
    expect(store.getRun("new")).toHaveLength(1);
  });

  it("keeps the latest founder events in chronological order", () => {
    const store = new MemoryStore(5, 2);
    store.appendEvent(event(0)); store.appendEvent(event(1)); store.appendEvent(event(2));
    expect(store.listEvents().map((item) => item.id)).toEqual(["event-1", "event-2"]);
  });

  it("isolates stored history from caller mutations and validates trace boundaries", () => {
    const store = new MemoryStore();
    const input = trace("run"); const founderEvent = event(0);
    store.appendTrace(input); store.appendEvent(founderEvent);
    input.data = "changed"; founderEvent.payload!.index = 99;
    const retrieved = store.getRun("run"); retrieved[0].data = "changed again";
    store.listRuns()[0].pop(); store.listEvents()[0].payload!.index = 100;
    expect(store.getRun("run")[0].data).toEqual({ index: 0 });
    expect(store.listEvents()[0].payload).toEqual({ index: 0 });
    expect(() => store.appendTrace({ ...trace("bad"), kind: "invalid" } as unknown as TraceEvent)).toThrow();
  });
});
