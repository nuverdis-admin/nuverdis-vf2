import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AppConfig, UsuarioActual, Proyecto } from "@/lib/store/auth";
import { devLog } from "@/lib/log";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface JwtAppMeta {
  empresa_id?: string;
  rol?: string;
  activo?: boolean;
  empresa_activa?: boolean;
  rol_global?: string;
}

export interface FetchGeneralResult {
  appConfig: AppConfig;
  usuarioActual: UsuarioActual;
  proyectos: Proyecto[];
}

// ── fetchGeneral ──────────────────────────────────────────────────────────────

export async function fetchGeneral(): Promise<FetchGeneralResult | null> {
  const headersList = headers();
  const tenant = headersList.get("x-tenant") ?? "nuverdis1";
  const userId = headersList.get("x-user-id");
  const userEmail = headersList.get("x-user-email");

  // HIGH-3: sin uid ni email en logs de producción (PII).
  devLog("[fetchGeneral] tenant:", tenant);

  if (!userId || !userEmail) {
    devLog("[fetchGeneral] sin headers de usuario (validación fallida) → null");
    return null;
  }

  const supabase = await createClient();

  // HIGH-5: getUser() valida firma y expiración contra GoTrue y entrega
  // app_metadata de forma segura, sin decodificar el JWT manualmente.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    devLog("[fetchGeneral] getUser() falló → null");
    return null;
  }

  const meta = (user.app_metadata ?? {}) as JwtAppMeta;

  if (!meta.activo || !meta.empresa_activa) {
    devLog("[fetchGeneral] usuario/empresa inactivo → signOut + null");
    await supabase.auth.signOut();
    return null;
  }

  const empresaId = meta.empresa_id;
  if (!empresaId) {
    devLog("[fetchGeneral] JWT no contiene empresa_id → null");
    return null;
  }

  const [empresaResult, proyectosResult, usuarioResult] = await Promise.all([
    supabase
      .from("empresas_public")
      .select("empresa_id, ref, nombre, plan, icono")
      .eq("empresa_id", empresaId)
      .single(),

    supabase
      .from("proyectos")
      .select("proyecto_id, ref, nombre_proyecto, anio_reporte, estado, archivado_at, empresa_id")
      .eq("empresa_id", empresaId)
      .order("anio_reporte", { ascending: false }),

    supabase
      .from("usuarios")
      .select("nombre_completo")
      .eq("uid", user.id)
      .single(),
  ]);

  const empresa = empresaResult.data;

  devLog("[fetchGeneral] empresa:", empresa ? "cargada" : "no encontrada");

  const proyectosData = proyectosResult.data ?? [];
  devLog(`[fetchGeneral] proyectos: ${proyectosData.length} cargados`);

  const appConfig: AppConfig = {
    empresa: {
      empresa_id: empresaId,
      ref: empresa?.ref ?? "",
      nombre: empresa?.nombre ?? "",
      plan: empresa?.plan ?? "",
      icono: empresa?.icono ?? "",
    },
    dominioShort: tenant,
    isDev: process.env.NODE_ENV === "development",
  };

  const usuarioActual: UsuarioActual = {
    uid: user.id,
    email: user.email ?? "",
    nombreCompleto: usuarioResult.data?.nombre_completo ?? "",
    empresaId,
    rol: meta.rol ?? "",
    activo: Boolean(meta.activo),
  };

  const result: FetchGeneralResult = {
    appConfig,
    usuarioActual,
    proyectos: proyectosData as Proyecto[],
  };

  return result;
}
