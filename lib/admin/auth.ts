import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const adminCookie = "manzil_admin";
export const sessionSeconds = 8 * 60 * 60;

export function passcodeMatches(candidate: string, expected = process.env.ADMIN_PASSCODE): boolean {
  if (!expected) return false;
  return timingSafeEqual(createHash("sha256").update(candidate).digest(), createHash("sha256").update(expected).digest());
}

export function createAdminSession(secret = process.env.ADMIN_PASSCODE, now = Date.now()): string {
  if (!secret) throw new Error("Admin access is not configured.");
  const body = `${now + sessionSeconds * 1000}.${randomBytes(16).toString("hex")}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function validAdminSession(value: string | undefined, secret = process.env.ADMIN_PASSCODE, now = Date.now()): boolean {
  if (!secret || !value || !/^\d+\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expiry, nonce, signature] = value.split(".");
  if (Number(expiry) <= now || Number(expiry) > now + sessionSeconds * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${expiry}.${nonce}`).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

export function requestIsAdmin(request: Request): boolean {
  const value = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${adminCookie}=`))?.slice(adminCookie.length + 1);
  return validAdminSession(value);
}

export function adminDenied(): Response {
  return Response.json({ error: "Operator sign-in is required.", code: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
