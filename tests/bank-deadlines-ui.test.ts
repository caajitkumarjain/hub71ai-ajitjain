import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as bankability } from "@/app/api/bankability/route";
import { POST as obligations } from "@/app/api/obligations/route";
import { BankabilityResult, Profile, type Obligation } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { applyBankFix, prioritizeFindings } from "@/components/bank/bank-client";
import { dateLabel, groupObligations, nextDeadline, obligationKey, positionToRevenue, requestScenario, revenueStops, revenueToPosition, scenarioChanges } from "@/components/deadlines/deadline-client";

const priya = Profile.parse(personas.priya);
const routes: Record<string, (request: Request) => Promise<Response>> = {
  "/api/bankability": bankability, "/api/obligations": obligations,
};
function realRoutes() {
  const fetch = vi.fn(async (input: string, init: RequestInit) => routes[input](new Request(`http://localhost${input}`, init)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
async function bankResult() {
  return BankabilityResult.parse(await (await bankability(new Request("http://localhost/api/bankability", { method: "POST", body: JSON.stringify({ profile: priya }) }))).json());
}
afterEach(() => vi.unstubAllGlobals());

describe("Bank check client and real API", () => {
  it("applies the returned activity fix, recalculates exactly 52 → 82 and leaves the original profile intact", async () => {
    const fetch = realRoutes();
    const original = structuredClone(priya);
    const before = await bankResult();
    expect(before.score).toBe(52);
    const finding = before.findings.find((item) => item.checkId === "BK-01")!;
    const after = await applyBankFix(priya, finding);
    expect(after.result).toMatchObject({ score: 82, band: "Ready" });
    expect(after.result.findings.some((item) => item.checkId === finding.checkId)).toBe(false);
    expect(after.profile.activityCode).toBe("software-development");
    expect(priya).toEqual(original);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/bankability");
    expect(JSON.parse(fetch.mock.calls[0][1].body as string).profile).toEqual(after.profile);
  });

  it("does not invent a fix for evidence checks or accept an invalid profile patch", async () => {
    const fetch = realRoutes();
    const before = await bankResult();
    const manual = before.findings.find((item) => !item.fixAction)!;
    await expect(applyBankFix(priya, manual)).rejects.toThrow("supporting evidence");
    await expect(applyBankFix(priya, { ...manual, fixAction: { field: "hires12m", value: -1, label: "Invalid" } })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects failed and malformed fix responses without changing the source profile", async () => {
    const finding = (await bankResult()).findings.find((item) => item.checkId === "BK-01")!;
    vi.stubGlobal("fetch", async () => new Response("Unavailable", { status: 503 }));
    await expect(applyBankFix(priya, finding)).rejects.toThrow();
    vi.stubGlobal("fetch", async () => Response.json({ score: 101 }));
    await expect(applyBankFix(priya, finding)).rejects.toThrow();
    expect(priya.activityCode).toBe("general-trading");
  });

  it("prioritizes severity without mutating the API findings", async () => {
    const findings = (await bankResult()).findings.reverse();
    const original = structuredClone(findings);
    expect(prioritizeFindings(findings)[0].checkId).toBe("BK-01");
    expect(findings).toEqual(original);
  });
});

describe("Deadline scenarios and real API", () => {
  it("adds VAT at 400k, removes it at 200k and preserves the saved profile", async () => {
    const fetch = realRoutes();
    const profile = { ...priya, revenue12mAED: 200_000, hires12m: 0 };
    const original = structuredClone(profile);
    const after = await requestScenario(profile, { revenue12mAED: 400_000, hires12m: 0 });
    expect(after.before.some((row) => row.ruleId === "VAT-REG")).toBe(false);
    expect(after.diff.added.some((row) => row.ruleId === "VAT-REG")).toBe(true);
    const reversed = await requestScenario({ ...profile, revenue12mAED: 400_000 }, { revenue12mAED: 200_000, hires12m: 0 });
    expect(reversed.diff.removed.some((row) => row.ruleId === "VAT-REG")).toBe(true);
    expect(profile).toEqual(original);
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ profile, whatIf: { revenue12mAED: 400_000, hires12m: 0 } });
  });

  it("shows the engine's fixed e-invoicing date at 60M and all recurring hiring rows", async () => {
    realRoutes();
    const profile = { ...priya, revenue12mAED: 200_000, hires12m: 0 };
    const result = await requestScenario(profile, { revenue12mAED: 60_000_000, hires12m: 1 });
    expect(result.diff.added.find((row) => row.ruleId === "EINV-P1-ASP")?.dueDate).toBe("2026-10-30");
    const recurring = result.diff.added.filter((row) => row.ruleId === "WPS");
    expect(recurring).toHaveLength(12);
    expect(new Set(recurring.map(obligationKey)).size).toBe(12);
    expect(scenarioChanges(result.diff).filter(({ row }) => row.ruleId === "WPS")).toHaveLength(1);
  });

  it("validates scenario input and result boundaries", async () => {
    const fetch = realRoutes();
    await expect(requestScenario(priya, { revenue12mAED: -1, hires12m: 0 })).rejects.toThrow();
    await expect(requestScenario(priya, { revenue12mAED: 0, hires12m: 0.5 })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", async () => Response.json({ before: [], after: [] }));
    await expect(requestScenario(priya, { revenue12mAED: 0, hires12m: 0 })).rejects.toThrow();
    vi.stubGlobal("fetch", async () => new Response("Unavailable", { status: 503 }));
    await expect(requestScenario(priya, { revenue12mAED: 0, hires12m: 0 })).rejects.toThrow("503");
  });
});

describe("Deadline presentation", () => {
  it.each([...revenueStops, 200_000, 400_000])("round-trips the revenue control at AED %s", (revenue) => {
    expect(positionToRevenue(revenueToPosition(revenue))).toBe(revenue);
  });
  it("bounds slider positions without changing profile revenue", () => {
    expect(positionToRevenue(-1)).toBe(0);
    expect(positionToRevenue(701)).toBe(60_000_000);
    expect(revenueToPosition(90_000_000)).toBe(700);
  });
  function row(ruleId: string, dueDate: string | null): Obligation {
    return { ruleId, dueDate, title: ruleId, authority: "Test authority", penaltyAED: null, penaltyDisplay: "UNKNOWN", status: "info", reason: "test", sourceUrl: null, verifiedOn: "2026-10-02", confidence: "low", verify: true };
  }
  it("groups returned dates chronologically and retains undated and recurring rows", () => {
    const rows = [row("undated", null), row("later", "2027-01-01"), row("repeat", "2026-11-01"), row("repeat", "2026-10-31")];
    const original = structuredClone(rows);
    const groups = groupObligations(rows);
    expect(groups.map((group) => group.month)).toEqual(["2026-10", "2026-11", "2027-01", "undated"]);
    expect(groups.flatMap((group) => group.rows)).toHaveLength(4);
    expect(rows).toEqual(original);
  });
  it("shows today as zero days left and excludes past or unknown dates", () => {
    const today = new Date("2026-10-02T23:59:00Z");
    const rows = [row("unknown", null), row("past", "2026-10-01"), row("tomorrow", "2026-10-03"), row("today", "2026-10-02")];
    expect(nextDeadline(rows, today)).toMatchObject({ row: { ruleId: "today" }, daysLeft: 0 });
    expect(nextDeadline(rows.slice(0, 3), today)?.daysLeft).toBe(1);
    expect(nextDeadline(rows.slice(0, 2), today)).toBeNull();
    expect(dateLabel("2026-10-30")).toBe("30 Oct 2026");
  });
});
