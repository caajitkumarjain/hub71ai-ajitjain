import { ActivityRequest } from "@/lib/agents/contracts";
import { readBody } from "@/lib/agents/http";
import { runAgent } from "@/lib/agents/run";
import { checkRateLimit } from "@/lib/agents/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request);
  if (limited) return limited;
  const body = await readBody(request, ActivityRequest);
  if ("response" in body) return body.response;
  const result = await runAgent({ ...body.data, intent: "activity", messages: [{ role: "user", content: "Match my business description to the three most suitable activities in the seeded catalog. Explain each briefly; these are suggestions for me to confirm." }] }, () => undefined, { signal: request.signal });
  return Response.json({ status: result.status, matches: result.activityMatches ?? [], result });
}
