"use server";

import { getSuperAdminClient } from "@/lib/supabase/auth-guard";

// God Mode — estadísticas del Dashboard. SEGURIDAD: getSuperAdminClient().

export interface LoginDia {
  fecha: string;
  label: string;
  logins: number;
}
export interface AccionResumen {
  accion: string;
  total: number;
  ultima: string | null;
}
export interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  lastStatus: string | null;
  lastRun: string | null;
  lastMessage: string | null;
}

export type DashboardStatsResult =
  | { ok: false; error: string }
  | {
      ok: true;
      logins7d: LoginDia[];
      totalUsuarios: number;
      acciones: AccionResumen[];
      cron: CronJob[];
    };

interface AccionRow {
  accion: string;
  total: number;
  ultima: string | null;
}
interface CronRow {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_run: string | null;
  last_message: string | null;
}

export async function getDashboardStats(): Promise<DashboardStatsResult> {
  let admin;
  try {
    ({ admin } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  // ── Logins de los últimos 7 días (last_sign_in_at de auth.users) ──
  const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersErr || !usersData) {
    console.error("[admin-stats] listUsers error:", usersErr);
    return { ok: false, error: "No se pudieron cargar las estadísticas" };
  }

  const hoy = new Date();
  const logins7d: LoginDia[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    logins7d.push({
      fecha: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CL", {
        weekday: "short",
        day: "2-digit",
      }),
      logins: 0,
    });
  }
  for (const u of usersData.users) {
    const ts = u.last_sign_in_at;
    if (!ts) continue;
    const dia = logins7d.find((x) => x.fecha === ts.slice(0, 10));
    if (dia) dia.logins += 1;
  }

  // ── RPCs/acciones (logs_sistema, 30d) + estado de pg_cron ──
  const [accionesRes, cronRes] = await Promise.all([
    admin.rpc("bo_resumen_acciones"),
    admin.rpc("bo_cron_estado"),
  ]);

  const acciones: AccionResumen[] = (
    (accionesRes.data as AccionRow[] | null) ?? []
  ).map((r) => ({
    accion: r.accion,
    total: Number(r.total),
    ultima: r.ultima,
  }));

  const cron: CronJob[] = ((cronRes.data as CronRow[] | null) ?? []).map(
    (r) => ({
      jobid: Number(r.jobid),
      jobname: r.jobname,
      schedule: r.schedule,
      active: r.active,
      lastStatus: r.last_status,
      lastRun: r.last_run,
      lastMessage: r.last_message,
    })
  );

  return {
    ok: true,
    logins7d,
    totalUsuarios: usersData.users.length,
    acciones,
    cron,
  };
}
