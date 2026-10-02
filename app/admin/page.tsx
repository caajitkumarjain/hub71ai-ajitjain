import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookie, validAdminSession } from "@/lib/admin/auth";
import { adminStats, summarizeRuns } from "@/lib/admin/stats";
import { syntheticAssumption } from "@/lib/synthetic-cohort";
import { memoryStore } from "@/lib/store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
export const metadata = { title: "Ecosystem overview" };
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!validAdminSession((await cookies()).get(adminCookie)?.value)) redirect("/admin/login");
  const runs = memoryStore.listRuns();
  return <AdminDashboard initial={adminStats(memoryStore.listEvents(), runs)} initialRuns={summarizeRuns(runs)} assumption={syntheticAssumption} />;
}
