import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as compileRoute from "@/app/api/compile/route";
import * as jurisdictionRoute from "@/app/api/jurisdiction/route";
import * as obligationsRoute from "@/app/api/obligations/route";
import * as bankabilityRoute from "@/app/api/bankability/route";
import * as engines from "@/lib/engines";
import { BankabilityResult, JurisdictionComparison, Obligation, PathResult, Profile, WhatIfResult } from "@/lib/schemas";
import personas from "@/data/personas.json";

const endpoints = [
  { name: "compile", route: compileRoute, schema: PathResult, engine: "compilePath" },
  { name: "jurisdiction", route: jurisdictionRoute, schema: JurisdictionComparison.array(), engine: "compareJurisdictions" },
  { name: "obligations", route: obligationsRoute, schema: Obligation.array(), engine: "computeObligations" },
  { name: "bankability", route: bankabilityRoute, schema: BankabilityResult, engine: "scoreBankability" },
] as const;

function request(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe.each(endpoints)("POST /api/$name", ({ route, schema, engine }) => {
  it("returns schema-valid deterministic JSON for Priya without changing the request profile", async () => {
    const body = { profile: structuredClone(personas.priya) };
    const original = structuredClone(body);
    const first = await route.POST(request(body));
    const second = await route.POST(request(body));
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toContain("application/json");
    const result: unknown = await first.json();
    expect(schema.safeParse(result).success).toBe(true);
    expect(await second.json()).toEqual(result);
    expect(body).toEqual(original);
  });

  it("uses the Node runtime and exports only a POST handler", () => {
    expect(route.runtime).toBe("nodejs");
    expect(Object.keys(route).sort()).toEqual(["POST", "runtime"]);
  });

  it("rejects malformed JSON with a typed 400 response", async () => {
    const response = await route.POST(new Request("http://localhost/api/test", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Request body must be valid JSON.", code: "INVALID_JSON" });
  });

  it.each([
    null,
    {},
    { profile: null },
    { profile: {} },
    { profile: { ...personas.priya, arrivalDate: "2026-02-30" } },
    { profile: { ...personas.priya, revenue12mAED: -1 } },
    { profile: { ...personas.priya, hires12m: "2" } },
    { profile: { ...personas.priya, childrenAges: [19] } },
    { profile: personas.priya, unexpected: true },
  ])("rejects invalid request %j", async (body) => {
    const compute = vi.spyOn(engines, engine);
    const response = await route.POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String), code: "INVALID_INPUT" });
    expect(compute).not.toHaveBeenCalled();
  });

  it("applies valid profile defaults at the request boundary", async () => {
    const compute = vi.spyOn(engines, engine);
    const minimal = {
      id: "minimal", nationality: "India", arrivalDate: "2026-10-12",
      businessDescription: "Software subscriptions", revenueModel: "saas",
    };
    const response = await route.POST(request({ profile: minimal }));
    expect(response.status).toBe(200);
    expect(compute.mock.calls[0]?.[0]).toEqual(Profile.parse(minimal));
  });

  it("does not leak unexpected computation errors", async () => {
    vi.spyOn(engines, engine).mockImplementationOnce(() => { throw new Error("private engine details"); });
    const response = await route.POST(request({ profile: personas.priya }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: expect.any(String), code: "COMPUTATION_FAILED" });
    expect(JSON.stringify(body)).not.toContain("private engine details");
  });

  it("validates engine output before responding", async () => {
    vi.spyOn(engines, engine).mockReturnValueOnce({ invalid: true } as never);
    const response = await route.POST(request({ profile: personas.priya }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.any(String), code: "COMPUTATION_FAILED" });
  });
});

describe("POST /api/obligations what-if scenarios", () => {
  it("preserves family, hires and documents when only revenue is patched", async () => {
    const profile = Profile.parse(personas.priya);
    const patch = { revenue12mAED: 50000000 };
    const compute = vi.spyOn(engines, "whatIf");
    const response = await obligationsRoute.POST(request({ profile, whatIf: patch }));
    expect(response.status).toBe(200);
    const result = WhatIfResult.parse(await response.json());
    expect(compute).toHaveBeenCalledExactlyOnceWith(profile, patch);
    expect(result).toEqual(engines.whatIf(profile, patch));
    expect(profile.spouse).toBe(true);
    expect(profile.hires12m).toBe(2);
    expect(profile.documents).toEqual(personas.priya.documents);
    expect(result.after.some((obligation) => obligation.ruleId === "EINV-P1-ASP")).toBe(true);
    expect(result.diff.added.some((obligation) => obligation.ruleId === "EINV-P1-ASP")).toBe(true);
  });

  it("keeps an empty patch empty and returns an unchanged diff", async () => {
    const compute = vi.spyOn(engines, "whatIf");
    const response = await obligationsRoute.POST(request({ profile: personas.priya, whatIf: {} }));
    expect(response.status).toBe(200);
    const result = WhatIfResult.parse(await response.json());
    expect(compute.mock.calls[0]?.[1]).toEqual({});
    expect(result.before).toEqual(result.after);
    expect(result.diff).toEqual({ added: [], removed: [], changed: [] });
  });

  it("accepts explicit false and zero values in a partial scenario", async () => {
    const patch = { spouse: false, hires12m: 0, revenue12mAED: 0, documents: [] };
    const compute = vi.spyOn(engines, "whatIf");
    const response = await obligationsRoute.POST(request({ profile: personas.priya, whatIf: patch }));
    expect(response.status).toBe(200);
    expect(compute.mock.calls[0]?.[1]).toEqual(patch);
    expect(WhatIfResult.safeParse(await response.json()).success).toBe(true);
  });

  it.each([null, [], true, "scenario", { revenue12mAED: -1 }, { hires12m: 0.5 }, { spouse: "false" }, { unsupported: true }])(
    "rejects an invalid patch %j before computation", async (patch) => {
      const compute = vi.spyOn(engines, "whatIf");
      const response = await obligationsRoute.POST(request({ profile: personas.priya, whatIf: patch }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: expect.any(String), code: "INVALID_INPUT" });
      expect(compute).not.toHaveBeenCalled();
    },
  );

  it("validates the what-if output and hides engine failures", async () => {
    const compute = vi.spyOn(engines, "whatIf");
    compute.mockReturnValueOnce({ invalid: true } as never);
    const invalid = await obligationsRoute.POST(request({ profile: personas.priya, whatIf: {} }));
    expect(invalid.status).toBe(500);
    expect(await invalid.json()).toEqual({ error: expect.any(String), code: "COMPUTATION_FAILED" });
    compute.mockImplementationOnce(() => { throw new Error("private scenario details"); });
    const failed = await obligationsRoute.POST(request({ profile: personas.priya, whatIf: {} }));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "Unable to compute obligations.", code: "COMPUTATION_FAILED" });
  });
});

describe("compile route cycle policy", () => {
  it("throws on cycles outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const compile = vi.spyOn(engines, "compilePath");
    const response = await compileRoute.POST(request({ profile: personas.priya }));
    expect(response.status).toBe(200);
    expect(compile.mock.calls[0]?.[2]).toEqual({ cyclePolicy: "throw" });
  });

  it("passes a reporting callback for cycle breaks in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const compile = vi.spyOn(engines, "compilePath");
    const response = await compileRoute.POST(request({ profile: personas.priya }));
    expect(response.status).toBe(200);
    const options = compile.mock.calls[0]?.[2];
    expect(options).toEqual({ cyclePolicy: "break", onCycle: expect.any(Function) });
    options?.onCycle?.({ from: "A", to: "B" });
    expect(warning).toHaveBeenCalledExactlyOnceWith("Path dependency cycle removed:", { from: "A", to: "B" });
  });
});
