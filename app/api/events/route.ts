import { randomUUID } from "node:crypto";
import { FounderEventInput, memoryStore } from "@/lib/store";
import { readBody } from "@/lib/agents/http";
import { steps } from "@/lib/engines/seed-data";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, FounderEventInput);
  if ("response" in body) return body.response;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("manzil_founder="))?.slice("manzil_founder=".length);
  const founderId = cookie && /^[\da-f-]{36}$/i.test(cookie) ? cookie : randomUUID();
  const event = body.data;
  // Authority and lane belong to the seeded step, never to caller-supplied labels.
  const step = event.type === "duration_report" ? steps.find((item) => item.id === event.stepId)! : undefined;
  memoryStore.appendEvent({ ...event, ...(step ? { authority: step.authority, lane: step.lane } : {}), id: randomUUID(), founderId, ts: new Date().toISOString() });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `manzil_founder=${founderId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` } });
}
