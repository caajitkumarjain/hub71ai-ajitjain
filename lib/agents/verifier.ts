import type { Profile } from "@/lib/schemas";
import { AgentAnswer, type Language } from "@/lib/agents/contracts";
import { activities, jurisdictions, rules, steps } from "@/lib/engines/seed-data";
export { verifyDocumentPack } from "@/lib/export/verify";

export type VerificationResult = { verdict: "approve" | "revise"; reasons: string[] };

const seedIds = new Set([...steps, ...rules, ...jurisdictions, ...activities].map((item) => item.id));
const activityIds = new Set(activities.map((activity) => activity.id));
const monthNames = [
  ["January", "Jan", "يناير", "जनवरी"], ["February", "Feb", "فبراير", "फरवरी", "फ़रवरी"], ["March", "Mar", "مارس", "मार्च"],
  ["April", "Apr", "أبريل", "ابريل", "अप्रैल"], ["May", "مايو", "मई"], ["June", "Jun", "يونيو", "जून"],
  ["July", "Jul", "يوليو", "जुलाई"], ["August", "Aug", "أغسطس", "اغسطس", "अगस्त"],
  ["September", "Sept", "Sep", "سبتمبر", "सितंबर", "सितम्बर"], ["October", "Oct", "أكتوبر", "اكتوبر", "अक्टूबर"],
  ["November", "Nov", "نوفمبر", "नवंबर", "नवम्बर"], ["December", "Dec", "ديسمبر", "दिसंबर", "दिसम्बर"],
];
const monthLookup = new Map(monthNames.flatMap((names, index) => names.map((name) => [name.toLowerCase(), index + 1] as const)));
const monthPattern = [...monthLookup.keys()].sort((a, b) => b.length - a.length).join("|");
const bannedPhrases = [
  /\bguaranteed\b/i, /\bwill\s+be\s+approved\b/i,
  /\bi\s+(?:have\s+)?submitted\b/i, /\bi\s+applied\b/i, /\bi\s+paid\b/i,
  /\bi['’]ve\s+(?:submitted|applied|paid)\b/i,
  /\bi\s+(?:have\s+)?(?:sent|contacted|emailed)\b/i,
  /(?:لقد\s+)?(?:قدمت|أرسلت|ارسلت|دفعت)\s+(?:الطلب|طلبك|الرسوم|نيابة)/,
];

function normaliseText(value: string): string {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/\u066c/g, ",").replace(/\u066b/g, ".")
    .replace(/[*_`]/g, "");
}

function isoDate(year: string, month: number, day: string): string | null {
  const numericYear = Number(year);
  const numericDay = Number(day);
  const date = new Date(0);
  date.setUTCFullYear(numericYear, month - 1, numericDay);
  if (date.getUTCFullYear() !== numericYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== numericDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function numericTokens(value: string, answer = false): { tokens: Set<string>; invalidDates: string[] } {
  let text = normaliseText(value);
  const tokens = new Set<string>();
  const invalidDates: string[] = [];
  const takeDate = (whole: string, year: string, month: number, day: string) => {
    const normalised = isoDate(year, month, day);
    if (normalised) tokens.add(normalised);
    else invalidDates.push(whole);
    return " ".repeat(whole.length);
  };
  text = text.replace(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g,
    (whole: string, year: string, month: string, day: string) => takeDate(whole, year, Number(month), day));
  text = text.replace(new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\.?\\s*,?\\s+(\\d{4})(?!\\d)`, "gi"),
    (whole: string, day: string, month: string, year: string) => takeDate(whole, year, monthLookup.get(month.toLowerCase())!, day));
  text = text.replace(new RegExp(`(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})(?!\\d)`, "gi"),
    (whole: string, month: string, day: string, year: string) => takeDate(whole, year, monthLookup.get(month.toLowerCase())!, day));
  if (answer) text = text.replace(/^[ \t]*(?:>[ \t]*)?[1-4][.)][ \t]+/gm, (ordinal) => " ".repeat(ordinal.length));
  for (const match of text.matchAll(/\d[\d,.]*/g)) {
    const token = match[0].replace(/[,.]+$/, "").replace(/,/g, "");
    // A calendar year on its own is not a computed amount. Currency and units
    // keep a four-digit amount in scope for verification.
    const before = text.slice(Math.max(0, match.index - 18), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 18);
    const amountContext = /(?:AED|USD|GBP|EUR|د\.إ|درهم|[$€£])\s*$/i.test(before)
      || /^\s*(?:AED|USD|GBP|EUR|days?|months?|years?|درهم|يوم|أيام)\b/i.test(after);
    if (answer && /^(?:19|20)\d{2}$/.test(token) && !amountContext) continue;
    tokens.add(token);
  }
  return { tokens, invalidDates };
}

function collectToolData(toolResults: unknown[]): { numbers: Set<string>; findings: Set<string> } {
  const numbers = new Set<string>();
  const findings = new Set<string>();
  const seen = new WeakSet<object>();
  function visit(value: unknown, depth = 0): void {
    if (depth > 40) return;
    if (typeof value === "string") {
      for (const token of numericTokens(value).tokens) numbers.add(token);
      const trimmed = value.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try { visit(JSON.parse(trimmed) as unknown, depth + 1); } catch { /* Plain tool text need not be JSON. */ }
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      for (const token of numericTokens(String(value)).tokens) numbers.add(token);
    } else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1));
      else {
        const record = value as Record<string, unknown>;
        if (typeof record.checkId === "string") findings.add(record.checkId);
        Object.values(record).forEach((item) => visit(item, depth + 1));
      }
    }
  }
  toolResults.forEach((result) => visit(result));
  return { numbers, findings };
}

export function verifyAgentResult(result: unknown, toolResults: unknown[], profile?: Profile, expectedLanguage?: Language): VerificationResult {
  const parsed = AgentAnswer.safeParse(result);
  if (!parsed.success) return { verdict: "revise", reasons: ["Result does not match the AgentResult schema."] };
  const answer = parsed.data;
  const reasons: string[] = [];
  const toolData = collectToolData(toolResults);
  const knownIds = new Set([...seedIds, ...toolData.findings]);

  for (const id of new Set(answer.evidence)) {
    if (!knownIds.has(id)) reasons.push(`Unknown evidence ID: ${id}.`);
  }
  if (answer.status === "complete" && !answer.evidence.length) reasons.push("A complete answer must cite evidence.");
  if (!answer.answer_md.trim()) reasons.push("The answer must not be empty.");
  for (const action of answer.next_actions) {
    if (!/^\/(?:path|bank|deadlines|start)?(?:[?#][^\s\\]*)?$/.test(action.href) || /[\u0000-\u0020\u007f]/.test(action.href)) {
      reasons.push("Next actions must link to an existing founder route.");
    }
  }

  const matchedActivities = new Set<string>();
  for (const match of answer.activityMatches ?? []) {
    if (!activityIds.has(match.activityId)) reasons.push(`Unknown activity ID: ${match.activityId}.`);
    if (matchedActivities.has(match.activityId)) reasons.push(`Duplicate activity ID: ${match.activityId}.`);
    matchedActivities.add(match.activityId);
    if (!match.reason.trim()) reasons.push("Activity match reasons must not be empty.");
  }
  for (const finding of answer.bankReview ?? []) {
    if (!finding.evidenceQuote.trim() || !profile?.businessDescription.includes(finding.evidenceQuote)) {
      reasons.push("Bank review evidenceQuote must exactly quote the current business description.");
    }
    if (!finding.title.trim() || !finding.question.trim()) reasons.push("Bank review titles and questions must not be empty.");
  }

  // Citation IDs are labels, not quantities (for example BK-01 and EINV-P1-ASP).
  // Exact user quotes are checked above; their numbers are profile facts, not
  // generated regulatory claims. All generated card copy is verified as prose.
  const generatedCopy = [answer.answer_md,
    ...(answer.activityMatches ?? []).map((match) => match.reason),
    ...(answer.bankReview ?? []).flatMap((finding) => [finding.title, finding.question]),
  ].join("\n");
  let answerText = normaliseText(generatedCopy);
  for (const id of [...knownIds].sort((a, b) => b.length - a.length)) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    answerText = answerText.replace(new RegExp(`(?<![\\w-])${escapedId}(?![\\w-])`, "gi"), " ");
  }
  const answerTokens = numericTokens(answerText, true);
  const declaredTokens = new Set(answer.numbers_used.flatMap((value) => [...numericTokens(value).tokens]));
  for (const date of answerTokens.invalidDates) reasons.push(`Invalid date in answer: ${date}.`);
  for (const token of answerTokens.tokens) {
    if (!declaredTokens.has(token)) reasons.push(`Number or date missing from numbers_used: ${token}.`);
    if (!toolData.numbers.has(token)) reasons.push(`Number or date not found in this run's tool output: ${token}.`);
  }
  const plainAnswer = normaliseText(generatedCopy);
  for (const phrase of bannedPhrases) {
    const match = plainAnswer.match(phrase);
    if (match) reasons.push(`Disallowed approval promise or external-action claim: ${match[0]}.`);
  }
  if (expectedLanguage && answer.language !== expectedLanguage) reasons.push(`Expected language ${expectedLanguage}; received ${answer.language}.`);
  if (expectedLanguage === "ar" || expectedLanguage === "hi") {
    const script = expectedLanguage === "ar" ? /[\u0621-\u064A]/g : /[\u0904-\u0939\u0958-\u0961]/g;
    const scriptLetters = (answerText.match(script) ?? []).length;
    const latinLetters = (answerText.replace(/\b[A-Z][A-Z-]+\b/g, "").match(/[a-zA-Z]/g) ?? []).length;
    if (scriptLetters < 3 || scriptLetters < latinLetters) reasons.push(`The answer must be written in ${expectedLanguage === "ar" ? "Arabic" : "Hindi"}, not merely labelled that way.`);
  }
  return { verdict: reasons.length ? "revise" : "approve", reasons };
}
