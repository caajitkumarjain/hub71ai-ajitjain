import type { Profile } from "@/lib/schemas";
import { compilePath, compareJurisdictions, computeObligations, scoreBankability } from "@/lib/engines";
import { activities, jurisdictions, rules, steps } from "@/lib/engines/seed-data";

/** Recompute on the server. HTTP clients cannot supply their own 'verified' tool values. */
export function exportContext(profile: Profile, now: Date) {
  const path = compilePath(profile, steps);
  const obligations = computeObligations(profile, rules, now);
  return { path, obligations, toolOutputs: [path, obligations, { rules },
    compareJurisdictions(profile, jurisdictions), scoreBankability(profile, activities)] };
}
