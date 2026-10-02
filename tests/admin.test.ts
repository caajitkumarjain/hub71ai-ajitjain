import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminCookie, createAdminSession, passcodeMatches, sessionSeconds, validAdminSession } from "@/lib/admin/auth";
import { adminStats, median, summarizeRuns } from "@/lib/admin/stats";
import { generateSyntheticCohort, mulberry32, triangular, type SyntheticFounder } from "@/lib/synthetic-cohort";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { GET as statsRoute } from "@/app/api/admin/stats/route";
import { GET as runsRoute } from "@/app/api/admin/runs/route";
import { steps } from "@/lib/engines/seed-data";
import type { FounderEvent } from "@/lib/store";
import type { TraceEvent } from "@/lib/schemas";

let secret: string;
beforeEach(() => { secret = randomBytes(24).toString("hex"); vi.stubEnv("ADMIN_PASSCODE", secret); });
afterEach(() => vi.unstubAllEnvs());
function request(path: string, body?: unknown, cookie?: string, origin = "https://manzil.test") {
  return new Request(`https://manzil.test${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", origin, "x-forwarded-for": randomBytes(8).toString("hex"), ...(cookie ? { cookie: `${adminCookie}=${cookie}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

describe("operator authentication", () => {
  it("rejects absent configuration, incorrect passcodes and missing/tampered sessions", () => {
    expect(passcodeMatches(secret)).toBe(true);
    expect(passcodeMatches("incorrect")).toBe(false);
    expect(validAdminSession(undefined)).toBe(false);
    const session = createAdminSession(secret, 1000);
    expect(validAdminSession(session, secret, 1001)).toBe(true);
    expect(validAdminSession(`${session}a`, secret, 1001)).toBe(false);
    expect(validAdminSession(session.replace(/^\d+/, "999999999"), secret, 1001)).toBe(false);
    expect(validAdminSession(session, `${secret}different`, 1001)).toBe(false);
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect(passcodeMatches(secret)).toBe(false);
    expect(validAdminSession(session)).toBe(false);
  });
  it("expires sessions after eight hours and rotates them on passcode change", () => {
    const session = createAdminSession(secret, 1000);
    expect(validAdminSession(session, secret, 1000 + sessionSeconds * 1000 - 1)).toBe(true);
    expect(validAdminSession(session, secret, 1000 + sessionSeconds * 1000)).toBe(false);
    expect(createAdminSession()).not.toBe(createAdminSession());
  });
  it("gates both admin data endpoints before reading their data", async () => {
    for (const handler of [statsRoute, runsRoute]) {
      const response = await handler(request("/api/admin/stats"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Operator sign-in is required.", code: "UNAUTHORIZED" });
    }
  });
  it("signs in with a secure HttpOnly session without echoing the secret", async () => {
    const response = await login(request("/api/admin/login", { passcode: secret }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain(secret);
    const token = cookie.split(";")[0].slice(adminCookie.length + 1);
    expect(validAdminSession(token)).toBe(true);
    expect((await statsRoute(request("/api/admin/stats?family=family", undefined, token))).status).toBe(200);
    expect((await runsRoute(request("/api/admin/runs", undefined, token))).status).toBe(200);
    const signedOut = await logout(request("/api/admin/logout", {}, token));
    expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("rejects bad credentials, cross-origin posts, invalid filters and unavailable configuration", async () => {
    expect((await login(request("/api/admin/login", { passcode: "wrong" }))).status).toBe(401);
    expect((await login(request("/api/admin/login", { passcode: secret }, undefined, "https://elsewhere.test"))).status).toBe(403);
    expect((await login(request("/api/admin/login", {}))).status).toBe(400);
    expect((await statsRoute(request("/api/admin/stats?family=invalid", undefined, createAdminSession()))).status).toBe(400);
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect((await login(request("/api/admin/login", { passcode: secret }))).status).toBe(503);
  });
  it("limits repeated failed sign-in attempts", async () => {
    const ip = randomBytes(8).toString("hex");
    const attempt = () => new Request("https://manzil.test/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ passcode: "wrong" }) });
    for (let index = 0; index < 5; index++) expect((await login(attempt())).status).toBe(401);
    expect((await login(attempt())).status).toBe(429);
  });
});

describe("deterministic cohort and friction statistics", () => {
  it("generates exactly 240 repeatable founder samples from seed 71", () => {
    const first = generateSyntheticCohort();
    expect(first).toHaveLength(240);
    expect(new Set(first.map((founder) => founder.id)).size).toBe(240);
    expect(first).toEqual(generateSyntheticCohort(240, 71));
    expect(first).not.toEqual(generateSyntheticCohort(240, 72));
    expect(new Set(first.map((founder) => founder.jurisdiction)).size).toBe(6);
    expect(first.every((founder) => founder.stalls.every((stall) => Number.isFinite(stall.days) && stall.days >= 0))).toBe(true);
  });
  it("samples the triangular bounds and calculates true medians without mutation", () => {
    expect(triangular(1, 3, 8, 0)).toBe(1); expect(triangular(1, 3, 8, 1)).toBe(8); expect(triangular(2, 2, 2, 0.5)).toBe(2);
    const a = mulberry32(71); const b = mulberry32(71); expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const values = [9, 1, 3, 7]; expect(median(values)).toBe(5); expect(values).toEqual([9, 1, 3, 7]); expect(median([])).toBeNull();
  });
  const cohort: SyntheticFounder[] = [
    { id: "s1", hasSpouse: true, childrenCount: 1, jurisdiction: "adgm", readyDays: 10, exposureAED: 100, unknownPenalties: 1, stalls: [{ stepId: steps[0].id, days: 10 }] },
    { id: "s2", hasSpouse: false, childrenCount: 0, jurisdiction: "mainland", readyDays: 20, exposureAED: 200, unknownPenalties: 0, stalls: [{ stepId: steps[0].id, days: 30 }] },
  ];
  const event: FounderEvent = { id: "e1", founderId: "live1", ts: "2026-10-02T10:00:00Z", type: "duration_report", stepId: steps[0].id, authority: "spoofed", payload: { days: 20, hasSpouse: true, childrenCount: 0, jurisdiction: "adgm" } };
  it("combines real durations with synthetic observations and uses canonical metadata", () => {
    const output = adminStats([event, { ...event, id: "e2", founderId: "live2", type: "compile", payload: {} }], [], undefined, cohort);
    expect(output.founders).toBe(4); expect(output.liveFounders).toBe(2);
    expect(output.friction[0]).toMatchObject({ medianDays: 20, count: 3, liveReports: 1, authority: steps[0].authority });
    expect(output.medianReadyDays).toBe(15); expect(output.exposureAED).toBe(300); expect(output.unknownPenalties).toBe(1);
    expect(output.verifiedPercent).toBeNull();
  });
  it("filters family and jurisdiction consistently and returns an honest empty state", () => {
    const family = adminStats([event], [], { family: "family", jurisdiction: "adgm" }, cohort);
    expect(family.syntheticFounders).toBe(1); expect(family.liveFounders).toBe(1); expect(family.friction[0].medianDays).toBe(15);
    const empty = adminStats([event], [], { family: "single", jurisdiction: "adgm" }, cohort);
    expect(empty.founders).toBe(0); expect(empty.friction).toEqual([]); expect(empty.medianReadyDays).toBeNull();
  });
  it("counts only actual latest verifier verdicts on completed runs", () => {
    const base = { runId: "r", spanId: "s", parentId: null, ts: "2026-10-02T10:00:00Z", agent: "Verifier" };
    const passed: TraceEvent[] = [{ ...base, kind: "verifier", data: { approved: true } }, { ...base, kind: "final", ms: 20 }];
    const failed: TraceEvent[] = [{ ...base, kind: "verifier", data: { approved: true } }, { ...base, kind: "verifier", data: { approved: false } }, { ...base, kind: "final", ms: 30 }];
    expect(adminStats([], [passed, failed], undefined, cohort).verifiedPercent).toBe(50);
    expect(summarizeRuns([failed])[0].verified).toBe(false);
    expect(summarizeRuns(Array.from({ length: 25 }, () => passed))).toHaveLength(20);
    expect(summarizeRuns([passed])[0].question).toBe("Question not retained");
  });
});
