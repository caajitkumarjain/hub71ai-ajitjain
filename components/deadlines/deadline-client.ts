import { Profile, WhatIfResult, type Obligation } from "@/lib/schemas";

export const Scenario = Profile.pick({ revenue12mAED: true, hires12m: true }).strict();
export type Scenario = Pick<Profile, "revenue12mAED" | "hires12m">;
export const revenueStops = [0, 100_000, 187_500, 375_000, 1_000_000, 10_000_000, 50_000_000, 60_000_000] as const;
export const revenueLabels = ["0", "100k", "187.5k", "375k", "1M", "10M", "50M", "60M"];

// These transformations position a control; thresholds and obligations come only from the API.
export function revenueToPosition(revenue: number): number {
  if (revenue <= 0) return 0;
  const index = revenueStops.findIndex((stop) => stop >= revenue);
  if (index < 0) return 700;
  return (index - 1 + (revenue - revenueStops[index - 1]) / (revenueStops[index] - revenueStops[index - 1])) * 100;
}
export function positionToRevenue(position: number): number {
  const bounded = Math.max(0, Math.min(700, position));
  const index = Math.min(6, Math.floor(bounded / 100));
  return Math.round(revenueStops[index] + (revenueStops[index + 1] - revenueStops[index]) * (bounded / 100 - index));
}

export async function requestScenario(profile: Profile, scenario: Scenario, signal?: AbortSignal) {
  const response = await fetch("/api/obligations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: Profile.parse(profile), whatIf: Scenario.parse(scenario) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Deadline check unavailable (${response.status})`);
  return WhatIfResult.parse(await response.json());
}

export function obligationKey(item: Obligation) { return `${item.ruleId}:${item.dueDate ?? "info"}`; }
export function groupObligations(obligations: Obligation[]) {
  const groups = new Map<string, Obligation[]>();
  const ordered = [...obligations].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title));
  for (const row of ordered) {
    const month = row.dueDate?.slice(0, 7) ?? "undated";
    groups.set(month, [...(groups.get(month) ?? []), row]);
  }
  return [...groups].map(([month, rows]) => ({ month, rows }));
}
export function dateLabel(isoDate: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

// Relative display of returned dates; this never generates a regulatory deadline.
export function nextDeadline(obligations: Obligation[], today = new Date()) {
  const isoToday = today.toISOString().slice(0, 10);
  const row = [...obligations].filter((item) => item.dueDate !== null && item.dueDate >= isoToday).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
  if (!row?.dueDate) return null;
  return { row, daysLeft: Math.round((new Date(`${row.dueDate}T00:00:00Z`).getTime() - new Date(`${isoToday}T00:00:00Z`).getTime()) / 86_400_000) };
}

export function scenarioChanges(diff: WhatIfResult["diff"]) {
  const changes = [
    ...diff.added.map((row) => ({ kind: "New" as const, row })),
    ...diff.removed.map((row) => ({ kind: "Removed" as const, row })),
    ...diff.changed.map(({ after: row }) => ({ kind: "Updated" as const, row })),
  ];
  // Recurring rules may have many occurrences; one chip per rule keeps the diff readable.
  return [...new Map(changes.map((change) => [`${change.kind}:${change.row.ruleId}`, change])).values()];
}
