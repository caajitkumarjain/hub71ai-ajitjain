import { describe, expect, it } from "vitest";
import personas from "@/data/personas.json";
import rawActivities from "@/data/activities.json";
import { Activity, BankabilityResult, Profile } from "@/lib/schemas";
import { scoreBankability } from "@/lib/engines/bankability";

const activities = Activity.array().parse(rawActivities);
const priya = Profile.parse(personas.priya);
const ready = Profile.parse({ ...priya, activityCode: "software-development", stepStatus: { "R-EID": "done", "C-OFFICE": "done" } });
const score = (patch: Partial<Profile> = {}) => scoreBankability({ ...ready, ...patch }, activities);
const finding = (id: string, patch: Partial<Profile>) => score(patch).findings.find((item) => item.checkId === id);

describe("§8.5 bankability checks", () => {
  it("computes Priya's exact 52 → 82 flow and applies only the suggested activity fix", () => {
    const before = scoreBankability(priya, activities);
    expect(before).toMatchObject({ score: 52, band: "High risk" });
    expect(before.findings.map((item) => item.checkId)).toEqual(["BK-01", "BK-02", "BK-04"]);
    const fix = before.findings.find((item) => item.checkId === "BK-01")!.fixAction!;
    expect(fix).toMatchObject({ field: "activityCode", value: "software-development" });
    const after = scoreBankability(Profile.parse({ ...priya, [fix.field]: fix.value }), activities);
    expect(after).toMatchObject({ score: 82, band: "Ready" });
    expect(after.findings.map((item) => item.checkId)).toEqual(["BK-02", "BK-04"]);
    expect(BankabilityResult.parse(before)).toEqual(before);
    expect(BankabilityResult.parse(after)).toEqual(after);
  });

  it("returns 100 with no findings when every check passes", () => {
    expect(score()).toEqual({ score: 100, band: "Ready", findings: [] });
  });

  it("uses the first matching activity and handles unknown or absent activities", () => {
    expect(finding("BK-01", { activityCode: "missing" })).toMatchObject({
      severity: "high", pointsLost: 30, fixAction: { field: "activityCode", value: "software-development" },
    });
    expect(finding("BK-01", { activityCode: undefined })).toBeDefined();
    const reversed = [...activities].reverse();
    expect(scoreBankability({ ...ready, activityCode: "missing" }, reversed).findings[0].fixAction?.value).toBe("edtech-platform");
  });

  it("does not invent an activity fix when no catalogue entry matches", () => {
    const mismatch = score({ activityCode: "missing", revenueModel: "other" }).findings[0];
    expect(mismatch.checkId).toBe("BK-01");
    expect(mismatch.fixAction).toBeUndefined();
    expect(mismatch.fix).toContain("UNKNOWN · verify");
  });

  it("keeps residency informational until the Emirates ID is ready", () => {
    const missing = finding("BK-02", { stepStatus: { "C-OFFICE": "done", "R-VISA": "done" } });
    expect(missing).toMatchObject({ severity: "medium", pointsLost: 10 });
    expect(missing?.fixAction).toBeUndefined();
    expect(finding("BK-02", { stepStatus: { "R-EID": "in_progress" } })).toBeDefined();
    expect(finding("BK-02", { documents: [...ready.documents, { docType: "emirates_id" }], stepStatus: {} })).toBeUndefined();
    expect(finding("BK-02", { inUAE: true, stepStatus: {} })).toBeDefined();
  });

  it.each([[1, 5], [2, 10], [3, 15], [4, 15]])("deducts for %i missing UBO documents with the cap", (count, pointsLost) => {
    expect(finding("BK-03", { documents: ready.documents.slice(count) })).toMatchObject({ severity: "medium", pointsLost });
  });

  it("accepts a founder profile as the CV alternative and ignores duplicate documents", () => {
    const documents = ready.documents.map((doc) => doc.docType === "cv" ? { docType: "profile" } : doc);
    expect(finding("BK-03", { documents })).toBeUndefined();
    expect(finding("BK-03", { documents: [{ docType: "passport" }, { docType: "passport" }] })?.pointsLost).toBe(15);
  });

  it("requires the office step to be done", () => {
    expect(finding("BK-04", { stepStatus: { "R-EID": "done", "C-OFFICE": "in_progress" } })).toMatchObject({ severity: "low", pointsLost: 8 });
    expect(finding("BK-04", { stepStatus: { "R-EID": "done", "H-LEASE": "done" } })).toBeDefined();
  });

  it("requires both 80 meaningful characters and customer geography", () => {
    const description = "Customers in UAE: ".padEnd(80, "x");
    expect(finding("BK-05", { businessDescription: description })).toBeUndefined();
    expect(finding("BK-05", { businessDescription: description.slice(0, 79) })).toMatchObject({ pointsLost: 10, fix: "Write my transaction profile" });
    expect(finding("BK-05", { businessDescription: "Subscription customers pay us for a business scheduling platform with recurring payments each month." })).toBeDefined();
    expect(finding("BK-05", { businessDescription: "UAE".padEnd(90, " ") })).toBeDefined();
  });

  it.each(["UAE", "KSA", "GCC", "Saudi", "Emirates", "India", "Europe", "US"])("recognises the specified customer geography %s", (geography) => {
    expect(finding("BK-05", { businessDescription: `Subscription clients in ${geography} purchase scheduling software and pay recurring monthly subscription invoices.` })).toBeUndefined();
  });

  it("requires source-of-funds evidence only when funding is positive", () => {
    const documents = ready.documents.filter((doc) => doc.docType !== "source_of_funds");
    expect(finding("BK-06", { documents, fundingUSD: 1 })).toMatchObject({ severity: "medium", pointsLost: 10 });
    expect(finding("BK-06", { documents, fundingUSD: 0 })).toBeUndefined();
    expect(finding("BK-03", { documents, fundingUSD: 0 })?.pointsLost).toBe(5);
  });

  it.each(["SANCTIONS", "sanctioned", "embargoed", "dual-use", "weapons", "arms trade", "military goods"])("flags %s for human review", (term) => {
    expect(finding("BK-07", { businessDescription: `${ready.businessDescription}; ${term}` })).toMatchObject({
      severity: "high", pointsLost: 20, title: "Escalate to manual review",
    });
  });

  it("does not classify countries as sanctions-sensitive trade terms", () => {
    expect(finding("BK-07", { businessDescription: `${ready.businessDescription}; customers in Russia and Iran.` })).toBeUndefined();
  });

  it.each([
    [80, "Ready", { businessDescription: `${ready.businessDescription}; dual-use` }],
    [77, "Fixable", { fundingUSD: 0, documents: [], stepStatus: { "R-EID": "done" } }],
    [60, "Fixable", { activityCode: "general-trading", stepStatus: { "C-OFFICE": "done" } }],
    [57, "High risk", { activityCode: "general-trading", documents: ready.documents.slice(1), stepStatus: { "R-EID": "done" } }],
  ] satisfies [number, string, Partial<Profile>][])("assigns score %i to %s at the band boundaries", (expected, band, patch) => {
    expect(score(patch)).toMatchObject({ score: expected, band });
  });

  it("clamps to zero when all seven checks fail", () => {
    const result = score({ activityCode: undefined, documents: [], stepStatus: {}, businessDescription: "weapons" });
    expect(result.score).toBe(0);
    expect(result.findings.map((item) => item.checkId)).toEqual(["BK-01", "BK-02", "BK-03", "BK-04", "BK-05", "BK-06", "BK-07"]);
    expect(result.findings.reduce((sum, item) => sum + item.pointsLost, 0)).toBe(103);
  });

  it("is deterministic and does not mutate its inputs or share returned findings", () => {
    const profileSnapshot = structuredClone(priya);
    const activitySnapshot = structuredClone(activities);
    const first = scoreBankability(priya, activities);
    expect(scoreBankability(priya, activities)).toEqual(first);
    first.findings[0].fixAction!.value = "changed";
    expect(scoreBankability(priya, activities).findings[0].fixAction?.value).toBe("software-development");
    expect(priya).toEqual(profileSnapshot);
    expect(activities).toEqual(activitySnapshot);
  });
});
