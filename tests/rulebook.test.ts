import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/rulebook/route";
import { rulebookCounts, rulebookCoverage, rulebookDataset, rulebookRows } from "@/components/rulebook/dataset";
import { filterRulebook } from "@/components/rulebook/search";
import { activities, jurisdictions, licenceExchange, rules, steps } from "@/lib/engines/seed-data";

describe("public Rulebook dataset", () => {
  it("reports actual seed counts and dependency edges", () => {
    expect(rulebookCounts).toMatchObject({ steps: 35, rules: 19, jurisdictions: 6, activities: 12, lanes: 6 });
    expect(rulebookCounts.dependencies).toBe(steps.flatMap((step) => step.dependsOn).length);
  });
  it("exports the validated public seed data without user profiles or invented values", () => {
    const data = rulebookDataset();
    expect(data).toMatchObject({ steps, rules, jurisdictions, activities, licenceExchange });
    expect(Object.keys(data).sort()).toEqual(["activities", "format", "jurisdictions", "licenceExchange", "notice", "rules", "steps"]);
    expect(data.steps.some((step) => step.costAED === null)).toBe(true);
    expect(data.rules.some((rule) => rule.sourceUrl === null)).toBe(true);
  });
  it("provides a JSON attachment with exactly the public dataset", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="manzil-rulebook.json"');
    expect(await response.json()).toEqual(rulebookDataset());
  });
  it("assigns every seeded step to exactly one authority/lane cell", () => {
    const coverage = rulebookCoverage();
    expect(coverage.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.count, 0)).toBe(steps.length);
    for (const step of steps) expect(coverage.find((row) => row.authority === step.authority)?.cells.find((cell) => cell.lane === step.lane)?.count).toBeGreaterThan(0);
  });
  it("preserves evidence metadata and maps rule lanes only through explicit seed references", () => {
    const rows = rulebookRows();
    expect(rows).toHaveLength(54);
    for (const rule of rules) {
      const row = rows.find((entry) => entry.id === rule.id)!;
      expect(row).toMatchObject({ sourceUrl: rule.sourceUrl, verifiedOn: rule.verifiedOn, authority: rule.authority, confidence: rule.confidence, verify: rule.verify });
      expect(new Set(row.lanes)).toEqual(new Set(steps.filter((step) => step.ruleIds.includes(rule.id)).map((step) => step.lane)));
    }
  });
});

describe("Rulebook search", () => {
  const rows = rulebookRows();
  it("matches case-insensitive ID, title and authority terms together", () => {
    const rule = rules[0];
    expect(filterRulebook(rows, `  ${rule.id.toLowerCase()} ${rule.authority.toUpperCase()}  `, "Rule", "all").map((row) => row.id)).toEqual([rule.id]);
  });
  it("combines entry type and lane filters without changing rows", () => {
    const snapshot = structuredClone(rows);
    const result = filterRulebook(rows, "", "Step", "family");
    expect(result.map((row) => row.id)).toEqual(steps.filter((step) => step.lane === "family").map((step) => step.id));
    expect(rows).toEqual(snapshot);
  });
  it("shows all entries for a blank query and none for an unknown term", () => {
    expect(filterRulebook(rows, "  ", "all", "all")).toEqual(rows);
    expect(filterRulebook(rows, "definitely-unseeded-authority", "all", "all")).toEqual([]);
  });
});
