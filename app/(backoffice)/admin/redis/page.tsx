import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUpstashMetrics } from "@/app/actions/upstash-metrics";
import { UpstashDashboard } from "../components/UpstashDashboard";

export default async function RedisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rolGlobal = (user?.app_metadata as { rol_global?: string } | undefined)?.rol_global ?? "";
  if (rolGlobal !== "superadmin") notFound();

  const metrics = await getUpstashMetrics();

  return <UpstashDashboard metrics={metrics} />;
}
