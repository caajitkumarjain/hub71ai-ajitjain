import { adminDenied, requestIsAdmin } from "@/lib/admin/auth";
import { summarizeRuns } from "@/lib/admin/stats";
import { memoryStore } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!requestIsAdmin(request)) return adminDenied();
  return Response.json({ runs: summarizeRuns(memoryStore.listRuns()) }, { headers: { "Cache-Control": "no-store" } });
}
