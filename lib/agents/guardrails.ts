import { z } from "zod";
import { AgentResult } from "@/lib/schemas";
import type { Language } from "@/lib/agents/contracts";

const Messages = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }));
const injectionPatterns = [
  /\b(?:ignore|disregard|override|bypass|forget)\b[^.!?]{0,80}\b(?:instructions?|rules?|guardrails?|polic(?:y|ies)|system|previous|prior|above)\b/i,
  /\b(?:act|pretend)\s+as\s+(?:the\s+)?(?:system|developer|an?\s+unrestricted)\b/i,
  /\b(?:system|developer)\s*(?:message|prompt)\s*:/i,
  /(?:تجاهل|تجاوز|تخطي|انس)[^.!?\n]{0,70}(?:التعليمات|القواعد|السابق|النظام)/,
  /(?:पिछले|पूर्व|सभी)[^.!?\n]{0,60}(?:निर्देश|नियम)[^.!?\n]{0,60}(?:अनदेखा|भूल)/,
];
const secretPatterns = [
  /\b(?:reveal|show|print|give|expose|dump|tell|return|display|send|what(?:'s|\s+is))\b[^.!?]{0,100}(?:\b(?:api[-_ ]?keys?|OPENAI_API_KEY|secrets?|passwords?|passcodes?|credentials|system\s+(?:prompt|instructions)|environment\s+variables)\b|\.env\b)/i,
  /(?:اكشف|اعرض|اطبع|ارسل|اعطني|ما هو)[^.!?\n]{0,70}(?:مفتاح|كلمه السر|كلمة السر|كلمة المرور|اسرار|تعليمات النظام)/,
  /(?:API\s*key|एपीआई\s*कुंजी|पासवर्ड|गुप्त)[^.!?\n]{0,60}(?:दिखाओ|बताओ|दो)/i,
];
const externalAction = "(?:submit|send|pay|apply|contact|email|call|register|file|book|transfer)";
const actionPatterns = [
  new RegExp(`(?:^|[.!?;\\n]\\s*|\\b(?:and|then)\\s+)(?:please\\s+)?${externalAction}\\b`, "i"),
  new RegExp(`\\b(?:can|could|would|will)\\s+you\\s+(?:please\\s+)?${externalAction}\\b`, "i"),
  new RegExp(`\\b(?:I\\s+(?:want|need)|I'd\\s+like)\\s+you\\s+to\\s+${externalAction}\\b`, "i"),
  /\b(?:submit|pay|apply|send|contact|register|file)\b[^.!?\n]{0,100}\b(?:for me|on my behalf)\b/i,
  /(?:^|[.!?؛\n]\s*)(?:من فضلك\s+)?(?:قدم|ارسل|ادفع|تواصل|اتصل|سجل|احجز)(?=\s|$|[.!؟])/u,
  /(?:هل يمكنك|اريد منك)[^.!?\n]{0,30}(?:تقديم|ارسال|دفع|الاتصال|التواصل|تسجيل)/,
  /(?:قدم|ارسل|ادفع|سجل)[^.!?\n]{0,70}(?:عني|نيابه|نيابة)/,
  /(?:मेरे लिए|मेरी ओर से)[^.!?\n]{0,100}(?:जमा|भुगतान|भेज|आवेदन|संपर्क)/,
  /(?:आवेदन|दस्तावेज|शुल्क)[^.!?\n]{0,70}(?:जमा|भेज|भुगतान)[^.!?\n]{0,30}(?:करो|करें|कर दो|कर दीजिए)/,
];

function escalation(locale: Language, text: string): AgentResult {
  const language = locale === "ar" || /[\u0600-\u06ff]/.test(text) ? "ar" : locale === "hi" || /[\u0900-\u097f]/.test(text) ? "hi" : "en";
  const answer = language === "ar"
    ? "يمكنني إعداد مسودة وشرح الخطوات الرسمية. يجب عليك تقديم الطلب أو الدفع أو التواصل مع الجهة المعنية بنفسك عبر قنواتها الرسمية. لا يمكنني مشاركة التعليمات الداخلية أو الأسرار."
    : language === "hi"
      ? "मैं मसौदा तैयार कर सकता हूँ और आधिकारिक चरण समझा सकता हूँ। आवेदन जमा करना, भुगतान करना या संबंधित संस्था से संपर्क करना आपको उसके आधिकारिक माध्यम से स्वयं करना होगा। मैं आंतरिक निर्देश या गोपनीय जानकारी साझा नहीं कर सकता।"
      : "I can prepare a draft and explain the official steps. You must submit, pay or contact the authority yourself through its official channel. I cannot share internal instructions or secrets.";
  return AgentResult.parse({
    status: "escalate", answer_md: answer, evidence: [], numbers_used: [],
    next_actions: [], authority_to_verify: null, language,
  });
}

export function checkInput(messages: { role: "user" | "assistant"; content: string }[], locale: Language): AgentResult | null {
  const parsed = Messages.safeParse(messages);
  if (!parsed.success) return escalation(locale, "");
  for (const message of parsed.data) {
    if (message.role !== "user") continue;
    const text = message.content.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();
    if ([...injectionPatterns, ...secretPatterns, ...actionPatterns].some((pattern) => pattern.test(text))) {
      return escalation(locale, message.content);
    }
  }
  return null;
}
