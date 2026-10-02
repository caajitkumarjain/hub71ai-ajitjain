import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/events/route";
import { memoryStore } from "@/lib/store";
import { Profile } from "@/lib/schemas";
import { steps } from "@/lib/engines/seed-data";
import { saveDurationReport } from "@/components/path/duration-report";
import personas from "@/data/personas.json";

const profile = Profile.parse(personas.priya);
const payload = { days: 24, hasSpouse: true, childrenCount: 2, jurisdiction: "adgm" };
const report = { type: "duration_report", stepId: "F-ATTEST", payload };
const request = (body: unknown) => new Request("https://manzil.example/api/events", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
afterEach(() => vi.unstubAllGlobals());

describe("duration report API", () => {
  it("stores real duration and family context with canonical authority and lane", async () => {
    const response = await POST(request({ ...report, authority: "Invented authority", lane: "operate" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const step = steps.find((item) => item.id === report.stepId)!;
    expect(memoryStore.listEvents().at(-1)).toMatchObject({ ...report, authority: step.authority, lane: step.lane });
    expect(response.headers.get("set-cookie")).toContain("manzil_founder=");
  });

  it.each([1, 3650])("accepts the valid day boundary %i and unknown jurisdiction", async (days) => {
    const response = await POST(request({ ...report, payload: { ...payload, days, jurisdiction: null } }));
    expect(response.status).toBe(200);
    expect(memoryStore.listEvents().at(-1)?.payload).toMatchObject({ days, jurisdiction: null });
  });

  it.each([0, -1, 1.5, 3651, Number.MAX_SAFE_INTEGER + 1, "24", null])("rejects invalid days %s without storing an event", async (days) => {
    const count = memoryStore.listEvents().length;
    const response = await POST(request({ ...report, payload: { ...payload, days } }));
    expect(response.status).toBe(400);
    expect(memoryStore.listEvents()).toHaveLength(count);
  });

  it.each([
    { ...report, stepId: "F-INVENTED" }, { ...report, stepId: undefined }, { ...report, payload: undefined },
    { ...report, payload: { ...payload, hasSpouse: "true" } }, { ...report, payload: { ...payload, childrenCount: -1 } },
    { ...report, payload: { ...payload, childrenCount: 1.5 } }, { ...report, payload: { ...payload, jurisdiction: "invalid" } },
    { ...report, payload: { ...payload, name: "Unwanted personal data" } },
  ])("rejects invalid step or profile context %#", async (body) => {
    const count = memoryStore.listEvents().length;
    expect((await POST(request(body))).status).toBe(400);
    expect(memoryStore.listEvents()).toHaveLength(count);
  });
});

describe("duration report client", () => {
  it("saves actual profile context through the real route without sending the full profile", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => POST(new Request("https://manzil.example/api/events", init)));
    vi.stubGlobal("fetch", fetcher);
    await saveDurationReport("F-ATTEST", 24, profile);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string)).toEqual({ type: "duration_report", stepId: "F-ATTEST", payload: {
      days: 24, hasSpouse: profile.spouse, childrenCount: profile.childrenAges.length, jurisdiction: profile.jurisdiction ?? null,
    } });
    expect(memoryStore.listEvents().at(-1)?.payload).toMatchObject({ days: 24 });
  });

  it("rejects invalid client days before posting and sends null for an unselected jurisdiction", async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true })); vi.stubGlobal("fetch", fetcher);
    for (const days of [0, 1.5, 3651, Infinity, NaN]) await expect(saveDurationReport("F-ATTEST", days, profile)).rejects.toThrow("whole number");
    expect(fetcher).not.toHaveBeenCalled();
    await saveDurationReport("C-LIC", 12, { ...profile, jurisdiction: undefined });
    expect(JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).payload.jurisdiction).toBeNull();
  });

  it.each([new Response("Unavailable", { status: 503 }), Response.json({ ok: false })])("does not claim success on failed or malformed responses %#", async (response) => {
    vi.stubGlobal("fetch", async () => response);
    await expect(saveDurationReport("F-ATTEST", 24, profile)).rejects.toThrow("couldn’t be saved");
  });
});
