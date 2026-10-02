import type { Activity, Condition, Profile } from "@/lib/schemas";
import { licenceExchange, rules } from "./seed-data";

export type DerivedFacts = Profile & {
  hasFamily: boolean; hasChildren: boolean; isDnfbpActivity: boolean; hasHires: boolean;
  canConvertLicence: boolean; isADGM: boolean; isMainland: boolean; isFreeZoneOther: boolean;
  revenueOverVAT: boolean; revenueOverVATVoluntary: boolean; einvPhase1: boolean;
};

export function deriveFacts(profile: Profile, activities: readonly Activity[]): DerivedFacts {
  function thresholdFor(id: string): number {
    const threshold = rules.find((rule) => rule.id === id)?.trigger.threshold;
    if (threshold === undefined) throw new Error(`Missing seeded threshold for ${id}`);
    return threshold;
  }
  return {
    ...profile,
    hasFamily: profile.spouse || profile.childrenAges.length > 0,
    hasChildren: profile.childrenAges.length > 0,
    isDnfbpActivity: activities.find((activity) => activity.id === profile.activityCode)?.dnfbp === true,
    hasHires: profile.hires12m > 0,
    canConvertLicence: profile.drivingLicenceCountry !== undefined && licenceExchange.countries.includes(profile.drivingLicenceCountry),
    isADGM: profile.jurisdiction === "adgm" || profile.jurisdiction === "hub71",
    isMainland: profile.jurisdiction === "mainland",
    isFreeZoneOther: profile.jurisdiction === "masdar" || profile.jurisdiction === "kezad" || profile.jurisdiction === "twofour54",
    revenueOverVAT: profile.revenue12mAED > thresholdFor("VAT-REG"),
    revenueOverVATVoluntary: profile.revenue12mAED > thresholdFor("VAT-VOL"),
    einvPhase1: profile.revenue12mAED >= thresholdFor("EINV-P1-ASP"),
  };
}

/** Resolve only own properties. The DSL cannot access prototypes or execute expressions. */
function fieldValue(facts: object, field: string): unknown {
  let current: unknown = facts;
  for (const key of field.split(".")) {
    if (["__proto__", "prototype", "constructor"].includes(key) || current === null || typeof current !== "object" || !Object.hasOwn(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function evaluate(cond: Condition | string | undefined, facts: object): boolean {
  if (cond === undefined) return true;
  if (typeof cond === "string") {
    if (!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(cond)) throw new Error("Condition strings must be bare identifiers; use all/any/not for compound conditions.");
    return evaluate({ field: cond, op: "truthy" }, facts);
  }
  const results: boolean[] = [];
  if (cond.all !== undefined) results.push(cond.all.every((child) => evaluate(child, facts)));
  if (cond.any !== undefined) results.push(cond.any.some((child) => evaluate(child, facts)));
  if (cond.not !== undefined) results.push(!evaluate(cond.not, facts));
  if (cond.field !== undefined || cond.op !== undefined) {
    if (!cond.field || !cond.op) throw new Error("A field condition requires both field and op.");
    const actual = fieldValue(facts, cond.field);
    const expected = cond.value;
    switch (cond.op) {
      case "exists": results.push(actual !== undefined && actual !== null); break;
      case "truthy": results.push(Boolean(actual)); break;
      case "eq": results.push(Object.is(actual, expected)); break;
      case "neq": results.push(!Object.is(actual, expected)); break;
      case "in":
        if (!Array.isArray(expected)) throw new Error("The in operator requires an array value.");
        results.push(expected.some((value) => Object.is(actual, value)));
        break;
      case "gt": case "gte": case "lt": case "lte": {
        if (typeof expected !== "number" || !Number.isFinite(expected)) throw new Error("Numeric comparisons require a finite number value.");
        if (typeof actual !== "number" || !Number.isFinite(actual)) { results.push(false); break; }
        results.push(cond.op === "gt" ? actual > expected : cond.op === "gte" ? actual >= expected : cond.op === "lt" ? actual < expected : actual <= expected);
        break;
      }
      default: throw new Error(`Unsupported condition operator: ${String(cond.op)}`);
    }
  }
  if (!results.length) throw new Error("Empty condition; use {all: []} for an unconditional rule.");
  return results.every(Boolean);
}
