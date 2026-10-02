import { BankabilityResult, Finding, Profile } from "@/lib/schemas";
import { postProfile } from "@/components/path/journey-client";

export async function applyBankFix(profile: Profile, finding: Finding, signal?: AbortSignal) {
  const action = Finding.parse(finding).fixAction;
  if (!action) throw new Error("This check needs supporting evidence, not an automatic profile change.");
  const updated = Profile.parse({ ...profile, [action.field]: action.value });
  const result = await postProfile("bankability", updated, BankabilityResult, signal);
  return { profile: updated, result };
}

export function prioritizeFindings(findings: Finding[]) {
  const priority = { high: 0, medium: 1, low: 2 };
  return [...findings].sort((a, b) => priority[a.severity] - priority[b.severity] || a.checkId.localeCompare(b.checkId));
}
