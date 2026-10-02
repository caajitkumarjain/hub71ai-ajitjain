import { z } from "zod";
import { Profile } from "@/lib/schemas";

const text = z.string().max(6000);
const webUrl = z.url().refine((value) => /^https:\/\//i.test(value), "Use an HTTPS official URL.");
export const PackField = z.object({
  label: text.min(1), value: text.nullable(),
  provenance: z.enum(["profile", "calculated", "needed"]), sourceRuleId: z.string().nullable().optional(),
}).strict();
export const PackSource = z.object({
  ruleId: z.string().nullable().optional(), stepId: z.string().nullable().optional(),
  url: webUrl, verifiedOn: z.iso.date().nullable(),
}).strict();
export const DocumentPack = z.object({
  title: text.min(1), purpose: text,
  sections: z.array(z.object({ heading: text, paragraphs: z.array(text).max(30) }).strict()).max(20),
  fields: z.array(PackField).max(100),
  checklist: z.array(z.object({ item: text, required: z.boolean() }).strict()).max(100),
  email: z.object({ to: text.nullable(), subject: text, body: text }).strict().nullable().optional(),
  officialUrl: webUrl.nullable(), sources: z.array(PackSource).max(50),
}).strict();
export type DocumentPack = z.infer<typeof DocumentPack>;

// The model's strict JSON schema requires every key; absent optional information is null.
export const ModelDocumentPack = DocumentPack.extend({
  fields: z.array(PackField.extend({ sourceRuleId: z.string().nullable() })).max(100),
  email: DocumentPack.shape.email.unwrap(),
  sources: z.array(PackSource.extend({ ruleId: z.string().nullable(), stepId: z.string().nullable() })).max(50),
});
export const documentKinds = ["mission-pack", "business-profile", "source-of-funds", "board-resolution", "ubo-declaration", "emaratax"] as const;
export const DocumentKind = z.enum(documentKinds);
export type DocumentKind = z.infer<typeof DocumentKind>;
export const ExportRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document"), document: DocumentKind.exclude(["emaratax"]), profile: Profile, pack: DocumentPack }).strict(),
  z.object({ kind: z.literal("emaratax"), profile: Profile, pack: DocumentPack }).strict(),
  z.object({ kind: z.literal("deadlines"), profile: Profile }).strict(),
  z.object({ kind: z.literal("checklist"), profile: Profile }).strict(),
]);
export type ExportRequest = z.infer<typeof ExportRequest>;
export const DRAFT_NOTE = "DRAFT — review before submitting. Not legal or tax advice.";
export const provenanceLabels = { profile: "From your profile", calculated: "Calculated by Manzil", needed: "NEEDED FROM YOU" } as const;
