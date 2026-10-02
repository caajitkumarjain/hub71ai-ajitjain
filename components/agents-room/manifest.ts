import { z } from "zod";

const text = z.string().trim().min(1);
const acceptanceCaseSchema = z.object({
  name: text,
  expected: z.enum(["complete", "abstain", "escalate"]),
  holdout: z.boolean(),
}).strict();

export const agentContractSchema = z.object({
  id: text.regex(/^[a-z]+(?:-[a-z]+)*$/),
  name: text,
  monogram: text.max(3),
  role: text,
  mission: text,
  tier: z.enum(["Reasoning", "Fast", "Deterministic"]),
  tools: z.array(text),
  guardrails: z.array(text).min(1),
  deliverable: text,
  outputContract: z.literal("complete | abstain | escalate + evidence ids"),
  humanCheckpoint: text,
  killCondition: text,
  budget: z.object({
    maxCalls: z.number().int().nonnegative(),
    maxSeconds: z.number().positive(),
    maxUSD: z.number().nonnegative(),
  }).strict(),
  acceptanceCases: z.array(acceptanceCaseSchema).length(5)
    .refine((cases) => cases.some((item) => item.expected === "abstain"), "An abstention case is required")
    .refine((cases) => cases.some((item) => item.expected === "escalate"), "An escalation case is required")
    .refine((cases) => cases.some((item) => item.holdout), "A holdout case is required"),
}).strict();

export const agentManifestSchema = z.array(agentContractSchema).min(1)
  .refine((agents) => new Set(agents.map((agent) => agent.id)).size === agents.length, "Agent IDs must be unique");

export type AgentManifestEntry = z.infer<typeof agentContractSchema>;

export const studioIds = new Set(["name-agent", "bank-pack-agent", "governance-agent", "tax-prep-agent"]);

export function agentLane(id: string): "gold" | "teal" | "sky" | "coral" | "muted" {
  if (studioIds.has(id) || id === "concierge" || id === "mission-builder") return "gold";
  if (id === "input-guardrail" || id === "verifier") return "teal";
  if (id === "deadline-sentinel") return "coral";
  if (id === "activity-matcher") return "muted";
  return "sky";
}
