import type { RulebookRow } from "./dataset";

export function filterRulebook(rows: RulebookRow[], query: string, kind: "all" | "Step" | "Rule", lane: string): RulebookRow[] {
  const terms = query.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (lane !== "all" && !row.lanes.includes(lane as RulebookRow["lanes"][number])) return false;
    const text = [row.id, row.title, row.authority, row.description, ...row.lanes, ...row.dependsOn, ...row.ruleIds].join(" ").toLocaleLowerCase("en");
    return terms.every((term) => text.includes(term));
  });
}
