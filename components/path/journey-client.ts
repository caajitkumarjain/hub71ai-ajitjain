import { z } from "zod";
import { BankabilityResult, JurisdictionComparison, Obligation, PathResult, Profile } from "@/lib/schemas";

export const checks = [
  { id: "path", label: "Ordering your steps" },
  { id: "bank", label: "Checking your bank readiness" },
  { id: "obligations", label: "Finding your deadlines" },
  { id: "jurisdictions", label: "Comparing locations" },
] as const;
export type CheckId = typeof checks[number]["id"];
export type CheckState = "pending" | "ready" | "unavailable";
export type Journey = {
  path: PathResult;
  obligations: Obligation[] | null;
  jurisdictions: JurisdictionComparison[] | null;
  bank: BankabilityResult | null;
};
let cached: { key: string; journey: Journey } | null = null;

export function readJourney(profile: Profile) {
  return cached?.key === JSON.stringify(profile) ? cached.journey : null;
}

export async function postProfile<T>(route: string, profile: Profile, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${route}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: Profile.parse(profile) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Service unavailable (${response.status})`);
  return schema.parse(await response.json());
}

export async function loadJourney(profile: Profile, onCheck?: (id: CheckId, state: CheckState) => void, signal?: AbortSignal): Promise<Journey> {
  async function request<T>(id: CheckId, route: string, schema: z.ZodType<T>): Promise<T | null> {
    try {
      const value = await postProfile(route, profile, schema, signal);
      onCheck?.(id, "ready");
      return value;
    } catch (error) {
      if (signal?.aborted) throw error;
      onCheck?.(id, "unavailable");
      return null;
    }
  }
  const [path, bank, obligations, jurisdictions] = await Promise.all([
    request("path", "compile", PathResult),
    request("bank", "bankability", BankabilityResult),
    request("obligations", "obligations", Obligation.array()),
    request("jurisdictions", "jurisdiction", JurisdictionComparison.array()),
  ]);
  if (!path) throw new Error("Your path couldn’t be compiled. Please try again.");
  const journey: Journey = { path, bank, obligations, jurisdictions };
  if (!signal?.aborted) cached = { key: JSON.stringify(profile), journey };
  return journey;
}

// Presentation-only aggregation of returned, dated obligations; never creates a penalty or due date.
export function exposureSummary(obligations: Obligation[] | null, today = new Date()) {
  if (obligations === null) return null;
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  const rows = obligations.filter((item) => item.dueDate && new Date(`${item.dueDate}T00:00:00Z`) >= start && new Date(`${item.dueDate}T00:00:00Z`) <= end);
  return { total: rows.reduce((total, item) => total + (item.penaltyAED ?? 0), 0), unknown: rows.some((item) => item.penaltyAED === null), rows };
}
