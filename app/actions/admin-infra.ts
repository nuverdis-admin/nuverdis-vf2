"use server";

import { requireSuperadmin } from "@/lib/supabase/auth-guard";

// God Mode — Tab Infraestructura. Server Actions que consultan APIs externas.
//
// SEGURIDAD: toda función exige requireSuperadmin() (Doble Escudo) ANTES de
// cualquier fetch. Un fallo del guard retorna { ok: false } sin tocar las APIs.
//
// Llaves de API de PRUEBA durante el desarrollo: si la llave es fake/ausente o
// el fetch falla, la acción degrada a datos de demostración marcados con
// `demo: true` para que la UI sea verificable. Con llaves reales, `demo` = false.

export interface VercelDeployment {
  uid: string;
  name: string;
  estado: string; // READY | ERROR | BUILDING | QUEUED | CANCELED
  createdAt: number;
}

export type VercelResult =
  | { ok: false; error: string }
  | { ok: true; demo: boolean; deployments: VercelDeployment[] };

export interface ResendStats {
  enviados: number;
  entregados: number;
  rebotados: number;
}

export type ResendResult =
  | { ok: false; error: string }
  | { ok: true; demo: boolean; stats: ResendStats };

const DEPLOYMENTS_DEMO: VercelDeployment[] = [
  { uid: "dpl_demo_1", name: "nuverdis", estado: "READY", createdAt: Date.now() - 1000 * 60 * 38 },
  { uid: "dpl_demo_2", name: "nuverdis", estado: "BUILDING", createdAt: Date.now() - 1000 * 60 * 4 },
  { uid: "dpl_demo_3", name: "nuverdis", estado: "READY", createdAt: Date.now() - 1000 * 60 * 60 * 6 },
  { uid: "dpl_demo_4", name: "nuverdis", estado: "ERROR", createdAt: Date.now() - 1000 * 60 * 60 * 11 },
];

const RESEND_DEMO: ResendStats = { enviados: 150, entregados: 142, rebotados: 8 };

function esLlaveFake(v: string | undefined): boolean {
  return !v || v.trim() === "" || v.toLowerCase().startsWith("fake");
}

export async function getVercelDeployments(): Promise<VercelResult> {
  try {
    await requireSuperadmin();
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const token = process.env.VERCEL_API_TOKEN;
  if (esLlaveFake(token)) {
    return { ok: true, demo: true, deployments: DEPLOYMENTS_DEMO };
  }

  try {
    const res = await fetch("https://api.vercel.com/v6/deployments?limit=12", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[admin-infra] Vercel API status:", res.status);
      return { ok: true, demo: true, deployments: DEPLOYMENTS_DEMO };
    }
    const json = (await res.json()) as {
      deployments?: Array<{
        uid: string;
        name: string;
        state?: string;
        readyState?: string;
        created: number;
      }>;
    };
    const deployments: VercelDeployment[] = (json.deployments ?? []).map((d) => ({
      uid: d.uid,
      name: d.name,
      estado: d.state ?? d.readyState ?? "UNKNOWN",
      createdAt: d.created,
    }));
    return { ok: true, demo: false, deployments };
  } catch (err) {
    console.error("[admin-infra] Vercel fetch error:", err);
    return { ok: true, demo: true, deployments: DEPLOYMENTS_DEMO };
  }
}

export async function getResendStats(): Promise<ResendResult> {
  try {
    await requireSuperadmin();
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const key = process.env.RESEND_API_KEY;
  if (esLlaveFake(key)) {
    return { ok: true, demo: true, stats: RESEND_DEMO };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[admin-infra] Resend API status:", res.status);
      return { ok: true, demo: true, stats: RESEND_DEMO };
    }
    const json = (await res.json()) as {
      data?: Array<{ last_event?: string }>;
    };
    const emails = json.data ?? [];
    const rebotados = emails.filter((e) =>
      (e.last_event ?? "").includes("bounce")
    ).length;
    const entregados = emails.length - rebotados;
    return {
      ok: true,
      demo: false,
      stats: { enviados: emails.length, entregados, rebotados },
    };
  } catch (err) {
    console.error("[admin-infra] Resend fetch error:", err);
    return { ok: true, demo: true, stats: RESEND_DEMO };
  }
}
