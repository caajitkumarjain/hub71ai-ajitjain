import { Profile, type Jurisdiction } from "@/lib/schemas";
import { compilePath, computeObligations } from "@/lib/engines";
import { activities, rules, steps } from "@/lib/engines/seed-data";
import personas from "@/data/personas.json";

export type SyntheticFounder = { id: string; hasSpouse: boolean; childrenCount: number; jurisdiction: Jurisdiction; readyDays: number; exposureAED: number; unknownPenalties: number; stalls: { stepId: string; days: number }[] };
export const syntheticAssumption = "Synthetic demo assumption: bank and Tawtheeq-related steps have a 30% chance of a 1.5–2.5× duration tail. Other samples use each seed step’s min/likely/max triangular distribution. These are simulated observations, not official processing times.";

export function mulberry32(seed: number) {
  return () => { let value = seed += 0x6D2B79F5; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}

export function triangular(min: number, likely: number, max: number, sample: number): number {
  if (min === max) return min;
  const fraction = (likely - min) / (max - min);
  return sample < fraction ? min + Math.sqrt(sample * (max - min) * (likely - min)) : max - Math.sqrt((1 - sample) * (max - min) * (max - likely));
}

export function generateSyntheticCohort(count = 240, seed = 71): SyntheticFounder[] {
  const random = mulberry32(seed);
  const archetypes = Object.values(personas);
  const locations: Jurisdiction[] = ["adgm", "mainland", "hub71", "masdar", "kezad", "twofour54"];
  const nationalities = ["India", "Egypt", "Germany", "United Kingdom", "United States"];
  const models = ["saas", "services", "trading", "manufacturing", "fnb"] as const;
  const today = new Date("2026-10-02T00:00:00Z");
  return Array.from({ length: count }, (_, index) => {
    const base = archetypes[Math.floor(random() * archetypes.length)];
    const jurisdiction = locations[Math.floor(random() * locations.length)];
    const revenueModel = models[Math.floor(random() * models.length)];
    const profile = Profile.parse({ ...base, id: `synthetic-${index + 1}`, nationality: nationalities[Math.floor(random() * nationalities.length)], jurisdiction, revenueModel, activityCode: activities.find((activity) => activity.revenueModels.includes(revenueModel))?.id, spouse: random() > 0.55, childrenAges: random() > 0.65 ? [Math.floor(random() * 17) + 1] : [] });
    const path = compilePath(profile, steps);
    const obligations = computeObligations(profile, rules, today);
    const watched = obligations.filter((item) => item.dueDate && item.dueDate >= "2026-10-02" && item.dueDate <= "2027-10-02");
    return {
      id: profile.id, hasSpouse: profile.spouse, childrenCount: profile.childrenAges.length, jurisdiction,
      readyDays: path.optimizedDays,
      exposureAED: watched.reduce((total, item) => total + (item.penaltyAED ?? 0), 0), unknownPenalties: watched.filter((item) => item.penaltyAED === null).length,
      stalls: path.nodes.map((step) => {
        let days = triangular(step.durationDays.min, step.durationDays.likely, step.durationDays.max, random());
        if (/bank|tawtheeq/i.test(`${step.id} ${step.title}`) && random() < 0.3) days *= 1.5 + random();
        return { stepId: step.id, days: Math.round(days * 10) / 10 };
      }),
    };
  });
}

let cached: SyntheticFounder[] | undefined;
export function syntheticCohort(): SyntheticFounder[] { return cached ??= generateSyntheticCohort(); }
