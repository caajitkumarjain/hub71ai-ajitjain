import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Profile, type Obligation, type TraceEvent } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { POST as compile } from "@/app/api/compile/route";
import { POST as bankability } from "@/app/api/bankability/route";
import { POST as obligations } from "@/app/api/obligations/route";
import { POST as jurisdiction } from "@/app/api/jurisdiction/route";
import { exposureSummary, loadJourney, readJourney } from "@/components/path/journey-client";
import { missionEvents } from "@/components/path/use-mission-pack";
import { safeSourceUrl } from "@/components/brand/source-chip";

const priya = Profile.parse(personas.priya);
const routes: Record<string, (request: Request) => Promise<Response>> = {
  "/api/compile": compile, "/api/bankability": bankability,
  "/api/obligations": obligations, "/api/jurisdiction": jurisdiction,
};
function realRoutes() {
  return vi.fn(async (input: string, init: RequestInit) => routes[input](new Request(`http://localhost${input}`, init)));
}
afterEach(() => vi.unstubAllGlobals());

describe("core UI API integration", () => {
  it("loads and validates all four real route results, then caches by the complete profile", async () => {
    const fetch = realRoutes(); vi.stubGlobal("fetch", fetch);
    const resolved: string[] = [];
    const journey = await loadJourney(priya, (id, state) => resolved.push(`${id}:${state}`));
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(resolved.sort()).toEqual(["bank:ready", "jurisdictions:ready", "obligations:ready", "path:ready"]);
    expect(journey.path.nodes.length).toBeGreaterThanOrEqual(30);
    expect(journey.path.nodes.some((node) => node.id === "R-DL")).toBe(false);
    expect(journey.bank?.score).toBe(52);
    expect(journey.jurisdictions).toHaveLength(6);
    expect(readJourney(priya)).toBe(journey);
    expect(readJourney({ ...priya, revenue12mAED: 1 })).toBeNull();
  });

  it("recomputes an actual critical step and preserves the submitted profile", async () => {
    const fetch = realRoutes(); vi.stubGlobal("fetch", fetch);
    const before = await loadJourney(priya);
    const first = before.path.criticalPath[0];
    const profile = { ...priya, stepStatus: { [first]: "done" as const } };
    const after = await loadJourney(profile);
    expect(after.path.optimizedDays).toBeLessThan(before.path.optimizedDays);
    expect(after.path.nodes.find((node) => node.id === first)?.status).toBe("done");
    expect(JSON.parse(fetch.mock.calls[4][1].body as string).profile).toEqual(profile);
  });

  it("does not mark checks ready before their own requests resolve", async () => {
    const releases: (() => Promise<void>)[] = [];
    vi.stubGlobal("fetch", (input: string, init: RequestInit) => new Promise<Response>((resolve) => {
      releases.push(async () => resolve(await routes[input](new Request(`http://localhost${input}`, init))));
    }));
    const checks: string[] = [];
    const pending = loadJourney(priya, (id, state) => checks.push(`${id}:${state}`));
    expect(releases).toHaveLength(4);
    expect(checks).toEqual([]);
    await releases[1]();
    await vi.waitFor(() => expect(checks).toEqual(["bank:ready"]));
    await Promise.all([releases[0](), releases[2](), releases[3]()]);
    await pending;
    expect(checks).toHaveLength(4);
  });

  it("keeps optional checks unknown after failure and rejects a malformed path", async () => {
    const realFetch = realRoutes();
    vi.stubGlobal("fetch", (input: string, init: RequestInit) => input === "/api/compile" ? realFetch(input, init) : Promise.resolve(new Response("Unavailable", { status: 503 })));
    const states: string[] = [];
    const result = await loadJourney(priya, (id, state) => states.push(`${id}:${state}`));
    expect(result.obligations).toBeNull(); expect(result.bank).toBeNull(); expect(result.jurisdictions).toBeNull();
    expect(states).toContain("bank:unavailable");
    vi.stubGlobal("fetch", async () => Response.json({ nodes: "wrong type" }));
    await expect(loadJourney(priya)).rejects.toThrow("couldn’t be compiled");
  });

  it("does not cache an aborted journey", async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal("fetch", async () => { throw new DOMException("Aborted", "AbortError"); });
    const changed = { ...priya, name: "Aborted request" };
    await expect(loadJourney(changed, undefined, controller.signal)).rejects.toThrow("Aborted");
    expect(readJourney(changed)).toBeNull();
  });
});

describe("browser profile storage", () => {
  beforeEach(() => vi.resetModules());
  it("round-trips a validated profile and ignores corrupt or invalid storage", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
    const storage = await import("@/components/path/profile-storage");
    store.set(storage.PROFILE_KEY, "not json"); expect(storage.readProfile()).toBeNull();
    store.set(storage.PROFILE_KEY, JSON.stringify({ ...priya, childrenAges: [19] })); expect(storage.readProfile()).toBeNull();
    expect(storage.saveProfile(priya)).toBe(true);
    expect(JSON.parse(store.get(storage.PROFILE_KEY)!)).toEqual(priya);
    vi.resetModules();
    expect((await import("@/components/path/profile-storage")).readProfile()).toEqual(priya);
  });
  it("retains the profile in memory when localStorage is denied", async () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Storage denied"); } });
    const storage = await import("@/components/path/profile-storage");
    expect(storage.readProfile()).toBeNull();
    expect(storage.saveProfile(priya)).toBe(false);
    const loaded = storage.readProfile()!; loaded.name = "Changed";
    expect(storage.readProfile()?.name).toBe("Priya");
  });
});

describe("sourced UI summaries and Mission Pack stream", () => {
  function row(date: string | null, penalty: number | null): Obligation {
    return { ruleId: "example", title: "Example", authority: "Authority", dueDate: date, penaltyAED: penalty, penaltyDisplay: "UNKNOWN", status: "upcoming", reason: "test", sourceUrl: null, verifiedOn: "2026-10-02", confidence: "low", verify: true };
  }
  it("uses only returned penalties dated within the next twelve months and distinguishes missing data", () => {
    const summary = exposureSummary([row("2026-10-02", 100), row("2027-10-02", 20), row("2026-11-01", null), row("2027-10-03", 200), row(null, 300), row("2026-10-01", 400)], new Date("2026-10-02T23:00:00Z"));
    expect(summary).toMatchObject({ total: 120, unknown: true });
    expect(summary?.rows).toHaveLength(3);
    expect(exposureSummary(null)).toBeNull();
    expect(exposureSummary([])).toMatchObject({ total: 0, unknown: false });
  });
  it("reads SSE across byte boundaries, CRLF and UTF-8 without exposing partial JSON", async () => {
    const event: TraceEvent = { runId: "r", spanId: "s", parentId: null, ts: "2026-10-02T00:00:00Z", agent: "Mission Builder", kind: "final", data: { status: "complete", answer_md: "Draft → مرحبا", evidence: ["F-ATTEST"], numbers_used: [], next_actions: [], authority_to_verify: null, language: "en" } };
    const bytes = new TextEncoder().encode(`: keepalive\r\n\r\nevent: final\r\ndata: ${JSON.stringify(event)}\r\n\r\ndata: [DONE]\n\n`);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
    const events = [];
    for await (const item of missionEvents(stream)) events.push(item);
    expect(events).toEqual([event]);
  });
  it("opens only ordinary web URLs from source records", () => {
    expect(safeSourceUrl("https://icp.gov.ae/")).toBe("https://icp.gov.ae/");
    expect(safeSourceUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeSourceUrl("not a URL")).toBeUndefined();
  });
});
