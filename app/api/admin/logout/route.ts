import { adminCookie, adminDenied, requestIsAdmin, sameOrigin } from "@/lib/admin/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!requestIsAdmin(request)) return adminDenied();
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed.", code: "FORBIDDEN" }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `${adminCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` } });
}
