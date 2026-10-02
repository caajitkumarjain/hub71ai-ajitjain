import { AgentRequest } from "@/lib/agents/contracts";
import { readBody, streamAgent } from "@/lib/agents/http";
import { checkRateLimit } from "@/lib/agents/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request);
  if (limited) return limited;
  const body = await readBody(request, AgentRequest);
  return "response" in body ? body.response : streamAgent(body.data, request);
}
