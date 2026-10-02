import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Activity, AgentResult, Condition, JurisdictionData, LicenceExchange, Profile, Rule, Step } from "@/lib/schemas";
import rawSteps from "@/data/steps.json";
import rawRules from "@/data/rules.json";
import activities from "@/data/activities.json";
import jurisdictions from "@/data/jurisdictions.json";
import personas from "@/data/personas.json";
import exchange from "@/data/licence-exchange.json";
import evals from "@/data/evals.json";

const spec = readFileSync(new URL("../MANZIL-CODEX-BUILD-SPEC.md", import.meta.url), { encoding: "utf-8" });
function table(section: string, end: string) {
  return spec.split(section)[1].split(end)[0].split(/\r?\n/)
    .filter((line) => line.startsWith("| ")).slice(1)
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
}

describe("§6 schemas and §9–10 seeds", () => {
  it("validates every seed without losing fields", () => {
    expect(Step.array().parse(rawSteps)).toEqual(rawSteps);
    expect(Rule.array().parse(rawRules)).toEqual(rawRules);
    expect(Activity.array().parse(activities)).toEqual(activities);
    expect(JurisdictionData.array().parse(jurisdictions)).toEqual(jurisdictions);
    expect(LicenceExchange.parse(exchange)).toEqual(exchange);
    for (const profile of Object.values(personas)) expect(Profile.parse(profile)).toEqual(profile);
    expect(evals).toHaveLength(9);
  });

  it("copies all step titles, lanes, dependencies, durations and costs from the specification", () => {
    const expected = table("## 9.", "## 10.");
    expect(rawSteps).toHaveLength(expected.length);
    for (const [id, title, lane, , dependencies, duration, cost] of expected) {
      const [likely, min, max] = duration.match(/\d+/g)!.map(Number);
      expect(rawSteps.find((s) => s.id === id)).toMatchObject({
        id, title, lane, dependsOn: dependencies === "—" ? [] : dependencies.split(", "),
        durationDays: { min, likely, max }, costAED: cost === "null" ? null : { min: Number(cost), max: Number(cost) },
      });
    }
  });

  it("copies all rule titles, authorities and verify flags without adding rules", () => {
    const expected = table("## 10.", "### `data/jurisdictions.json`");
    expect(rawRules).toHaveLength(expected.length);
    for (const [id, title, authority, , , , , , verify] of expected) {
      expect(rawRules.find((rule) => rule.id === id)).toMatchObject({ id, title, authority, verify: verify.includes("true"), verifiedOn: "2026-10-02" });
    }
  });

  it("has unique IDs, resolvable references and no dependency cycles", () => {
    const ids = new Set(rawSteps.map((s) => s.id));
    const ruleIds = new Set(rawRules.map((r) => r.id));
    expect(ids.size).toBe(rawSteps.length);
    expect(ruleIds.size).toBe(rawRules.length);
    const completed = new Set<string>();
    function visit(id: string, trail = new Set<string>()) {
      expect(trail.has(id), `Cycle at ${id}`).toBe(false);
      if (completed.has(id)) return;
      const step = rawSteps.find((s) => s.id === id)!;
      for (const dependency of step.dependsOn) {
        expect(ids.has(dependency)).toBe(true);
        visit(dependency, new Set([...trail, id]));
      }
      step.ruleIds.forEach((rule) => expect(ruleIds.has(rule)).toBe(true));
      completed.add(id);
    }
    rawSteps.forEach((s) => visit(s.id));
  });

  it("preserves pre-arrival work and the school application dependency", () => {
    expect(rawSteps.filter((s) => s.canStartBeforeArrival).map((s) => s.id).sort())
      .toEqual(["C-ACT", "C-JURIS", "C-NAME", "F-ATTEST", "F-SCHOOL"]);
    expect(rawSteps.find((s) => s.id === "F-SCHOOL")?.dependsOn).toEqual(["F-ATTEST"]);
    expect(exchange.countries).not.toContain("India");
    expect(exchange.countries).toContain("Germany");
  });

  it("retains financial units and distinguishes a renewal fee from a penalty", () => {
    const get = (id: string) => rawRules.find((rule) => rule.id === id)!;
    expect(get("CT-REG")).toMatchObject({ penaltyAED: 10000, trigger: { field: "incorporationDate", offsetMonths: 3 } });
    expect(get("VAT-REG")).toMatchObject({ penaltyAED: 10000, trigger: { threshold: 375000, offsetDays: 30 } });
    expect(get("ADGM-CS")).toMatchObject({ penaltyNative: 300, currency: "USD", penaltyAED: 1101.75 });
    expect(get("TAWTH-RENEW").penaltyAED).toBeNull();
    expect(get("EINV-P1-ASP").trigger.date).toBe("2026-10-30");
    expect(get("GOAML").appliesIf).toEqual({ field: "isDnfbpActivity", op: "truthy" });
    expect(get("EINV-P2").appliesIf).toEqual({ all: [{ field: "revenueOverVAT", op: "truthy" }, { not: { field: "einvPhase1", op: "truthy" } }] });
  });

  it("preserves Priya exactly and the other specified persona facts", () => {
    expect(personas.priya).toMatchObject({ nationality: "India", arrivalDate: "2026-10-12", inUAE: false, spouse: true, childrenAges: [7], revenueModel: "saas", activityCode: "general-trading", fundingUSD: 400000, revenue12mAED: 420000, hires12m: 2, drivingLicenceCountry: "India" });
    expect(personas.priya).not.toHaveProperty("jurisdiction");
    expect(personas.priya.documents.map((d) => d.docType)).toEqual(["passport", "proof_of_address", "cv", "source_of_funds"]);
    expect(personas.omar).toMatchObject({ nationality: "Egypt", jurisdiction: "mainland", revenue12mAED: 2500000, hires12m: 6 });
    expect(personas.lena).toMatchObject({ nationality: "Germany", jurisdiction: "masdar", drivingLicenceCountry: "Germany", spouse: false, childrenAges: [], revenue12mAED: 0 });
  });

  it("rejects malformed dates, ages, amounts and agent status while applying defaults", () => {
    expect(Profile.safeParse({ ...personas.priya, arrivalDate: "2026-02-30" }).success).toBe(false);
    expect(Profile.safeParse({ ...personas.priya, childrenAges: [19] }).success).toBe(false);
    expect(Profile.safeParse({ ...personas.priya, revenue12mAED: -1 }).success).toBe(false);
    expect(AgentResult.safeParse({ status: "submitted" }).success).toBe(false);
    expect(Condition.safeParse({ field: "isADGM", op: "execute" }).success).toBe(false);
    const { name, spouse, stepStatus, ...minimal } = personas.omar;
    void name; void spouse; void stepStatus;
    expect(Profile.parse(minimal)).toMatchObject({ name: "Founder", spouse: false, stepStatus: {} });
  });
});
