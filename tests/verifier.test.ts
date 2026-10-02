import { describe, expect, it } from "vitest";
import { AgentResult } from "@/lib/schemas";
import { Profile } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { verifyAgentResult } from "@/lib/agents/verifier";

const result = (patch: Partial<AgentResult> = {}): AgentResult => ({
  status: "complete", answer_md: "Start certificate attestation before arrival.",
  evidence: ["F-ATTEST"], numbers_used: [], next_actions: [], authority_to_verify: null, language: "en", ...patch,
});
const approve = { verdict: "approve", reasons: [] };

describe("§7.4 deterministic result verifier", () => {
  it.each(["/steps/F-ATTEST", "https://example.com", "//example.com", "javascript:alert(1)"])("rejects an unavailable next-action destination %s", (href) => {
    expect(verifyAgentResult(result({ next_actions: [{ label: "Review", href }] }), []).verdict).toBe("revise");
  });
  it("allows a step link on the existing Path route", () => {
    expect(verifyAgentResult(result({ next_actions: [{ label: "Review", href: "/path?step=F-ATTEST" }] }), [])).toEqual(approve);
  });
  it("approves supported results without mutating the answer or tool output", () => {
    const answer = result({ answer_md: "Your estimated path takes 50 days.", numbers_used: ["50"] });
    const tools = [{ optimizedDays: 50 }];
    const before = structuredClone({ answer, tools });
    expect(verifyAgentResult(answer, tools)).toEqual(approve);
    expect({ answer, tools }).toEqual(before);
  });

  it.each([null, {}, { status: "submitted" }, { ...result(), evidence: null }, { ...result(), numbers_used: [30] }])("rejects malformed output %#", (answer) => {
    expect(verifyAgentResult(answer, []).verdict).toBe("revise");
  });

  it("rejects an invented evidence ID even when an arbitrary tool field repeats it", () => {
    const review = verifyAgentResult(result({ evidence: ["FAKE-RULE"] }), [{ id: "FAKE-RULE" }]);
    expect(review.verdict).toBe("revise");
    expect(review.reasons.join(" ")).toContain("Unknown evidence ID: FAKE-RULE");
  });

  it.each(["F-ATTEST", "VAT-REG", "adgm", "software-development"])("accepts seeded evidence %s", (id) => {
    expect(verifyAgentResult(result({ evidence: [id] }), [])).toEqual(approve);
  });

  it("requires nonempty evidence for complete but permits abstain and escalate", () => {
    expect(verifyAgentResult(result({ evidence: [] }), []).reasons).toContain("A complete answer must cite evidence.");
    for (const status of ["abstain", "escalate"] as const) {
      expect(verifyAgentResult(result({ status, evidence: [] }), [])).toEqual(approve);
    }
    expect(verifyAgentResult(result({ answer_md: "   " }), []).verdict).toBe("revise");
  });

  it("accepts finding IDs only from this run, including nested JSON tool results", () => {
    const answer = result({ answer_md: "Review the activity mismatch in BK-01.", evidence: ["BK-01"] });
    expect(verifyAgentResult(answer, [{ output: { findings: [{ checkId: "BK-01", pointsLost: 30 }] } }])).toEqual(approve);
    expect(verifyAgentResult(answer, [JSON.stringify({ findings: [{ checkId: "BK-01" }] })])).toEqual(approve);
    expect(verifyAgentResult(answer, [{ evidence: ["BK-01"] }]).verdict).toBe("revise");
    expect(verifyAgentResult(answer, []).verdict).toBe("revise");
  });

  it("does not count numeric fragments inside valid evidence IDs as quantities", () => {
    expect(verifyAgentResult(result({ answer_md: "Review EINV-P1-ASP and the Hub71 option.", evidence: ["EINV-P1-ASP", "hub71"] }), [])).toEqual(approve);
  });

  it("requires each answer number both in numbers_used and an actual current tool result", () => {
    expect(verifyAgentResult(result({ answer_md: "The penalty is AED 10,000.", numbers_used: [] }), [{ penalty: 10000 }]).reasons)
      .toContain("Number or date missing from numbers_used: 10000.");
    expect(verifyAgentResult(result({ answer_md: "The penalty is AED 10,000.", numbers_used: ["10000"] }), []).reasons)
      .toContain("Number or date not found in this run's tool output: 10000.");
    expect(verifyAgentResult(result({ answer_md: "The penalty is AED 10,000.", numbers_used: ["10,000"] }), [{ penalty: 10000 }])).toEqual(approve);
  });

  it("does not accept a number because the seed data contains it", () => {
    expect(verifyAgentResult(result({ answer_md: "The VAT threshold is AED 375,000.", numbers_used: ["375000"], evidence: ["VAT-REG"] }), []).verdict).toBe("revise");
  });

  it.each([
    ["30", "130"], ["30", "300"], ["20.5", "120.5"], ["10", "10.5"], ["10000", "100000"],
  ])("matches %s as a whole number, not as part of %s", (answerNumber, toolNumber) => {
    const answer = result({ answer_md: `The estimate is ${answerNumber} days.`, numbers_used: [answerNumber] });
    expect(verifyAgentResult(answer, [{ value: toolNumber }]).verdict).toBe("revise");
  });

  it("handles commas, decimal amounts, sentence punctuation and numeric primitives", () => {
    const answer = result({ answer_md: "USD 300 (about AED 1,101.75).", numbers_used: ["300", "1101.75"] });
    expect(verifyAgentResult(answer, [{ usd: 300, aed: 1101.75 }])).toEqual(approve);
    expect(verifyAgentResult(result({ answer_md: "Start at day -15.", numbers_used: ["-15"] }), [{ earliestStart: -15 }])).toEqual(approve);
  });

  it.each(["2026-10-30", "30 October 2026", "October 30, 2026", "30th Oct 2026", "30 **October** 2026", "٣٠ أكتوبر ٢٠٢٦", "३० अक्टूबर २०२६"])("normalises %s as one whole date", (date) => {
    const answer = result({ answer_md: `The due date is ${date}.`, evidence: ["EINV-P1-ASP"], numbers_used: ["2026-10-30"] });
    expect(verifyAgentResult(answer, [{ dueDate: "2026-10-30" }])).toEqual(approve);
  });

  it("normalises human dates in numbers_used and tool output too", () => {
    expect(verifyAgentResult(result({ answer_md: "Due on 2026-10-30.", numbers_used: ["30 October 2026"] }), [{ dueDate: "October 30, 2026" }])).toEqual(approve);
  });

  it("does not let Arabic or Hindi numerals bypass numeric verification", () => {
    for (const token of ["٣٠", "۳۰", "३०"]) {
      expect(verifyAgentResult(result({ answer_md: `The estimate is ${token} days.` }), []).verdict).toBe("revise");
      expect(verifyAgentResult(result({ answer_md: `The estimate is ${token} days.`, numbers_used: ["30"] }), [{ days: 30 }])).toEqual(approve);
    }
    expect(verifyAgentResult(result({ answer_md: "المبلغ ١٬١٠١٫٧٥ درهم.", numbers_used: ["1101.75"], language: "ar" }), [{ amount: 1101.75 }])).toEqual(approve);
  });

  it("rejects a changed date even when all its numeric components occur in tool output", () => {
    const answer = result({ answer_md: "Due on 30 November 2026.", numbers_used: ["2026-11-30"] });
    expect(verifyAgentResult(answer, [{ dueDate: "2026-10-30", month: 11, day: 30, year: 2026 }]).verdict).toBe("revise");
    expect(verifyAgentResult(answer, [{ dueDate: "2026-11-300" }]).verdict).toBe("revise");
  });

  it("requires a whole date in numbers_used instead of its separate components", () => {
    const answer = result({ answer_md: "Due on 30 October 2026.", numbers_used: ["30", "10", "2026"] });
    expect(verifyAgentResult(answer, [{ dueDate: "2026-10-30" }]).verdict).toBe("revise");
  });

  it.each(["2026-02-30", "31 April 2026", "29 February 2026"])("rejects an impossible calendar date %s", (date) => {
    expect(verifyAgentResult(result({ answer_md: `Due on ${date}.`, numbers_used: [date] }), [{ date }]).reasons.some((reason) => reason.startsWith("Invalid date"))).toBe(true);
  });

  it("accepts a valid leap date", () => {
    expect(verifyAgentResult(result({ answer_md: "Due on 29 February 2028.", numbers_used: ["2028-02-29"] }), [{ dueDate: "2028-02-29" }])).toEqual(approve);
  });

  it("ignores only list ordinals one through four and standalone calendar years", () => {
    expect(verifyAgentResult(result({ answer_md: "For 2026:\n1. Start attestation.\n2) Prepare a draft.\n3. Review.\n4. Verify." }), [])).toEqual(approve);
    expect(verifyAgentResult(result({ answer_md: "5. Review." }), []).verdict).toBe("revise");
    expect(verifyAgentResult(result({ answer_md: "You need 1 document." }), []).verdict).toBe("revise");
    expect(verifyAgentResult(result({ answer_md: "The fine is AED 2026." }), []).verdict).toBe("revise");
    expect(verifyAgentResult(result({ answer_md: "It takes 2026 days." }), []).verdict).toBe("revise");
  });

  it.each(["guaranteed", "will be approved", "I have submitted", "I submitted", "I applied", "I paid", "I **have** submitted", "I've submitted", "I have sent"])("rejects the banned claim %s", (claim) => {
    expect(verifyAgentResult(result({ answer_md: `${claim} your application.` }), []).reasons.some((reason) => reason.startsWith("Disallowed"))).toBe(true);
  });

  it("does not reject safe draft-only instructions", () => {
    expect(verifyAgentResult(result({ answer_md: "You can prepare a draft and submit it yourself through the official channel." }), [])).toEqual(approve);
  });

  it("checks all result statuses and remains safe on cyclic or non-JSON tool values", () => {
    const cyclic: Record<string, unknown> = { score: 52 };
    cyclic.self = cyclic;
    expect(verifyAgentResult(result({ answer_md: "The score is 52.", numbers_used: ["52"] }), [undefined, null, cyclic, "{plain text"])).toEqual(approve);
    expect(verifyAgentResult(result({ status: "abstain", evidence: [], answer_md: "I paid the fees." }), []).verdict).toBe("revise");
  });

  it("accepts up to three activity matches only from the seeded activity catalogue", () => {
    const answer = { ...result(), activityMatches: [{ activityId: "software-development", reason: "Fits subscription software." }] };
    expect(verifyAgentResult(answer, [])).toEqual(approve);
    expect(verifyAgentResult({ ...answer, activityMatches: [{ activityId: "invented-activity", reason: "Fits." }] }, [{ activityId: "invented-activity" }]).verdict).toBe("revise");
    expect(verifyAgentResult({ ...answer, activityMatches: Array.from({ length: 4 }, () => answer.activityMatches[0]) }, []).verdict).toBe("revise");
    expect(verifyAgentResult({ ...answer, activityMatches: [...answer.activityMatches, ...answer.activityMatches] }, []).verdict).toBe("revise");
  });

  it("validates every bank evidence quote as a nonempty exact substring of the supplied profile", () => {
    const profile = Profile.parse(personas.priya);
    const bankReview = [{ title: "Customer geography", question: "Can you provide contracts for those customers?", evidenceQuote: "clients in UAE and KSA" }];
    const answer = { ...result(), bankReview };
    expect(verifyAgentResult(answer, [], profile)).toEqual(approve);
    expect(verifyAgentResult(answer, []).verdict).toBe("revise");
    for (const evidenceQuote of ["", " ", "Clients in UAE and KSA", "customers in UAE and KSA", "clients in UAE and KSA."]) {
      expect(verifyAgentResult({ ...answer, bankReview: [{ ...bankReview[0], evidenceQuote }] }, [], profile).verdict).toBe("revise");
    }
    expect(verifyAgentResult({ ...answer, bankReview: Array.from({ length: 4 }, () => bankReview[0]) }, [], profile).verdict).toBe("revise");
  });

  it("allows numbers in exact profile quotes, but verifies numbers in every generated card field", () => {
    const profile = Profile.parse({ ...personas.priya, businessDescription: "We have 99 clients in UAE." });
    const card = { title: "Client evidence", question: "Can you provide customer contracts?", evidenceQuote: "99 clients" };
    const answer = { ...result(), bankReview: [card] };
    expect(verifyAgentResult(answer, [], profile)).toEqual(approve);
    for (const field of ["title", "question"] as const) {
      expect(verifyAgentResult({ ...answer, bankReview: [{ ...card, [field]: "Provide 99 contracts." }] }, [], profile).verdict).toBe("revise");
    }
    const activityMatches = [{ activityId: "software-development", reason: "The licence costs AED 999." }];
    expect(verifyAgentResult({ ...result(), activityMatches }, [], profile).verdict).toBe("revise");
    expect(verifyAgentResult({ ...result({ numbers_used: ["999"] }), activityMatches }, [{ licenceCost: 999 }], profile)).toEqual(approve);
  });

  it("applies the banned phrase check to generated cards, not exact user quotes", () => {
    const profile = Profile.parse({ ...personas.priya, businessDescription: "Our customers ask for guaranteed service." });
    const card = { title: "Service terms", question: "Can you provide a contract?", evidenceQuote: "guaranteed service" };
    expect(verifyAgentResult({ ...result(), bankReview: [card] }, [], profile)).toEqual(approve);
    expect(verifyAgentResult({ ...result(), bankReview: [{ ...card, title: "Approval is guaranteed" }] }, [], profile).verdict).toBe("revise");
  });

  it.each([
    ["ar", "ابدأ بتصديق الوثائق قبل الوصول إلى أبوظبي."],
    ["hi", "अबू धाबी आने से पहले दस्तावेजों का सत्यापन शुरू करें।"],
  ] as const)("checks the actual %s script as well as the language label", (language, answer_md) => {
    expect(verifyAgentResult(result({ language, answer_md }), [], undefined, language)).toEqual(approve);
    expect(verifyAgentResult(result({ language }), [], undefined, language).verdict).toBe("revise");
    expect(verifyAgentResult(result({ language: "en", answer_md }), [], undefined, language).verdict).toBe("revise");
    expect(verifyAgentResult(result({ language, answer_md: `${answer_md.slice(0, 3)}. This answer is entirely written in English except for a few characters.` }), [], undefined, language).verdict).toBe("revise");
  });
});
