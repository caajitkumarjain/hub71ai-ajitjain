import { afterEach, describe, expect, it, vi } from "vitest";
import personas from "@/data/personas.json";
import { Obligation, Profile, Rule, WhatIfResult } from "@/lib/schemas";
import { computeObligations, whatIf } from "@/lib/engines/obligation-twin";
import { compilePath } from "@/lib/engines/path-compiler";
import { rules, steps } from "@/lib/engines/seed-data";

const today = new Date("2026-10-02T15:45:00.000Z");
const company = Profile.parse({ ...personas.priya, jurisdiction: "adgm", incorporationDate: "2026-10-15" });

function profile(patch: Partial<Profile> = {}): Profile {
  return Profile.parse({ ...company, ...patch });
}

function rule(id: string, patch: Partial<Rule> = {}): Rule {
  return Rule.parse({ ...rules.find((item) => item.id === id), ...patch });
}

afterEach(() => vi.useRealTimers());

describe("obligation twin", () => {
  it("registers Corporate Tax three calendar months after incorporation", () => {
    const obligations = computeObligations(company, rules, today);
    expect(obligations.find((item) => item.ruleId === "CT-REG")).toMatchObject({ dueDate: "2027-01-15", penaltyAED: 10_000, status: "upcoming" });
    expect(obligations.every((item) => Obligation.safeParse(item).success)).toBe(true);
  });

  it("shows voluntary VAT as info at 200k and estimated mandatory registration at 400k", () => {
    const low = computeObligations(profile({ revenue12mAED: 200_000 }), rules, today);
    expect(low.some((item) => item.ruleId === "VAT-REG")).toBe(false);
    expect(low.find((item) => item.ruleId === "VAT-VOL")).toMatchObject({ dueDate: null, status: "info" });
    const vat = computeObligations(profile({ revenue12mAED: 400_000 }), rules, today).find((item) => item.ruleId === "VAT-REG");
    expect(vat).toMatchObject({ dueDate: "2026-11-01", status: "due_soon" });
    expect(vat?.reason).toContain("estimate — 30 days from crossing; assumes you cross today");
  });

  it("requires the threshold to be exceeded and measures crossing from today", () => {
    expect(computeObligations(profile({ revenue12mAED: 375_000 }), [rule("VAT-REG", { appliesIf: undefined })], today)).toEqual([]);
    const vat = computeObligations(profile({ revenue12mAED: 400_000, incorporationDate: "2020-01-01" }), [rule("VAT-REG")], new Date("2027-04-10T23:59:00Z"));
    expect(vat[0].dueDate).toBe("2027-05-10");
  });

  it("adds the fixed Phase 1 ASP deadline at revenue 60M", () => {
    const high = computeObligations(profile({ revenue12mAED: 60_000_000 }), rules, today);
    expect(high.find((item) => item.ruleId === "EINV-P1-ASP")).toMatchObject({ dueDate: "2026-10-30", status: "due_soon" });
    expect(high.some((item) => item.ruleId === "EINV-P2")).toBe(false);
  });

  it("excludes ADGM rules for a mainland company", () => {
    expect(computeObligations(profile({ jurisdiction: "mainland" }), rules, today).filter((item) => item.ruleId.startsWith("ADGM-"))).toEqual([]);
  });

  it("uses arrival for arrival triggers even when incorporation is known", () => {
    const result = computeObligations(profile({ arrivalDate: "2025-11-12", incorporationDate: "2026-01-01" }), [rule("HI-RENEW"), rule("VISA-RENEW")], today);
    expect(result.find((item) => item.ruleId === "HI-RENEW")?.dueDate).toBe("2026-11-12");
    expect(result.find((item) => item.ruleId === "VISA-RENEW")?.dueDate).toBe("2027-10-13");
  });

  it("labels incorporation projected from the compiled licence finish", () => {
    const projected = profile({ incorporationDate: undefined });
    const licence = compilePath(projected, steps).nodes.find((node) => node.id === "C-LIC")!;
    const incorporation = new Date(`${projected.arrivalDate}T00:00:00Z`);
    incorporation.setUTCDate(incorporation.getUTCDate() + licence.earliestFinish);
    const actual = computeObligations(projected, [rule("CT-REG")], today)[0];
    const fromExplicitDate = computeObligations(profile({ incorporationDate: incorporation.toISOString().slice(0, 10) }), [rule("CT-REG")], today)[0];
    expect(actual.dueDate).toBe(fromExplicitDate.dueDate);
    expect(actual.reason).toContain("projected incorporation");
    expect(actual.reason).toContain(`(${licence.earliestFinish} days)`);
    expect(fromExplicitDate.reason).not.toContain("projected");
  });

  it("clamps month ends, including leap years, before applying day offsets", () => {
    const monthly = rule("CT-REG", { trigger: { type: "from_date", field: "incorporationDate", offsetMonths: 1 } });
    expect(computeObligations(profile({ incorporationDate: "2026-01-31" }), [monthly], today)[0].dueDate).toBe("2026-02-28");
    expect(computeObligations(profile({ incorporationDate: "2028-01-31" }), [monthly], today)[0].dueDate).toBe("2028-02-29");
    const reminder = rule("VISA-RENEW", { trigger: { type: "from_date", field: "arrivalDate", offsetMonths: 1, offsetDays: -1 } });
    expect(computeObligations(profile({ arrivalDate: "2026-01-31" }), [reminder], today)[0].dueDate).toBe("2026-02-27");
  });

  it("classifies dates at UTC day boundaries and at exactly 30 days", () => {
    const datedRules = ["2026-10-01", "2026-10-02", "2026-11-01", "2026-11-02"].map((date, index) => rule("CT-REG", { id: `BOUNDARY-${index}`, trigger: { type: "fixed_date", date } }));
    expect(computeObligations(company, datedRules, today).map((item) => item.status)).toEqual(["overdue", "due_soon", "due_soon", "upcoming"]);
  });

  it("generates one year of monthly occurrences without carrying February's clamp into March", () => {
    const result = computeObligations(profile({ incorporationDate: "2020-01-31" }), [rule("WPS")], new Date("2026-01-31T20:00:00Z"));
    expect(result).toHaveLength(12);
    expect(result.slice(0, 3).map((item) => item.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(result.at(-1)?.dueDate).toBe("2026-12-31");
    expect(result.every((item) => item.status !== "overdue")).toBe(true);
  });

  it("supports yearly and quarterly recurrence and excludes the horizon endpoint", () => {
    const recurringProfile = profile({ incorporationDate: "2020-10-02" });
    expect(computeObligations(recurringProfile, [rule("ADGM-RENEW")], today).map((item) => item.dueDate)).toEqual(["2026-10-02"]);
    const quarterly = rule("WPS", { trigger: { type: "recurring", field: "incorporationDate", every: "quarter" } });
    expect(computeObligations(recurringProfile, [quarterly], today).map((item) => item.dueDate)).toEqual(["2026-10-02", "2027-01-02", "2027-04-02", "2027-07-02"]);
  });

  it("preserves penalty uncertainty and sourced USD qualifications", () => {
    const result = computeObligations(profile({ incorporationDate: "2025-10-15", arrivalDate: "2025-10-12" }), rules, today);
    expect(result.find((item) => item.ruleId === "CT-RET")).toMatchObject({ penaltyAED: null, penaltyDisplay: "UNKNOWN · verify with FTA" });
    expect(result.find((item) => item.ruleId === "ADGM-ACC")?.penaltyDisplay).toBe("up to USD 15,000 (≈ AED 55,087.5)");
    expect(result.find((item) => item.ruleId === "ADGM-RENEW")?.penaltyDisplay).toBe("USD 150 (≈ AED 550.88) per month late, max USD 450");
    const usdOnly = rule("ADGM-ACC", { penaltyAED: null });
    expect(computeObligations(company, [usdOnly], today)[0].penaltyAED).toBeCloseTo(55_087.5);
    expect(result.find((item) => item.ruleId === "TAWTH-RENEW")?.penaltyAED).toBeNull();
  });

  it("diffs added and removed rules using one default clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
    const result = whatIf(profile({ revenue12mAED: 200_000, hires12m: 0 }), { revenue12mAED: 60_000_000, hires12m: 2 });
    expect(WhatIfResult.safeParse(result).success).toBe(true);
    expect(result.diff.added.map((item) => item.ruleId)).toContain("VAT-REG");
    expect(result.diff.added.map((item) => item.ruleId)).toContain("EINV-P1-ASP");
    expect(result.diff.added.filter((item) => item.ruleId === "WPS")).toHaveLength(12);
    expect(result.after.find((item) => item.ruleId === "VAT-REG")?.dueDate).toBe("2026-11-01");
    const removed = whatIf(profile({ revenue12mAED: 60_000_000, hires12m: 2 }), { revenue12mAED: 200_000, hires12m: 0 }, today);
    expect(removed.diff.removed.filter((item) => item.ruleId === "WPS")).toHaveLength(12);
    expect(removed.diff.removed.map((item) => item.ruleId)).toContain("VAT-REG");
  });

  it("matches individual recurrence indices across changed dates and horizon boundaries", () => {
    const result = whatIf(profile({ incorporationDate: "2026-10-01" }), { incorporationDate: "2026-10-03" }, today);
    const changed = result.diff.changed.filter((item) => item.before.ruleId === "WPS");
    expect(changed).toHaveLength(11);
    expect(changed[0]).toMatchObject({ before: { dueDate: "2026-11-01" }, after: { dueDate: "2026-11-03" } });
    expect(result.diff.added.filter((item) => item.ruleId === "WPS").map((item) => item.dueDate)).toEqual(["2026-10-03"]);
    expect(result.diff.removed.filter((item) => item.ruleId === "WPS").map((item) => item.dueDate)).toEqual(["2027-10-01"]);
  });

  it("returns no diff for an empty patch and leaves input objects and the clock untouched", () => {
    const input = structuredClone(company);
    const inputRules = structuredClone(rules);
    const clock = new Date(today);
    const expected = structuredClone({ input, inputRules, clock });
    computeObligations(input, inputRules, clock);
    expect(whatIf(input, {}, clock).diff).toEqual({ added: [], removed: [], changed: [] });
    expect({ input, inputRules, clock }).toEqual(expected);
  });
});
