import { z } from "zod";

export const Lane = z.enum(["arrive", "residency", "company", "home", "family", "operate"]);
export type Lane = z.infer<typeof Lane>;
export const Jurisdiction = z.enum(["adgm", "mainland", "hub71", "masdar", "kezad", "twofour54"]);
export type Jurisdiction = z.infer<typeof Jurisdiction>;
export const RevenueModel = z.enum(["saas", "services", "trading", "marketplace", "manufacturing", "fnb", "other"]);
export const Confidence = z.enum(["high", "medium", "low"]);
export const StepStatus = z.enum(["todo", "in_progress", "done", "blocked"]);
const isoDate = z.iso.date();
const money = z.number().nonnegative();
const moneyRange = z.object({ min: money, max: money }).refine((v) => v.min <= v.max, "min must not exceed max");

export const Profile = z.object({
  id: z.string(), name: z.string().default("Founder"),
  nationality: z.string(), inUAE: z.boolean().default(false), arrivalDate: isoDate,
  spouse: z.boolean().default(false),
  childrenAges: z.array(z.number().int().min(0).max(18)).default([]),
  businessDescription: z.string(), revenueModel: RevenueModel,
  activityCode: z.string().optional(), jurisdiction: Jurisdiction.optional(),
  fundingUSD: money.default(0), revenue12mAED: money.default(0),
  hires12m: z.number().int().nonnegative().default(0),
  drivingLicenceCountry: z.string().optional(), incorporationDate: isoDate.optional(),
  stepStatus: z.record(z.string(), StepStatus).default({}),
  documents: z.array(z.object({ docType: z.string(), expiryDate: isoDate.optional() })).default([]),
  locale: z.enum(["en", "ar"]).default("en"),
});
export type Profile = z.infer<typeof Profile>;

// The explicit recursive annotation keeps the predicate DSL usable across engine boundaries.
export type Condition = {
  all?: Condition[]; any?: Condition[]; not?: Condition;
  field?: string; op?: "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte" | "exists" | "truthy";
  value?: unknown;
};
export const Condition: z.ZodType<Condition> = z.lazy(() => z.object({
  all: z.array(Condition).optional(), any: z.array(Condition).optional(), not: Condition.optional(),
  field: z.string().optional(),
  op: z.enum(["eq", "neq", "in", "gt", "gte", "lt", "lte", "exists", "truthy"]).optional(),
  value: z.unknown().optional(),
}));

export const Step = z.object({
  id: z.string(), title: z.string(), lane: Lane, authority: z.string(), description: z.string(),
  appliesIf: Condition.optional(), dependsOn: z.array(z.string()),
  durationDays: z.object({ min: money, likely: money, max: money })
    .refine((v) => v.min <= v.likely && v.likely <= v.max, "Invalid duration range"),
  costAED: moneyRange.nullable(), documents: z.array(z.string()),
  officialUrl: z.url().optional(), ruleIds: z.array(z.string()),
  canStartBeforeArrival: z.boolean().optional(), sourceUrl: z.url().optional(),
  verifiedOn: isoDate.optional(), confidence: Confidence, verify: z.boolean(),
});
export type Step = z.infer<typeof Step>;

export const Rule = z.object({
  id: z.string(), title: z.string(), authority: z.string(), appliesIf: Condition.optional(),
  kind: z.enum(["deadline", "recurring", "threshold", "info"]),
  trigger: z.object({
    type: z.enum(["from_date", "threshold", "fixed_date", "recurring", "none"]),
    field: z.string().optional(), offsetMonths: z.number().int().optional(),
    offsetDays: z.number().int().optional(), date: isoDate.optional(), threshold: money.optional(),
    every: z.enum(["month", "quarter", "year"]).optional(),
  }),
  penaltyAED: money.nullable(), penaltyNote: z.string().optional(),
  currency: z.enum(["AED", "USD"]).optional(), penaltyNative: money.optional(),
  sourceUrl: z.url().nullable(), verifiedOn: isoDate,
  confidence: Confidence, verify: z.boolean(), summary: z.string(),
});
export type Rule = z.infer<typeof Rule>;

export const PathNode = Step.extend({
  earliestStart: z.number(), earliestFinish: z.number(), slack: z.number(),
  critical: z.boolean(), status: StepStatus,
});
export type PathNode = z.infer<typeof PathNode>;
export const PathResult = z.object({
  nodes: z.array(PathNode),
  edges: z.array(z.object({ from: z.string(), to: z.string(), critical: z.boolean() })),
  criticalPath: z.array(z.string()), naiveDays: money, optimizedDays: money, savedDays: money,
  costAED: moneyRange, nullCostCount: z.number().int().nonnegative(), // §8.2
  parallelOpportunities: z.array(z.object({ stepId: z.string(), message: z.string(), savedDays: money })),
  excludedSteps: z.array(z.object({ stepId: z.string(), reason: z.string() })),
});
export type PathResult = z.infer<typeof PathResult>;

export const Obligation = z.object({
  ruleId: z.string(), title: z.string(), authority: z.string(), dueDate: isoDate.nullable(),
  penaltyAED: money.nullable(), penaltyDisplay: z.string(),
  status: z.enum(["upcoming", "due_soon", "overdue", "info"]), reason: z.string(),
  sourceUrl: z.url().nullable(), verifiedOn: isoDate, confidence: Confidence, verify: z.boolean(),
});
export type Obligation = z.infer<typeof Obligation>;
export const Finding = z.object({
  checkId: z.string(), severity: z.enum(["high", "medium", "low"]), title: z.string(),
  whyBankCares: z.string(), fix: z.string(),
  fixAction: z.object({ field: Profile.keyof(), value: z.unknown(), label: z.string() }).optional(),
  pointsLost: money,
});
export type Finding = z.infer<typeof Finding>;
export const AgentResult = z.object({
  status: z.enum(["complete", "abstain", "escalate"]), answer_md: z.string(),
  evidence: z.array(z.string()), numbers_used: z.array(z.string()),
  next_actions: z.array(z.object({ label: z.string(), href: z.string() })).max(4),
  authority_to_verify: z.string().nullable(), language: z.string(),
});
export type AgentResult = z.infer<typeof AgentResult>;
export const TraceEvent = z.object({
  runId: z.string(), spanId: z.string(), parentId: z.string().nullable(), ts: z.iso.datetime(),
  agent: z.string(),
  kind: z.enum(["run_start", "agent_start", "handoff", "tool_call", "tool_result", "guardrail", "verifier", "message_delta", "final", "error", "fallback"]),
  name: z.string().optional(), data: z.unknown().optional(), ms: money.optional(), costUSD: money.optional(),
});
export type TraceEvent = z.infer<typeof TraceEvent>;

// Supporting seed and engine-result contracts for the next phase.
export const Activity = z.object({ id: z.string(), revenueModels: z.array(RevenueModel), dnfbp: z.boolean() });
export type Activity = z.infer<typeof Activity>;
export const JurisdictionData = z.object({
  id: Jurisdiction, name: z.string(), licenceAEDPerYear: money.nullable(),
  officeAEDPerYear: money.nullable(), setupOneOffAED: money.nullable(), visaAEDPerPerson: money.nullable(),
  sourceUrl: z.url().nullable(), verifiedOn: isoDate, confidence: Confidence, verify: z.boolean(),
  notes: z.string(), fitRules: z.array(z.object({ condition: Condition, message: z.string() })),
});
export type JurisdictionData = z.infer<typeof JurisdictionData>;
export const LicenceExchange = z.object({
  countries: z.array(z.string()), sourceUrls: z.array(z.url()), verifiedOn: isoDate,
  confidence: Confidence, verify: z.boolean(),
});
export const JurisdictionComparison = z.object({
  jurisdictionId: Jurisdiction, totalAED: money,
  breakdown: z.object({ licenceAED: money.nullable(), officeAED: money.nullable(), visasAED: money.nullable(), setupAED: money.nullable() }),
  unknowns: z.array(z.string()), fitFlags: z.array(z.string()),
});
export type JurisdictionComparison = z.infer<typeof JurisdictionComparison>;
export const BankabilityResult = z.object({ score: z.number().min(0).max(100), band: z.enum(["Ready", "Fixable", "High risk"]), findings: z.array(Finding) });
export type BankabilityResult = z.infer<typeof BankabilityResult>;
export const WhatIfResult = z.object({
  before: z.array(Obligation), after: z.array(Obligation),
  diff: z.object({ added: z.array(Obligation), removed: z.array(Obligation), changed: z.array(z.object({ before: Obligation, after: Obligation })) }),
});
export type WhatIfResult = z.infer<typeof WhatIfResult>;
