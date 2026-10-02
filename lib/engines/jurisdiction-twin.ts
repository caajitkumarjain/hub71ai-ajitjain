import { JurisdictionComparison, JurisdictionData, Profile } from "@/lib/schemas";
import { deriveFacts, evaluate } from "@/lib/engines/conditions";
import { activities } from "@/lib/engines/seed-data";
import { z } from "zod";
import rawJurisdictions from "@/data/jurisdictions.json";
import rawJurisdictionRules from "@/data/jurisdiction-rules.json";

const priorityNames = ["cost", "marketAccess", "tax", "investorAppeal", "speed", "visas"] as const;
type Priority = typeof priorityNames[number];
const weight = z.number().finite().min(0).max(100).optional();
// Bound scenario arithmetic, rather than accepting finite inputs whose multi-year products overflow.
const scenarioMoney = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER / 100);
export const NavigationPreferences = z.object({
  weights: z.object({ cost: weight, marketAccess: weight, tax: weight, investorAppeal: weight, speed: weight, visas: weight }).strict().optional(),
}).strict();
export type NavigationPreferences = z.infer<typeof NavigationPreferences>;
export const CalculatorInputs = z.object({
  annualProfitAED: scenarioMoney.default(0),
  annualRevenueAED: scenarioMoney.optional(),
  mainlandRevenueSharePct: z.number().finite().min(0).max(100).default(0),
  visas: z.number().int().min(0).max(10000).default(1),
  years: z.number().int().min(1).max(50).default(3),
}).strict();
export type CalculatorInputs = z.infer<typeof CalculatorInputs>;
export type CalculatorInput = z.input<typeof CalculatorInputs>;
const JurisdictionRule = z.object({
  id: z.string(), title: z.string(), summary: z.string(), sourceUrl: z.url(),
  verifiedOn: z.iso.date(), verify: z.boolean(), values: z.record(z.string(), z.union([z.string(), z.number()])),
  verificationNote: z.string().optional(), corroboratingSourceUrl: z.url().optional(),
});
export const jurisdictionRules = JurisdictionRule.array().parse(rawJurisdictionRules);
const locations = JurisdictionData.array().parse(rawJurisdictions);
const ruleNumber = (id: string, key: string): number => z.number().nonnegative().parse(jurisdictionRules.find((rule) => rule.id === id)?.values[key]);
const taxThreshold = ruleNumber("R-CT", "zeroRateThresholdAED");
const taxRate = ruleNumber("R-CT", "standardRatePct") / 100;
const deMinimisPct = ruleNumber("R-QFZP", "nonQualifyingLimitPct");
const deMinimisAED = ruleNumber("R-QFZP", "nonQualifyingLimitAED");
const dualLicenceAED = ruleNumber("R-DUAL", "licenceAED");
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type NavigationEntry = {
  jurisdictionId: JurisdictionData["id"]; name: string; fitScore: number;
  knockouts: string[]; warnings: string[]; totalCostAED: number; taxEstimateAED: number; totalAED: number;
  unknowns: string[]; reasons: string[]; evidence: string[];
  criteria: Record<Priority, number>; knownCostCoverage: number;
};
export type NavigationResult = {
  rankings: NavigationEntry[]; winner: NavigationEntry | null; runnerUp: NavigationEntry | null;
  confidence: "High" | "Medium" | "Low"; estimateLabel: string; missingFacts: string[];
};

function missingFacts(profile: Profile): string[] {
  const missing: string[] = [];
  if (!profile.customerLocations?.length) missing.push("customerLocations");
  if (profile.regulatedFinancialActivity === undefined) missing.push("regulatedFinancialActivity");
  if (profile.raisingForeignInvestment === undefined) missing.push("raisingForeignInvestment");
  if (profile.physicalGoods === undefined) missing.push("physicalGoods");
  return missing;
}

function businessTags(profile: Profile): string[] {
  const tags: string[] = [];
  if (profile.revenueModel === "saas" || profile.revenueModel === "marketplace") tags.push("tech", "tech startups");
  if (profile.revenueModel === "trading") tags.push("trading", "logistics", "retail");
  if (profile.revenueModel === "manufacturing") tags.push("industrial");
  if (profile.revenueModel === "fnb") tags.push("f&b", "retail");
  if (profile.regulatedFinancialActivity) tags.push("finance");
  if (profile.physicalGoods) tags.push("industrial", "logistics", "trading");
  const description = profile.businessDescription.toLowerCase();
  for (const tag of ["finance", "holding", "sustainability", "media", "gaming", "retail", "government"]) {
    if (description.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Pure scenario calculator. All money thresholds come from the sourced rules; scores are planning heuristics. */
export function navigate(profile: Profile, prefs: NavigationPreferences = {}, calcInputs: CalculatorInput = {}): NavigationResult {
  const founder = Profile.parse(profile);
  const preferences = NavigationPreferences.parse(prefs);
  const inputs = CalculatorInputs.parse(calcInputs);
  const missing = missingFacts(founder);
  const revenue = inputs.annualRevenueAED ?? (founder.revenue12mAED > 0 ? founder.revenue12mAED : undefined);
  const localShare = inputs.mainlandRevenueSharePct / 100;
  const localCustomers = localShare > 0 || founder.customerLocations?.some((value) => value === "mainland" || value === "government") === true;
  const tags = businessTags(founder);
  const weights = Object.fromEntries(priorityNames.map((name) => [name, preferences.weights?.[name] ?? 1])) as Record<Priority, number>;
  if (priorityNames.every((name) => weights[name] === 0)) priorityNames.forEach((name) => { weights[name] = 1; });
  const totalWeight = priorityNames.reduce((sum, name) => sum + weights[name], 0);
  const standardTax = Math.max(0, inputs.annualProfitAED - taxThreshold) * taxRate;

  const rankings: NavigationEntry[] = locations.map((location) => {
    const unknowns: string[] = [];
    const warnings: string[] = [];
    const knockouts: string[] = [];
    if (founder.regulatedFinancialActivity && location.id !== "adgm") knockouts.push("R-FIN: Regulated financial services require ADGM / FSRA within these candidate routes.");
    const costs = [
      { key: "licenceAEDPerYear", value: location.licenceAEDPerYear, multiplier: inputs.years },
      { key: "officeAEDPerYear", value: location.officeAEDPerYear, multiplier: inputs.years },
      { key: "setupOneOffAED", value: location.setupOneOffAED, multiplier: 1 },
      { key: "visaAEDPerPerson", value: location.visaAEDPerPerson, multiplier: inputs.visas },
    ];
    let totalCostAED = 0;
    for (const cost of costs) {
      if (cost.multiplier === 0) continue;
      if (cost.value === null) unknowns.push(cost.key);
      else totalCostAED += cost.value * cost.multiplier;
    }
    const knownCostCoverage = costs.filter((cost) => cost.value !== null || cost.multiplier === 0).length / costs.length;
    if (inputs.visas > 0 && inputs.years > 1) unknowns.push("Visa renewals and renewal schedule");
    unknowns.push("Setup duration", "Visa eligibility and capacity");
    let annualTax = standardTax;
    if (location.isFreeZone) {
      warnings.push("R-QFZP");
      unknowns.push("Qualifying income, substance and other QFZP conditions");
      const limit = revenue && revenue > 0 ? Math.min(deMinimisPct, deMinimisAED / revenue * 100) : undefined;
      // Missing turnover must never turn the monetary de-minimis test into an assumed pass.
      const withinLimit = localShare === 0 || (limit !== undefined && inputs.mainlandRevenueSharePct <= limit);
      if (withinLimit) annualTax = Math.max(0, inputs.annualProfitAED * localShare - taxThreshold) * taxRate;
      else if (limit === undefined && inputs.mainlandRevenueSharePct <= deMinimisPct) unknowns.push("Annual revenue for the QFZP monetary cap; standard tax used conservatively");
      if (localCustomers) {
        warnings.push("R-DUAL");
        unknowns.push("Dual-licence eligibility and renewal cost");
        if (localShare > 0) {
          totalCostAED += dualLicenceAED;
          unknowns.push("Dual-licence fee is an unconfirmed user-supplied estimate");
        }
      }
    }
    const matched = location.focusTags.filter((tag) => tags.includes(tag.toLowerCase()));
    const focusScore = matched.length ? 100 : location.focusTags.includes("all") ? 60 : 40;
    const marketAccess = location.isFreeZone
      ? focusScore * (1 - localShare) + 30 * localShare
      : focusScore * (1 - localShare) + 100 * localShare;
    // No speed or visa capacity source exists: a neutral score and explicit unknown, never a fabricated duration.
    const investorAppeal = founder.raisingForeignInvestment === undefined ? 50
      : !founder.raisingForeignInvestment ? 50
      : location.id === "adgm" ? 100 : location.focusTags.some((tag) => tag.includes("tech")) ? 75 : 50;
    const reasons = [
      matched.length ? `Focus matches ${matched.join(", ")}.` : location.focusTags.includes("all") ? "Broad mainland activity coverage; check the exact activity." : "Confirm that the jurisdiction supports your exact activity.",
      location.isFreeZone && localCustomers ? "Mainland access needs an eligibility and operating-permission check." : location.isFreeZone ? "Free-zone route fits the current customer scenario." : "Mainland route supports the local-market scenario.",
      location.isFreeZone ? "Qualifying-income tax scenario is conditional; verify substance and income classification." : "Standard corporate-tax regime is included in the estimate.",
    ];
    return {
      jurisdictionId: location.id, name: location.name, fitScore: 0, knockouts, warnings,
      totalCostAED: round(totalCostAED), taxEstimateAED: round(annualTax * inputs.years), totalAED: round(totalCostAED + annualTax * inputs.years),
      unknowns, reasons, evidence: [...new Set([location.id, "R-FIT", "R-CT", ...(founder.regulatedFinancialActivity ? ["R-FIN"] : []), ...warnings])],
      criteria: { cost: 50, marketAccess, tax: 50, investorAppeal, speed: 50, visas: 50 }, knownCostCoverage,
    };
  });
  const knownCosts = rankings.filter((entry) => entry.knownCostCoverage > 0 && entry.totalCostAED > 0).map((entry) => entry.totalCostAED);
  const cheapestKnown = knownCosts.length ? Math.min(...knownCosts) : 0;
  const highestTax = Math.max(...rankings.map((entry) => entry.taxEstimateAED));
  for (const entry of rankings) {
    // Incomplete costs are pulled toward neutral, so an entirely missing quote never scores as free.
    const relativeCost = entry.totalCostAED > 0 ? 100 * cheapestKnown / entry.totalCostAED : 50;
    entry.criteria.cost = Math.min(100, relativeCost) * entry.knownCostCoverage + 50 * (1 - entry.knownCostCoverage);
    entry.criteria.tax = highestTax === 0 ? 50 : 100 * (highestTax - entry.taxEstimateAED) / highestTax;
    for (const name of priorityNames) entry.criteria[name] = round(entry.criteria[name]);
    entry.fitScore = round(priorityNames.reduce((sum, name) => sum + entry.criteria[name] * weights[name], 0) / totalWeight);
  }
  rankings.sort((a, b) => Number(a.knockouts.length > 0) - Number(b.knockouts.length > 0) || b.fitScore - a.fitScore || a.jurisdictionId.localeCompare(b.jurisdictionId));
  const eligible = rankings.filter((entry) => !entry.knockouts.length);
  const winner = eligible[0] ?? null;
  const runnerUp = eligible[1] ?? null;
  const margin = winner ? winner.fitScore - (runnerUp?.fitScore ?? 0) : 0;
  const unknownShare = winner ? (missing.length + (1 - winner.knownCostCoverage) * 4 + 2) / 10 : 1;
  const confidence = missing.length || unknownShare > 0.5 || margin < 5 ? "Low" : margin >= 15 && unknownShare <= 0.25 ? "High" : "Medium";
  return { rankings, winner, runnerUp, confidence, missingFacts: missing, estimateLabel: "Estimate, verify with ADDED / FSRA / FTA. Unknown costs are excluded; the QFZP calculation is a simplified scenario, not a tax determination." };
}

export type FlipPoint = { input: "mainlandRevenueSharePct" | "annualProfitAED"; value: number; fromJurisdictionId: string; toJurisdictionId: string; explanation: string };
/** One-variable sensitivity scan. Profit scan resolution is disclosed in its explanation. */
export function flipPoints(profile: Profile, prefs: NavigationPreferences = {}, calcInputs: CalculatorInput = {}): FlipPoint[] {
  const inputs = CalculatorInputs.parse(calcInputs);
  const points: FlipPoint[] = [];
  const profitMax = Math.min(Number.MAX_SAFE_INTEGER / 100, Math.max(taxThreshold * 20, inputs.annualProfitAED * 2));
  const scans = [
    { input: "mainlandRevenueSharePct" as const, step: 1 },
    { input: "annualProfitAED" as const, step: profitMax / 100 },
  ];
  for (const scan of scans) {
    let previous = navigate(profile, prefs, { ...inputs, [scan.input]: 0 }).winner;
    for (let i = 1; i <= 100; i += 1) {
      const value = round(scan.step * i);
      const current = navigate(profile, prefs, { ...inputs, [scan.input]: value }).winner;
      if (previous && current && previous.jurisdictionId !== current.jurisdictionId) {
        points.push({ input: scan.input, value, fromJurisdictionId: previous.jurisdictionId, toJurisdictionId: current.jurisdictionId,
          explanation: scan.input === "mainlandRevenueSharePct"
            ? `At ${value}% mainland sales, ${current.name} becomes the top-ranked route in this scenario (one-percentage-point scan).`
            : `At AED ${value.toLocaleString("en-US")} annual profit, ${current.name} becomes the top-ranked route in this scenario (AED ${scan.step.toLocaleString("en-US")} scan increments).`,
        });
      }
      previous = current;
    }
  }
  return points;
}

export function compareJurisdictions(profile: Profile, jurisdictions: readonly JurisdictionData[]): JurisdictionComparison[] {
  const founder = Profile.parse(profile);
  const locations = JurisdictionData.array().parse(jurisdictions);
  const facts = deriveFacts(founder, activities);
  const people = 1 + Number(founder.spouse) + founder.childrenAges.length + founder.hires12m;

  return locations.map((jurisdiction) => {
    const costs = [
      { source: "licenceAEDPerYear", target: "licenceAED", value: jurisdiction.licenceAEDPerYear, multiplier: 3 },
      { source: "officeAEDPerYear", target: "officeAED", value: jurisdiction.officeAEDPerYear, multiplier: 3 },
      { source: "visaAEDPerPerson", target: "visasAED", value: jurisdiction.visaAEDPerPerson, multiplier: people * 2 },
      { source: "setupOneOffAED", target: "setupAED", value: jurisdiction.setupOneOffAED, multiplier: 1 },
    ] as const;
    const breakdown: JurisdictionComparison["breakdown"] = {
      licenceAED: null, officeAED: null, visasAED: null, setupAED: null,
    };
    const unknowns: string[] = [];
    let totalAED = 0;
    for (const cost of costs) {
      if (cost.value === null) {
        unknowns.push(cost.source);
      } else {
        const amount = cost.value * cost.multiplier;
        breakdown[cost.target] = amount;
        totalAED += amount;
      }
    }

    return JurisdictionComparison.parse({
      jurisdictionId: jurisdiction.id, totalAED, breakdown, unknowns,
      fitFlags: jurisdiction.fitRules.filter((rule) => evaluate(rule.condition, facts)).map((rule) => rule.message),
    });
  });
}
