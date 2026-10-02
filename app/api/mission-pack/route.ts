import { MissionRequest } from "@/lib/agents/contracts";
import { readBody, streamAgent } from "@/lib/agents/http";
import { steps } from "@/lib/engines/seed-data";
import { checkRateLimit } from "@/lib/agents/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request);
  if (limited) return limited;
  const body = await readBody(request, MissionRequest);
  if ("response" in body) return body.response;
  const { profile, stepId, locale } = body.data;
  if (!steps.some((step) => step.id === stepId)) return Response.json({ error: "Unknown step.", code: "INVALID_STEP" }, { status: 400 });
  return streamAgent({ profile, locale, intent: "mission", messages: [{ role: "user", content: `Prepare a draft mission pack for step ${stepId}. Use my saved profile; mark missing details to confirm. Never send or submit anything.` }] }, request);
}
