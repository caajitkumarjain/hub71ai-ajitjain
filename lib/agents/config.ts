// Official OpenAI model pages checked 2026-10-02. Environment overrides always win.
// https://developers.openai.com/api/docs/models/gpt-6-luna
// https://developers.openai.com/api/docs/models/gpt-6.1-sol
// https://developers.openai.com/api/docs/models/gpt-realtime-2.1
const configured = (name: string, fallback: string) => process.env[name]?.trim() || fallback;
// Server-side only: support the existing Vercel variable while preferring the standard name.
export const openaiApiKey = () => process.env.OPENAI_API_KEY ?? process.env.OPENAI;
export const models = {
  fast: configured("OPENAI_MODEL_FAST", "gpt-6-luna"),
  reasoning: configured("OPENAI_MODEL_REASONING", "gpt-6.1-sol"),
  vision: configured("OPENAI_MODEL_VISION", configured("OPENAI_MODEL_REASONING", "gpt-6.1-sol")),
  realtime: configured("OPENAI_MODEL_REALTIME", "gpt-realtime-2.1"),
};

function positive(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
export const runLimits = () => ({
  maxCalls: Math.max(1, Math.min(12, Math.floor(positive("RUN_MAX_CALLS", 12)))),
  budgetUSD: Math.min(0.5, positive("RUN_BUDGET_USD", 0.5)),
  // A specialist may need multiple tool/model turns plus one verification repair.
  // Keep the specified model-call timeout while bounding the entire workflow too.
  modelTimeoutMs: 20_000,
  timeoutMs: 45_000,
});

// Approximate USD per million tokens, standard short-context rates; not an invoice.
// Model pages above and https://developers.openai.com/api/docs/pricing (2026-10-02).
export const approximatePrices: Record<string, { input: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-6.1-sol": { input: 2, output: 10 },
  "gpt-6-sol": { input: 1, output: 5 },
  "gpt-6-astra": { input: 5, output: 25 },
};
