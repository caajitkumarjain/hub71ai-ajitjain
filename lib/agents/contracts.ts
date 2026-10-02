import { z } from "zod";
import { AgentResult, Profile } from "@/lib/schemas";
import { DocumentPack, ModelDocumentPack } from "@/lib/export/schema";

export const Language = z.enum(["en", "ar", "hi"]);
export type Language = z.infer<typeof Language>;
export const ActivityMatch = z.object({ activityId: z.string(), reason: z.string().min(1) });
export const BankReviewFinding = z.object({
  title: z.string().min(1), question: z.string().min(1), evidenceQuote: z.string().min(1),
});
// SDK structured output requires every field; deterministic system replies may omit the additions.
export const AgentOutput = AgentResult.extend({
  pack: ModelDocumentPack.nullable(),
  activityMatches: z.array(ActivityMatch).max(3), bankReview: z.array(BankReviewFinding).max(3),
});
export const AgentAnswer = AgentResult.extend({
  pack: DocumentPack.nullable().optional(),
  activityMatches: z.array(ActivityMatch).max(3).optional(),
  bankReview: z.array(BankReviewFinding).max(3).optional(),
});
export type AgentAnswer = z.infer<typeof AgentAnswer>;
export const Message = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(6000) }).strict();
export const AgentRequest = z.object({
  messages: z.array(Message).min(1).max(20), profile: Profile,
  locale: Language.optional(),
  intent: z.enum(["path", "pathfinder", "bank", "deadlines", "mission", "activity"]).optional(),
}).strict().refine((value) => value.messages.at(-1)?.role === "user", "The last message must be from the user.");
export type AgentRequest = z.infer<typeof AgentRequest>;
export const MissionRequest = z.object({ profile: Profile, stepId: z.string().min(1), locale: Language.optional() }).strict();
export const ActivityRequest = z.object({ profile: Profile, locale: Language.optional() }).strict();

export function detectLanguage(text: string, fallback: Language = "en"): Language {
  if (/[\u0900-\u097f]/u.test(text)) return "hi";
  if (/[\u0600-\u06ff]/u.test(text)) return "ar";
  return fallback;
}
