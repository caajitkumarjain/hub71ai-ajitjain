import { describe, expect, it } from "vitest";
import personas from "@/data/personas.json";
import rawJurisdictions from "@/data/jurisdictions.json";
import { JurisdictionComparison, JurisdictionData, Profile } from "@/lib/schemas";
import { compareJurisdictions } from "@/lib/engines/jurisdiction-twin";

const priya = Profile.parse(personas.priya);
const jurisdictions = JurisdictionData.array().parse(rawJurisdictions);
// Synthetic prices exercise arithmetic only; they are never added to seed facts.
const priced = JurisdictionData.parse({
  ...jurisdictions[0], licenceAEDPerYear: 100, officeAEDPerYear: 200,
  visaAEDPerPerson: 300, setupOneOffAED: 400,
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
