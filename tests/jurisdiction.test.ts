import { describe, expect, it } from "vitest";
import personas from "@/data/personas.json";
import rawJurisdictions from "@/data/jurisdictions.json";
import { JurisdictionComparison, JurisdictionData, Profile } from "@/lib/schemas";
import { CalculatorInputs, compareJurisdictions, flipPoints, jurisdictionRules, navigate } from "@/lib/engines/jurisdiction-twin";

const priya = Profile.parse(personas.priya);
const jurisdictions = JurisdictionData.array().parse(rawJurisdictions);
// Synthetic prices exercise arithmetic only; they are never added to seed facts.
const priced = JurisdictionData.parse({
  ...jurisdictions[0], licenceAEDPerYear: 100, officeAEDPerYear: 200,
  visaAEDPerPerson: 300, setupOneOffAED: 400,
});

describe("Bawsala deterministic navigation", () => {
  const informedPriya = Profile.parse({ ...priya, customerLocations: ["abroad"], regulatedFinancialActivity: false, raisingForeignInvestment: true, physicalGoods: false });
  const base = { annualProfitAED: 1000000, annualRevenueAED: 2000000, mainlandRevenueSharePct: 0, visas: 2, years: 3 };

  it("keeps only ADGM eligible for regulated financial activities", () => {
    const result = navigate({ ...informedPriya, regulatedFinancialActivity: true }, {}, base);
    expect(result.rankings.filter((entry) => !entry.knockouts.length).map((entry) => entry.jurisdictionId)).toEqual(["adgm"]);
    expect(result.winner?.jurisdictionId).toBe("adgm");
    expect(result.rankings.filter((entry) => entry.jurisdictionId !== "adgm").every((entry) => entry.knockouts[0].includes("R-FIN"))).toBe(true);
  });

  it("flags QFZP and dual licensing for every free-zone route at forty percent mainland revenue", () => {
    const result = navigate(informedPriya, {}, { ...base, mainlandRevenueSharePct: 40 });
    for (const entry of result.rankings.filter((item) => item.jurisdictionId !== "mainland")) {
      expect(entry.warnings).toEqual(expect.arrayContaining(["R-QFZP", "R-DUAL"]));
      expect(entry.taxEstimateAED).toBe(168750);
      expect(entry.unknowns).toContain("Dual-licence fee is an unconfirmed user-supplied estimate");
    }
  });

  it("includes only known costs and counts the dual fee once", () => {
    const result = navigate(informedPriya, {}, { ...base, mainlandRevenueSharePct: 40 });
    const adgm = result.rankings.find((entry) => entry.jurisdictionId === "adgm")!;
    expect(adgm.totalCostAED).toBe(17727);
    expect(adgm.totalAED).toBe(adgm.totalCostAED + adgm.taxEstimateAED);
    expect(adgm.unknowns).toEqual(expect.arrayContaining(["officeAEDPerYear", "setupOneOffAED", "visaAEDPerPerson"]));
    expect(result.rankings.find((entry) => entry.jurisdictionId === "hub71")?.totalCostAED).toBe(1200);
  });

  it("uses the five-percent inclusive boundary then switches to the standard regime", () => {
    const within = navigate(informedPriya, {}, { ...base, mainlandRevenueSharePct: 5 });
    const outside = navigate(informedPriya, {}, { ...base, mainlandRevenueSharePct: 5.01 });
    expect(within.rankings.find((entry) => entry.jurisdictionId === "adgm")?.taxEstimateAED).toBe(0);
    expect(outside.rankings.find((entry) => entry.jurisdictionId === "adgm")?.taxEstimateAED).toBe(168750);
  });

  it("also enforces the monetary cap when five percent would be larger", () => {
    const result = navigate(informedPriya, {}, { ...base, annualRevenueAED: 200000000, mainlandRevenueSharePct: 3 });
    expect(result.rankings.find((entry) => entry.jurisdictionId === "adgm")?.taxEstimateAED).toBe(168750);
  });

  it("does not infer annual revenue from profit or assume the monetary cap passes", () => {
    const result = navigate({ ...informedPriya, revenue12mAED: 0 }, {}, { annualProfitAED: 1000000, mainlandRevenueSharePct: 3 });
    const adgm = result.rankings.find((entry) => entry.jurisdictionId === "adgm")!;
    expect(adgm.taxEstimateAED).toBe(168750);
    expect(adgm.unknowns).toContain("Annual revenue for the QFZP monetary cap; standard tax used conservatively");
  });

  it("flags dual permission for government customers even before a local revenue estimate exists", () => {
    const result = navigate({ ...informedPriya, customerLocations: ["government"] }, {}, base);
    expect(result.rankings.find((entry) => entry.jurisdictionId === "adgm")?.warnings).toContain("R-DUAL");
  });

  it("keeps all scores bounded and does not present unknown cost as free", () => {
    const result = navigate(informedPriya, {}, base);
    expect(result.rankings.every((entry) => entry.fitScore >= 0 && entry.fitScore <= 100)).toBe(true);
    const hub = result.rankings.find((entry) => entry.jurisdictionId === "hub71")!;
    expect(hub.totalCostAED).toBe(0);
    expect(hub.criteria.cost).toBe(50);
    expect(hub.unknowns).toContain("licenceAEDPerYear");
  });

  it("accepts partial weights and treats an all-zero priority set as equal", () => {
    expect(navigate(informedPriya, { weights: { marketAccess: 100 } }, base).winner).not.toBeNull();
    expect(navigate(informedPriya, { weights: { cost: 0, marketAccess: 0, tax: 0, investorAppeal: 0, speed: 0, visas: 0 } }, base)).toEqual(navigate(informedPriya, {}, base));
  });

  it("returns stable, nonempty flip points for Priya without mutating inputs", () => {
    const before = structuredClone(informedPriya);
    const first = flipPoints(informedPriya, {}, base);
    expect(first).toEqual(flipPoints(informedPriya, {}, base));
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((point) => point.input === "mainlandRevenueSharePct")).toBe(true);
    expect(first.every((point) => point.fromJurisdictionId !== point.toJurisdictionId)).toBe(true);
    expect(informedPriya).toEqual(before);
  });

  it("lowers confidence and identifies the four missing interview facts", () => {
    const result = navigate(priya);
    expect(result.confidence).toBe("Low");
    expect(result.missingFacts).toHaveLength(4);
  });

  it("validates calculator boundaries and defaults", () => {
    expect(CalculatorInputs.parse({}).years).toBe(3);
    expect(() => navigate(informedPriya, {}, { mainlandRevenueSharePct: 101 })).toThrow();
    expect(() => navigate(informedPriya, {}, { annualProfitAED: -1 })).toThrow();
    expect(() => navigate(informedPriya, {}, { annualProfitAED: 1e308 })).toThrow();
    expect(() => navigate(informedPriya, {}, { years: 0 })).toThrow();
    expect(() => navigate(informedPriya, {}, { visas: 0.5 })).toThrow();
  });

  it("includes dated provenance for every new classification and rule", () => {
    for (const location of jurisdictions) {
      expect(location.classificationSource.verifiedOn).toBe("2026-10-02");
      expect(location.classificationSource.sourceUrl).toMatch(/^https:\/\//);
      expect(location.isFreeZone).toBe(location.id !== "mainland");
      expect(location.focusTags.length).toBeGreaterThan(0);
    }
    expect(jurisdictionRules.map((rule) => rule.id)).toEqual(["R-DUAL", "R-QFZP", "R-CT", "R-FIN", "R-FIT"]);
    expect(jurisdictionRules.every((rule) => rule.verifiedOn === "2026-10-02" && typeof rule.verify === "boolean")).toBe(true);
  });
});

describe("§8.3 jurisdiction comparison", () => {
  it("totals three annual payments, two visa cycles per person and one setup fee", () => {
    const [result] = compareJurisdictions(priya, [priced]);
    expect(result).toMatchObject({
      jurisdictionId: "adgm", totalAED: 4300, unknowns: [],
      breakdown: { licenceAED: 300, officeAED: 600, visasAED: 3000, setupAED: 400 },
    });
    expect(JurisdictionComparison.parse(result)).toEqual(result);
  });

  it.each([
    [false, [], 0, 600],
    [true, [], 0, 1200],
    [false, [0, 7, 18], 0, 2400],
    [false, [], 4, 3000],
  ])("counts the founder, spouse=%s, children=%j and hires=%i", (spouse, childrenAges, hires12m, visasAED) => {
    const profile = Profile.parse({ ...priya, spouse, childrenAges, hires12m });
    expect(compareJurisdictions(profile, [priced])[0].breakdown.visasAED).toBe(visasAED);
  });

  it("keeps all seeded unknown costs null, excludes them from totals and lists them", () => {
    const results = compareJurisdictions(priya, jurisdictions);
    expect(results.map((result) => result.jurisdictionId)).toEqual(jurisdictions.map((jurisdiction) => jurisdiction.id));
    expect(results.find((result) => result.jurisdictionId === "adgm")).toMatchObject({
      totalAED: 16527, breakdown: { licenceAED: 16527, officeAED: null, visasAED: null, setupAED: null },
      unknowns: ["officeAEDPerYear", "visaAEDPerPerson", "setupOneOffAED"],
    });
    expect(results.find((result) => result.jurisdictionId === "mainland")?.totalAED).toBe(2370);
    expect(results.find((result) => result.jurisdictionId === "hub71")).toMatchObject({
      totalAED: 0, breakdown: { licenceAED: null, officeAED: null, visasAED: null, setupAED: null },
      unknowns: ["licenceAEDPerYear", "officeAEDPerYear", "visaAEDPerPerson", "setupOneOffAED"],
    });
  });

  it("distinguishes a known zero from a missing price", () => {
    expect(compareJurisdictions(priya, [{ ...priced, licenceAEDPerYear: 0, setupOneOffAED: null }])[0]).toMatchObject({
      totalAED: 3600, breakdown: { licenceAED: 0, setupAED: null }, unknowns: ["setupOneOffAED"],
    });
  });

  it("returns exactly the matching seeded fit messages", () => {
    const saas = compareJurisdictions(priya, jurisdictions);
    expect(saas.find((result) => result.jurisdictionId === "adgm")?.fitFlags).toEqual([jurisdictions[0].fitRules[0].message]);
    expect(saas.find((result) => result.jurisdictionId === "kezad")?.fitFlags).toEqual([]);
    expect(saas.find((result) => result.jurisdictionId === "hub71")?.fitFlags).toEqual([jurisdictions[2].fitRules[0].message]);
    expect(saas.find((result) => result.jurisdictionId === "masdar")?.fitFlags).toEqual([jurisdictions[3].fitRules[0].message]);
    const manufacturing = compareJurisdictions({ ...priya, revenueModel: "manufacturing" }, jurisdictions);
    expect(manufacturing.find((result) => result.jurisdictionId === "adgm")?.fitFlags).toEqual([]);
    expect(manufacturing.find((result) => result.jurisdictionId === "kezad")?.fitFlags).toEqual([jurisdictions[4].fitRules[0].message]);
  });

  it("evaluates compound fit rules against derived facts", () => {
    const location = { ...priced, fitRules: [{
      condition: { all: [{ field: "hasFamily", op: "truthy" as const }, { field: "hasHires", op: "truthy" as const }] },
      message: "Family and team",
    }] };
    expect(compareJurisdictions(priya, [location])[0].fitFlags).toEqual(["Family and team"]);
    expect(compareJurisdictions({ ...priya, hires12m: 0 }, [location])[0].fitFlags).toEqual([]);
  });

  it("handles an empty catalogue and leaves profile, prices and fit rules untouched", () => {
    const profileSnapshot = structuredClone(priya);
    const catalogueSnapshot = structuredClone(jurisdictions);
    expect(compareJurisdictions(priya, [])).toEqual([]);
    const first = compareJurisdictions(priya, jurisdictions);
    expect(compareJurisdictions(priya, jurisdictions)).toEqual(first);
    first[0].fitFlags.push("changed");
    first[0].breakdown.licenceAED = 0;
    expect(compareJurisdictions(priya, jurisdictions)[0].breakdown.licenceAED).toBe(16527);
    expect(priya).toEqual(profileSnapshot);
    expect(jurisdictions).toEqual(catalogueSnapshot);
  });
});
