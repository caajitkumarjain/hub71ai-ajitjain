import { z } from "zod";
import { adminCookie, createAdminSession, passcodeMatches, sameOrigin, sessionSeconds } from "@/lib/admin/auth";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed.", code: "FORBIDDEN" }, { status: 403 });
  if (!process.env.ADMIN_PASSCODE) return Response.json({ error: "Operator access is not configured.", code: "UNAVAILABLE" }, { status: 503 });
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const current = attempts.get(key);
  if (current && current.until > Date.now() && current.count >= 5) return Response.json({ error: "Too many attempts. Please try again later.", code: "RATE_LIMITED" }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON.", code: "INVALID_JSON" }, { status: 400 }); }
  const parsed = z.object({ passcode: z.string().min(1).max(200) }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter the operator passcode.", code: "INVALID_INPUT" }, { status: 400 });
  if (!passcodeMatches(parsed.data.passcode)) {
    if (attempts.size > 1000) attempts.clear();
    attempts.set(key, { count: current && current.until > Date.now() ? current.count + 1 : 1, until: Date.now() + 15 * 60 * 1000 });
    return Response.json({ error: "Passcode not recognised.", code: "UNAUTHORIZED" }, { status: 401 });
  }
  attempts.delete(key);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `${adminCookie}=${createAdminSession()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` } });
}
