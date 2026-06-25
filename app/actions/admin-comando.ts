"use server";

import { getSuperAdminClient } from "@/lib/supabase/auth-guard";
import { CambiarRolSchema, MoverUsuarioSchema } from "@/lib/validation/schemas";

// God Mode — acciones de comando cross-tenant. SEGURIDAD: getSuperAdminClient()
// valida el Doble Escudo (UID + rol_global) antes de cualquier mutación.

export type ComandoResult = { ok: true } | { ok: false; error: string };
export type LogoutResult =
  | { ok: true; sesiones: number }
  | { ok: false; error: string };

// ── Acción nuclear: invalida TODAS las sesiones activas (RPC bo_force_logout_all).
export async function forceLogoutAll(): Promise<LogoutResult> {
  let admin;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const { data, error } = await admin.rpc("bo_force_logout_all");
  if (error) {
    console.error("[admin-comando] force logout error:", error);
    return { ok: false, error: "No se pudo ejecutar el cierre global" };
  }

  await admin.from("logs_sistema").insert({
    user_id: uid,
    accion: "FORCE_LOGOUT_ALL",
    tabla: "auth.sessions",
    datos_new: { sesiones_invalidadas: data },
  });

  return { ok: true, sesiones: Number(data) || 0 };
}

// ── Cambiar rol: actualiza user_roles; el trigger on_role_change_sync_claims
//    sincroniza el claim `rol` al JWT del usuario.
export async function cambiarRolUsuario(input: unknown): Promise<ComandoResult> {
  let admin;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const parsed = CambiarRolSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const { data: rol, error: rolErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", parsed.data.rol)
    .single();
  if (rolErr || !rol) return { ok: false, error: "Rol inválido" };

  await admin.from("user_roles").delete().eq("user_id", parsed.data.uid);
  const { error: insErr } = await admin
    .from("user_roles")
    .insert({ user_id: parsed.data.uid, role_id: (rol as { id: string }).id });
  if (insErr) {
    console.error("[admin-comando] cambiar rol error:", insErr);
    return { ok: false, error: "No se pudo cambiar el rol" };
  }

  await admin.from("logs_sistema").insert({
    user_id: uid,
    accion: "ADMIN_CAMBIO_ROL_USUARIO",
    tabla: "user_roles",
    registro_id: parsed.data.uid,
    datos_new: { rol: parsed.data.rol },
  });

  return { ok: true };
}

// ── Mover usuario de empresa: actualiza usuarios.empresa_id; el trigger
//    on_usuario_sync_claims sincroniza el claim `empresa_id` al JWT.
export async function moverUsuarioEmpresa(
  input: unknown
): Promise<ComandoResult> {
  let admin;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const parsed = MoverUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const { data: empresa } = await admin
    .from("empresas")
    .select("empresa_id")
    .eq("empresa_id", parsed.data.empresa_id)
    .single();
  if (!empresa) return { ok: false, error: "La empresa destino no existe" };

  const { error } = await admin
    .from("usuarios")
    .update({ empresa_id: parsed.data.empresa_id })
    .eq("uid", parsed.data.uid);
  if (error) {
    console.error("[admin-comando] mover usuario error:", error);
    return { ok: false, error: "No se pudo mover el usuario" };
  }

  await admin.from("logs_sistema").insert({
    empresa_id: parsed.data.empresa_id,
    user_id: uid,
    accion: "ADMIN_MOVER_USUARIO_EMPRESA",
    tabla: "usuarios",
    registro_id: parsed.data.uid,
    datos_new: { empresa_id: parsed.data.empresa_id },
  });

  return { ok: true };
}
