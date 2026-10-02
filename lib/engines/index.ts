import type { Activity, BankabilityResult, Condition, JurisdictionComparison, JurisdictionData, Obligation, PathResult, Profile, Rule, Step, WhatIfResult } from "@/lib/schemas";

export type DerivedFacts = Profile & {
  hasFamily: boolean; hasChildren: boolean; isDnfbpActivity: boolean; hasHires: boolean;
  canConvertLicence: boolean; isADGM: boolean; isMainland: boolean; isFreeZoneOther: boolean;
  revenueOverVAT: boolean; revenueOverVATVoluntary: boolean; einvPhase1: boolean;
};

export function deriveFacts(profile: Profile, activities: readonly Activity[]): DerivedFacts {
  // TODO (§8.1): derive condition fields using the seed tables.
  void profile; void activities;
  throw new Error("TODO: deriveFacts (§8.1)");
}
export function evaluate(cond: Condition | string | undefined, facts: DerivedFacts): boolean {
  // TODO (§8.1): evaluate the predicate DSL and bare-identifier shorthand.
  void cond; void facts;
  throw new Error("TODO: evaluate (§8.1)");
}
export function compilePath(profile: Profile, steps: readonly Step[]): PathResult {
  // TODO (§8.2): filter, relink, sort and compute the critical path.
  void profile; void steps;
  throw new Error("TODO: compilePath (§8.2)");
}
export function compareJurisdictions(profile: Profile, jurisdictions: readonly JurisdictionData[]): JurisdictionComparison[] {
  // TODO (§8.3): compute three-year totals, unknowns and fit flags.
  void profile; void jurisdictions;
  throw new Error("TODO: compareJurisdictions (§8.3)");
}
export function computeObligations(profile: Profile, rules: readonly Rule[], today: Date = new Date()): Obligation[] {
  // TODO (§8.4): compute dates and sourced exposure; label projected dates.
  void profile; void rules; void today;
  throw new Error("TODO: computeObligations (§8.4)");
}
export function whatIf(profile: Profile, patch: Partial<Profile>): WhatIfResult {
  // TODO (§8.4): recompute obligations with the patch and return the diff.
  void profile; void patch;
  throw new Error("TODO: whatIf (§8.4)");
}
export function scoreBankability(profile: Profile, activities: readonly Activity[]): BankabilityResult {
  // TODO (§8.5): apply BK-01 through BK-07 and return score, band and findings.
  void profile; void activities;
  throw new Error("TODO: scoreBankability (§8.5)");
}
