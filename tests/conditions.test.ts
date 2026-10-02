import { describe, expect, it } from "vitest";
import { Profile, type Condition } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { deriveFacts, evaluate } from "@/lib/engines/conditions";
import { activities } from "@/lib/engines/seed-data";

const priya = Profile.parse(personas.priya);
describe("§8.1 derived facts and condition DSL", () => {
  it("derives family, hires, activity and jurisdiction facts without assigning an undecided jurisdiction", () => {
    expect(deriveFacts(priya, activities)).toMatchObject({ hasFamily: true, hasChildren: true, hasHires: true, isDnfbpActivity: false, canConvertLicence: false, isADGM: false, isMainland: false, isFreeZoneOther: false });
    expect(deriveFacts(Profile.parse(personas.lena), activities)).toMatchObject({ hasFamily: false, hasChildren: false, canConvertLicence: true, isFreeZoneOther: true });
    expect(deriveFacts({ ...priya, jurisdiction: "hub71", activityCode: "real-estate-brokerage" }, activities)).toMatchObject({ isADGM: true, isDnfbpActivity: true });
  });
  it.each([
    [187500, false, false, false], [187501, true, false, false], [375000, true, false, false],
    [375001, true, true, false], [49999999, true, true, false], [50000000, true, true, true],
  ])("respects exact revenue boundaries at %s", (revenue, voluntary, mandatory, phase1) => {
    expect(deriveFacts({ ...priya, revenue12mAED: revenue }, activities)).toMatchObject({ revenueOverVATVoluntary: voluntary, revenueOverVAT: mandatory, einvPhase1: phase1 });
  });
  const facts = { amount: 10, kind: "saas", active: true, zero: 0, nil: null, nested: { count: 2 } };
  it.each<[Condition, boolean]>([
    [{ field: "kind", op: "eq", value: "saas" }, true], [{ field: "kind", op: "neq", value: "saas" }, false],
    [{ field: "kind", op: "in", value: ["services", "saas"] }, true],
    [{ field: "amount", op: "gt", value: 10 }, false], [{ field: "amount", op: "gte", value: 10 }, true],
    [{ field: "amount", op: "lt", value: 10 }, false], [{ field: "amount", op: "lte", value: 10 }, true],
    [{ field: "zero", op: "exists" }, true], [{ field: "nil", op: "exists" }, false],
    [{ field: "missing", op: "exists" }, false], [{ field: "active", op: "truthy" }, true],
    [{ field: "zero", op: "truthy" }, false], [{ field: "nested.count", op: "eq", value: 2 }, true],
    [{ all: [] }, true], [{ any: [] }, false],
    [{ all: [{ field: "active", op: "truthy" }, { not: { field: "kind", op: "eq", value: "trading" } }], any: [{ field: "zero", op: "truthy" }, { field: "amount", op: "gte", value: 10 }] }, true],
  ])("evaluates %j", (condition, expected) => expect(evaluate(condition, facts)).toBe(expected));
  it("handles bare identifiers and absent conditions; rejects expression strings and malformed operations", () => {
    expect(evaluate(undefined, facts)).toBe(true);
    expect(evaluate("active", facts)).toBe(true);
    expect(evaluate("missing", facts)).toBe(false);
    expect(() => evaluate("active and not missing", facts)).toThrow(/bare identifiers/);
    expect(() => evaluate({ field: "kind", op: "in", value: "saas" }, facts)).toThrow(/array/);
    expect(() => evaluate({ field: "amount", op: "gt", value: "1" }, facts)).toThrow(/finite number/);
    expect(evaluate({ field: "kind", op: "gt", value: 1 }, facts)).toBe(false);
    expect(() => evaluate({ field: "kind" }, facts)).toThrow(/both/);
    expect(() => evaluate({}, facts)).toThrow(/Empty/);
  });
});
