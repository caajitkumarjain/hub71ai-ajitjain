import { JurisdictionComparison, JurisdictionData, Profile } from "@/lib/schemas";
import { deriveFacts, evaluate } from "@/lib/engines/conditions";
import { activities } from "@/lib/engines/seed-data";

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
