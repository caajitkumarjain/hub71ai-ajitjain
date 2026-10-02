import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookie, validAdminSession } from "@/lib/admin/auth";
import { AdminLoginForm } from "@/components/admin/login-form";
export const metadata = { title: "Operator access" };
export const dynamic = "force-dynamic";
export default async function AdminLoginPage() {
  if (validAdminSession((await cookies()).get(adminCookie)?.value)) redirect("/admin");
  return <AdminLoginForm configured={Boolean(process.env.ADMIN_PASSCODE)} />;
}
