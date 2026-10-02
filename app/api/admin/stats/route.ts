import { adminDenied, requestIsAdmin } from "@/lib/admin/auth";
import { AdminFilter, adminStats } from "@/lib/admin/stats";
import { memoryStore } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!requestIsAdmin(request)) return adminDenied();
  const filter = AdminFilter.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!filter.success) return Response.json({ error: "Invalid filters.", code: "INVALID_INPUT" }, { status: 400 });
  return Response.json(adminStats(memoryStore.listEvents(), memoryStore.listRuns(), filter.data), { headers: { "Cache-Control": "no-store" } });
}
