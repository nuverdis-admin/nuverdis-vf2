import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/auth-guard";
import { getDashboardStats } from "@/app/actions/admin-stats";
import { getVercelDeployments, getResendStats } from "@/app/actions/admin-infra";
import { OverviewDashboard } from "../components/OverviewDashboard";

// God Mode — Módulo Dashboard. Server Component.
// SEGURIDAD: verifica rol_global === "superadmin" → notFound() si falla.

export const metadata = {
  title: "Dashboard · God Mode",
  robots: { index: false, follow: false },
};

export default async function OverviewPage() {
  try {
    await requireSuperadmin();
  } catch {
    notFound();
  }

  const [stats, vercel, resend] = await Promise.all([
    getDashboardStats(),
    getVercelDeployments(),
    getResendStats(),
  ]);

  return <OverviewDashboard stats={stats} vercel={vercel} resend={resend} />;
}
