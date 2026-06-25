"use server";

import { z } from "zod";
import { getSuperAdminClient } from "@/lib/supabase/auth-guard";
import { CrearUsuarioGlobalSchema } from "@/lib/validation/schemas";

const SuprimirUsuarioSchema = z.object({ uid: z.string().uuid() });

// God Mode — Monitor y alta de usuarios cross-tenant.
// SEGURIDAD: getSuperAdminClient() valida el Doble Escudo y entrega el cliente
// Service Role (omite RLS).

export interface UsuarioGlobalRow {
  uid: string;
  email: string;
  rol: string | null;
  rolGlobal: string | null;
  empresaId: number | null;
  empresaNombre: string;
  lastSignInAt: string | null;
  createdAt: string;
}

export type UsuariosGlobalResult =
  | { ok: false; error: string }
  | { ok: true; usuarios: UsuarioGlobalRow[] };

export type CrearUsuarioGlobalResult =
  | { ok: false; error: string }
  | { ok: true };

export async function listarUsuariosGlobal(): Promise<UsuariosGlobalResult> {
  let admin;
  try {
    ({ admin } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data) {
    console.error("[admin-usuarios] listUsers error:", error);
    return { ok: false, error: "No se pudieron cargar los usuarios" };
  }

  const { data: empresasData } = await admin
    .from("empresas")
    .select("empresa_id, nombre");
  const empresaMap = new Map<number, string>(
    ((empresasData as { empresa_id: number; nombre: string }[] | null) ?? []).map(
      (e) => [e.empresa_id, e.nombre]
    )
  );

  const usuarios: UsuarioGlobalRow[] = data.users.map((u) => {
    const meta = (u.app_metadata ?? {}) as {
      empresa_id?: number;
      rol?: string;
      rol_global?: string;
    };
    return {
      uid: u.id,
      email: u.email ?? "—",
      rol: meta.rol ?? null,
      rolGlobal: meta.rol_global ?? null,
      empresaId: meta.empresa_id ?? null,
      empresaNombre:
        meta.empresa_id != null
          ? empresaMap.get(meta.empresa_id) ?? `#${meta.empresa_id}`
          : "—",
      lastSignInAt: u.last_sign_in_at ?? null,
      createdAt: u.created_at,
    };
  });

  usuarios.sort((a, b) =>
    (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "")
  );

  return { ok: true, usuarios };
}

// Crea un usuario para CUALQUIER empresa (soporte). Replica el alta atómica de
// crearUsuario pero con empresa_id explícito y bajo el Doble Escudo.
export async function crearUsuarioGlobal(
  input: unknown
): Promise<CrearUsuarioGlobalResult> {
  let admin;
  let actorUid: string;
  try {
    ({ admin, uid: actorUid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const parsed = CrearUsuarioGlobalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { empresa_id, email, nombre_completo, rol } = parsed.data;

  // La empresa destino debe existir.
  const { data: empresa } = await admin
    .from("empresas")
    .select("activa")
    .eq("empresa_id", empresa_id)
    .single();
  if (!empresa) return { ok: false, error: "La empresa destino no existe" };

  // role_id ANTES de crear nada en GoTrue.
  const { data: roleData, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", rol)
    .single();
  if (roleErr || !roleData) return { ok: false, error: "Rol inválido" };

  // Crear en auth.users con app_metadata completo (primer JWT ya válido).
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    app_metadata: {
      empresa_id,
      rol,
      activo: true,
      empresa_activa: (empresa as { activa: boolean }).activa,
    },
    user_metadata: { nombre_completo },
  });
  if (authErr || !authData?.user) {
    console.error("[admin-usuarios] createUser error:", authErr);
    return {
      ok: false,
      error:
        authErr?.message === "User already registered"
          ? "Ya existe un usuario con ese email"
          : "No se pudo crear el usuario",
    };
  }

  const newUid = authData.user.id;
  try {
    const { error: dbErr } = await admin
      .from("usuarios")
      .insert({ uid: newUid, nombre_completo, empresa_id, activo: true });
    if (dbErr) throw new Error("usuarios");

    const { error: rolErr2 } = await admin
      .from("user_roles")
      .insert({ user_id: newUid, role_id: (roleData as { id: string }).id });
    if (rolErr2) throw new Error("user_roles");
  } catch (e) {
    // Rollback: GoTrue + filas parciales.
    await admin.auth.admin.deleteUser(newUid).catch(() => {});
    await admin.from("user_roles").delete().eq("user_id", newUid);
    await admin.from("usuarios").delete().eq("uid", newUid);
    console.error("[admin-usuarios] rollback crearUsuarioGlobal:", e);
    return { ok: false, error: "No se pudo completar la creación del usuario" };
  }

  await admin.from("logs_sistema").insert({
    empresa_id,
    user_id: actorUid,
    accion: "ADMIN_CREATE_USUARIO_GLOBAL",
    tabla: "usuarios",
    registro_id: newUid,
    datos_new: { email, nombre_completo, rol },
  });

  return { ok: true };
}

export type SuprimirUsuarioResult = { ok: true } | { ok: false; error: string };

// Supresión completa de un usuario: anonimiza BD vía RPC + hard-delete en auth.users.
// Solo ejecutable desde el backoffice (Doble Escudo).
export async function suprimirUsuario(input: unknown): Promise<SuprimirUsuarioResult> {
  let actorUid: string;
  let adminClient: import("@supabase/supabase-js").SupabaseClient;
  try {
    const { uid, admin } = await getSuperAdminClient();
    actorUid = uid;
    adminClient = admin;
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const parsed = SuprimirUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { uid } = parsed.data;

  // 1. RPC: anonimiza BD + limpia membresías + loguea
  const { data: rpcData, error: rpcErr } = await adminClient.rpc("suprimir_usuario", {
    p_uid: uid,
    p_actor_uid: actorUid,
  });

  if (rpcErr) {
    console.error("[admin-usuarios] suprimir_usuario RPC error:", rpcErr);
    return { ok: false, error: "Error al procesar la solicitud" };
  }

  const result = rpcData as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? "Error al procesar la solicitud" };
  }

  // 2. Hard-delete en auth.users (solo posible con service role)
  const { error: authErr } = await adminClient.auth.admin.deleteUser(uid);
  if (authErr) {
    console.error("[admin-usuarios] deleteUser error:", authErr);
    return { ok: false, error: "BD anonimizada pero falló la eliminación de auth. Revisar manualmente." };
  }

  return { ok: true };
}
