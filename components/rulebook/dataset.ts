import { activities, jurisdictions, licenceExchange, rules, steps } from "@/lib/engines/seed-data";
import { Lane, type Rule } from "@/lib/schemas";

export const laneLabels: Record<Lane, string> = {
  arrive: "Arrive", residency: "Residency", company: "Company", home: "Home", family: "Family", operate: "Operate",
};

export type RulebookRow = {
  id: string; kind: "Step" | "Rule"; title: string; authority: string; lanes: Lane[];
  description: string; sourceUrl: string | null; verifiedOn: string | null;
  confidence: Rule["confidence"]; verify: boolean; dependsOn: string[]; ruleIds: string[];
};

export function rulebookRows(): RulebookRow[] {
  return [
    ...steps.map((step): RulebookRow => ({ id: step.id, kind: "Step", title: step.title, authority: step.authority,
      lanes: [step.lane], description: step.description, sourceUrl: step.sourceUrl ?? null,
      verifiedOn: step.verifiedOn ?? null, confidence: step.confidence, verify: step.verify,
      dependsOn: [...step.dependsOn], ruleIds: [...step.ruleIds] })),
    ...rules.map((rule): RulebookRow => ({ id: rule.id, kind: "Rule", title: rule.title, authority: rule.authority,
      lanes: Lane.options.filter((lane) => steps.some((step) => step.lane === lane && step.ruleIds.includes(rule.id))),
      description: rule.summary, sourceUrl: rule.sourceUrl, verifiedOn: rule.verifiedOn,
      confidence: rule.confidence, verify: rule.verify, dependsOn: [], ruleIds: [] })),
  ];
}

export function rulebookCoverage() {
  const authorities = [...new Set([...steps, ...rules].map((entry) => entry.authority))].sort((a, b) => a.localeCompare(b));
  return authorities.map((authority) => ({ authority, cells: Lane.options.map((lane) => ({
    lane, count: steps.filter((step) => step.authority === authority && step.lane === lane).length,
  })) }));
}

export function rulebookDataset() {
  return {
    format: "manzil-rulebook-v1",
    notice: "Seeded research, not a complete register or independent verification. Confirm current requirements with the named authority. Unknown values remain null; timing and cost ranges are estimates.",
    steps, rules, jurisdictions, activities, licenceExchange,
  };
}

export const rulebookCounts = {
  steps: steps.length, rules: rules.length, jurisdictions: jurisdictions.length, activities: activities.length,
  lanes: Lane.options.length, dependencies: steps.reduce((total, step) => total + step.dependsOn.length, 0),
};
