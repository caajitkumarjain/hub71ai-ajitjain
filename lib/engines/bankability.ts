import { Activity, BankabilityResult, Profile, type Finding } from "@/lib/schemas";

// §10's customer-geography terms. Uppercase US avoids treating the pronoun "us"
// as a location. These terms describe customers; they are not a risk-country list.
const customerGeography = /\b(?:UAE|KSA|GCC|Saudi|Emirates|India|Europe|United States)\b/i;
const usGeography = /\bUS\b|\bU\.S\.(?:A\.)?/;
// §8.5 requires a lexical review flag, not a sanctions determination.
const sensitiveTradeTerms = /\b(?:sanctions?|sanctioned|embargo(?:ed|es)?|dual[ -]use|weapons?|arms trade|military goods)\b/i;

export function scoreBankability(profile: Profile, activities: readonly Activity[]): BankabilityResult {
  const founder = Profile.parse(profile);
  const catalogue = Activity.array().parse(activities);
  const findings: Finding[] = [];
  const documentTypes = new Set(founder.documents.map((document) => document.docType));
  const activity = catalogue.find((candidate) => candidate.id === founder.activityCode);

  if (!activity?.revenueModels.includes(founder.revenueModel)) {
    const suggested = catalogue.find((candidate) => candidate.revenueModels.includes(founder.revenueModel));
    findings.push({
      checkId: "BK-01", severity: "high", title: "Activity and revenue model do not match",
      whyBankCares: activity
        ? "The chosen activity does not cover the stated revenue model in the activity catalogue."
        : "The chosen activity is missing or unknown, so its fit with the revenue model cannot be verified.",
      fix: suggested
        ? `Review ${suggested.id} with the licensing authority. Official activity codes vary by authority; verify before applying.`
        : "UNKNOWN · verify the appropriate activity with the licensing authority.",
      ...(suggested ? { fixAction: { field: "activityCode" as const, value: suggested.id, label: "Use matching activity" } } : {}),
      pointsLost: 30,
    });
  }

  const hasEmiratesId = founder.stepStatus["R-EID"] === "done"
    || documentTypes.has("emirates_id") || documentTypes.has("eid");
  if (!hasEmiratesId) findings.push({
    checkId: "BK-02", severity: "medium", title: "Emirates ID is not ready",
    whyBankCares: "Many banks require Emirates ID for signatories.",
    fix: "Complete the founder's residency and Emirates ID steps, then confirm the bank's requirements.",
    pointsLost: 10,
  });

  const missingDocuments = [
    { label: "passport", present: documentTypes.has("passport") },
    { label: "proof of address", present: documentTypes.has("proof_of_address") },
    { label: "CV/profile", present: documentTypes.has("cv") || documentTypes.has("profile") },
    { label: "source-of-funds statement", present: documentTypes.has("source_of_funds") },
  ].filter((document) => !document.present).map((document) => document.label);
  if (missingDocuments.length) findings.push({
    checkId: "BK-03", severity: "medium", title: "UBO document pack is incomplete",
    whyBankCares: `Missing: ${missingDocuments.join(", ")}. The bank needs a documented owner profile.`,
    fix: `Prepare ${missingDocuments.join(", ")} for the UBO pack.`,
    pointsLost: Math.min(missingDocuments.length * 5, 15),
  });

  if (founder.stepStatus["C-OFFICE"] !== "done") findings.push({
    checkId: "BK-04", severity: "low", title: "Office or flexi-desk lease is not ready",
    whyBankCares: "A completed office or flexi-desk lease helps evidence business substance.",
    fix: "Complete the office or flexi-desk lease step and prepare the lease evidence.",
    pointsLost: 8,
  });

  const description = founder.businessDescription.trim();
  if (description.length < 80 || !(customerGeography.test(description) || usGeography.test(description))) findings.push({
    checkId: "BK-05", severity: "medium", title: "Transaction profile needs more detail",
    whyBankCares: "The bank needs a clear transaction profile that describes the business and customer geography.",
    fix: "Write my transaction profile",
    pointsLost: 10,
  });

  if (founder.fundingUSD > 0 && !documentTypes.has("source_of_funds")) findings.push({
    checkId: "BK-06", severity: "medium", title: "Funding source evidence is missing",
    whyBankCares: "Declared funding needs a source-of-funds statement.",
    fix: "Prepare the source-of-funds statement and supporting evidence for the declared funding.",
    pointsLost: 10,
  });

  if (sensitiveTradeTerms.test(description)) findings.push({
    checkId: "BK-07", severity: "high", title: "Escalate to manual review",
    whyBankCares: "The description contains sanctions-sensitive trade terms that need a human review; this check is not a sanctions determination.",
    fix: "Escalate to manual review with the bank's compliance team before applying.",
    pointsLost: 20,
  });

  const score = Math.max(0, 100 - findings.reduce((total, finding) => total + finding.pointsLost, 0));
  return BankabilityResult.parse({
    score, band: score >= 80 ? "Ready" : score >= 60 ? "Fixable" : "High risk", findings,
  });
}
