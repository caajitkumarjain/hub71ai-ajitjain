import type { Profile } from "@/lib/schemas";
import { rules, steps } from "@/lib/engines/seed-data";
import { DocumentPack } from "./schema";

export function normaliseValue(value: string): string {
  return value.normalize("NFKC").replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x966))
    .replace(/\s+/g, " ").trim().toLowerCase();
}

function valuesOf(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(valuesOf);
  if (typeof value === "object") return Object.values(value).flatMap(valuesOf);
  return [];
}

function numberTokens(value: string): string[] {
  return normaliseValue(value).match(/\d{4}-\d{2}-\d{2}|[-+]?\d+(?:[,٬]\d{3})*(?:[.٫]\d+)?%?/g)?.map((token) => token.replace(/[,٬]/g, "").replace(/٫/g, ".")) ?? [];
}

/** Pure, fail-closed document verification. Call only with trusted server tool outputs. */
export function verifyDocumentPack(input: unknown, profile: Profile, toolOutputs: unknown[]): DocumentPack {
  const pack = DocumentPack.parse(input);
  const profileValues = new Set(valuesOf(profile).map(normaliseValue));
  const toolValues = valuesOf(toolOutputs);
  const calculatedValues = new Set(toolValues.map(normaliseValue));
  const fields = pack.fields.map((field) => {
    const value = field.value === null ? "" : normaliseValue(field.value);
    const provenance = value && profileValues.has(value) ? "profile" as const
      : value && calculatedValues.has(value) ? "calculated" as const : "needed" as const;
    const sourceRuleId = field.sourceRuleId && rules.some((rule) => rule.id === field.sourceRuleId) ? field.sourceRuleId : null;
    return { ...field, value: provenance === "needed" ? null : field.value, provenance, sourceRuleId };
  });
  const allowedNumbers = new Set([...toolValues, ...fields.flatMap((field) => field.value === null ? [] : [field.value])].flatMap(numberTokens));
  const clean = (text: string) => numberTokens(text).every((token) => allowedNumbers.has(token)) ? text : "NEEDED FROM YOU — confirm this information before submitting.";
  const sources = pack.sources.flatMap((source) => {
    // Reconstruct citations from the source data, never the model's URL or date.
    if (Boolean(source.ruleId) === Boolean(source.stepId)) return [];
    const record = source.ruleId ? rules.find((rule) => rule.id === source.ruleId) : steps.find((step) => step.id === source.stepId);
    const url = record?.sourceUrl ?? (record && "officialUrl" in record ? record.officialUrl : undefined);
    if (!url || !/^https:\/\//i.test(url)) return [];
    return [{ ruleId: source.ruleId ?? null, stepId: source.stepId ?? null, url, verifiedOn: record?.verifiedOn ?? null }];
  });
  const officialUrls = new Set([...steps.flatMap((step) => [step.officialUrl, step.sourceUrl]), ...rules.map((rule) => rule.sourceUrl)].filter(Boolean));
  return { ...pack, title: clean(pack.title), purpose: clean(pack.purpose),
    sections: pack.sections.map((section) => ({ heading: clean(section.heading), paragraphs: section.paragraphs.map(clean) })),
    fields: fields.map((field) => ({ ...field, label: clean(field.label) })),
    checklist: pack.checklist.map((item) => ({ ...item, item: clean(item.item) })),
    email: pack.email ? { to: pack.email.to && (profileValues.has(normaliseValue(pack.email.to)) || calculatedValues.has(normaliseValue(pack.email.to))) ? pack.email.to : null,
      subject: clean(pack.email.subject), body: clean(pack.email.body) } : null,
    officialUrl: pack.officialUrl && officialUrls.has(pack.officialUrl) ? pack.officialUrl : null, sources };
}
