"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { notificarPerfilEditado } from "@/lib/supabase/notificaciones";
import { requireAdmin, requireAdminSameTenant } from "@/lib/supabase/auth-guard";
import { devLog } from "@/lib/log";
import {
  CrearUsuarioSchema,
  EditarUsuarioSchema,
  EliminarUsuarioSchema,
} from "@/lib/validation/schemas";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ActionResult = { ok: true } | { error: string };

interface UsuarioCreado {
  uid: string;
  email: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
}

// --- crearUsuario ---
export async function crearUsuario(rawInput: {
  email: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
}): Promise<{ ok: true; usuario: UsuarioCreado } | { error: string }> {
  // HIGH-4: validar shape/longitud/formato antes de tocar la BD o GoTrue.
  const parsed = CrearUsuarioSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Datos inválidos" };
  const formData = parsed.data;

  const supabase = await createClient();
  const admin = getAdminClient();

  let empresaId: number;
  try {
    const actor = await requireAdmin();
    empresaId = actor.empresaId;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado" };
  }

  // 0. Email único
  const { data: existingUser } = await supabase
    .from("usuarios")
    .select("uid")
    .eq("email", formData.email)
    .maybeSingle();

  if (existingUser) return { error: "Email ya existe" };

  // 1. Resolver role_id ANTES de crear nada en GoTrue.
  // Si el rol es inválido, abortamos sin haber creado un usuario huérfano.
  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", formData.rol)
    .single();

  if (roleError || !roleData) {
    console.error("[crearUsuario] role error:", roleError);
    return { error: "Rol inválido" };
  }

  // 2. Crear en auth.users con app_metadata completo en la MISMA petición.
  // Inyectar empresa_id/rol/activo/empresa_activa aquí (en vez de un update
  // posterior) elimina la condición de carrera y garantiza que el primer JWT
  // del usuario ya sea válido para login. empresa_activa es true porque
  // requireAdmin() ya validó que la empresa del actor está activa.
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: formData.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      app_metadata: {
        empresa_id: empresaId,
        rol: formData.rol,
        activo: formData.activo,
        empresa_activa: true,
      },
      user_metadata: {
        nombre_completo: formData.nombre_completo,
      },
    });

  if (authError || !authData?.user) {
    console.error("[crearUsuario] auth error:", authError);
    return {
      error:
        authError?.message === "User already registered"
          ? "Email ya existe"
          : "Error al crear usuario",
    };
  }

  const newUid = authData.user.id;

  // 3. Persistir en public.usuarios + user_roles con rollback atómico.
  // Si cualquier paso falla, se elimina el usuario de GoTrue y toda fila
  // parcial en BD para no dejar registros huérfanos.
  try {
    const { error: dbError } = await supabase.from("usuarios").insert({
      uid: newUid,
      nombre_completo: formData.nombre_completo,
      empresa_id: empresaId,
      activo: formData.activo,
    });
    if (dbError) {
      console.error("[crearUsuario] db error:", dbError);
      throw new Error("Error al crear usuario en BD");
    }

    const { error: rolInsertError } = await supabase
      .from("user_roles")
      .insert({ user_id: newUid, role_id: roleData.id });
    if (rolInsertError) {
      console.error("[crearUsuario] role insert error:", rolInsertError);
      throw new Error("Error al asignar rol");
    }
  } catch (e) {
    // Rollback manual: GoTrue + filas parciales (cliente admin → sin RLS).
    const { error: rbAuth } = await admin.auth.admin.deleteUser(newUid);
    if (rbAuth) console.error("[crearUsuario] rollback auth:", rbAuth.message);

    const { error: rbRoles } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", newUid);
    if (rbRoles) console.error("[crearUsuario] rollback user_roles:", rbRoles.message);

    const { error: rbUsuarios } = await admin
      .from("usuarios")
      .delete()
      .eq("uid", newUid);
    if (rbUsuarios) console.error("[crearUsuario] rollback usuarios:", rbUsuarios.message);

    return { error: e instanceof Error ? e.message : "Error al crear usuario" };
  }

  // 4. Log auditoría
  const { error: logErrorCrear } = await supabase.rpc("log_usuario_accion", {
    p_accion: "CREATE_USUARIO",
    p_tabla: "usuarios",
    p_registro_id: newUid,
    p_datos_prev: null,
    p_datos_new: {
      nombre: formData.nombre_completo,
      rol: formData.rol,
      activo: formData.activo,
    },
  });
  if (logErrorCrear) console.error("[crearUsuario] log error:", logErrorCrear.message);

  return { ok: true, usuario: { uid: newUid, ...formData } };
}

// --- editarUsuario ---
interface UsuarioAnteriorRow {
  nombre_completo: string;
  activo: boolean;
  user_roles: Array<{ roles: { name: string } | null }> | null;
}

export async function editarUsuario(
  rawUid: string,
  rawDatos: { nombre_completo: string; rol: string; activo: boolean }
): Promise<ActionResult> {
  // HIGH-4: validar shape/longitud/formato del input.
  const parsed = EditarUsuarioSchema.safeParse({ uid: rawUid, datos: rawDatos });
  if (!parsed.success) return { error: "Datos inválidos" };
  const { uid, datos } = parsed.data;

  const supabase = await createClient();

  // Doble verificación: admin + target en la misma empresa.
  // Bloquea ataques cross-tenant antes de que el Service Role actúe.
  try {
    await requireAdminSameTenant(uid);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado" };
  }

  // 1. Datos actuales
  const { data: raw, error: fetchError } = await supabase
    .from("usuarios")
    .select("nombre_completo, activo, user_roles(roles(name))")
    .eq("uid", uid)
    .single();

  if (fetchError || !raw) return { error: "Usuario no encontrado" };

  const anterior = raw as unknown as UsuarioAnteriorRow;

  // 2. Actualizar tabla usuarios
  const { error: updateError } = await supabase
    .from("usuarios")
    .update({ nombre_completo: datos.nombre_completo, activo: datos.activo })
    .eq("uid", uid);

  if (updateError) {
    // HIGH-2: loguear el error real en servidor, devolver mensaje genérico al cliente.
    console.error("[editarUsuario] update error:", updateError);
    return { error: "Error al procesar la solicitud" };
  }

  // 3. Actualizar rol si cambió
  const rolActual = anterior.user_roles?.[0]?.roles?.name ?? null;

  if (datos.rol !== rolActual) {
    const { data: roleData, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("name", datos.rol)
      .single();

    if (roleError || !roleData) return { error: "Rol inválido" };

    await supabase.from("user_roles").delete().eq("user_id", uid);

    const { error: rolInsertError } = await supabase
      .from("user_roles")
      .insert({ user_id: uid, role_id: roleData.id });

    if (rolInsertError) {
      console.error("[editarUsuario] role insert error:", rolInsertError);
      return { error: "Error al actualizar rol" };
    }
  }

  // 4. Log auditoría
  const { error: logErrorEditar } = await supabase.rpc("log_usuario_accion", {
    p_accion: "UPDATE_USUARIO",
    p_tabla: "usuarios",
    p_registro_id: uid,
    p_datos_prev: {
      nombre: anterior.nombre_completo,
      rol: rolActual,
      activo: anterior.activo,
    },
    p_datos_new: {
      nombre: datos.nombre_completo,
      rol: datos.rol,
      activo: datos.activo,
    },
  });
  if (logErrorEditar) console.error("[editarUsuario] log error:", logErrorEditar.message);

  // 5. Notificación al usuario afectado (fire-and-forget)
  void notificarPerfilEditado(uid, datos.nombre_completo).catch((err) =>
    console.error("[editarUsuario] notif error:", err)
  );

  // HIGH-3: sin nombre del usuario en logs de producción (PII).
  devLog(`[editarUsuario] UPDATE_USUARIO ok — activo: ${datos.activo}`);

  return { ok: true };
}

// --- eliminarUsuario (soft delete) ---
interface UsuarioParaLog {
  nombre_completo: string;
  activo: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  motivo_baja?: string | null;
}

export async function eliminarUsuario(
  rawUid: string,
  rawMotivo?: string
): Promise<ActionResult> {
  // HIGH-4: validar shape/longitud/formato del input.
  const parsed = EliminarUsuarioSchema.safeParse({
    uid: rawUid,
    motivo_baja: rawMotivo,
  });
  if (!parsed.success) return { error: "Datos inválidos" };
  const { uid, motivo_baja } = parsed.data;

  const supabase = await createClient();
  const admin = getAdminClient();

  // Doble verificación: admin + target en la misma empresa.
  // Sin este chequeo, el Service Role permitiría desactivar usuarios de
  // OTRAS empresas (cross-tenant takeover via admin.auth.admin.updateUserById).
  let currentUid: string;
  try {
    const actor = await requireAdminSameTenant(uid);
    currentUid = actor.uid;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado" };
  }

  if (uid === currentUid) return { error: "No puedes eliminarte a ti mismo" };

  // 1. Datos actuales para log
  const { data: raw, error: fetchError } = await supabase
    .from("usuarios")
    .select("nombre_completo, activo")
    .eq("uid", uid)
    .single();

  if (fetchError || !raw) return { error: "Usuario no encontrado" };

  const u = raw as UsuarioParaLog;
  const deletedAt = new Date().toISOString();

  // 2. Obtener email del auth user para snapshot
  const { data: authUser } = await admin.auth.admin.getUserById(uid);
  const emailSnapshot = authUser.user?.email ?? null;

  // 3. Soft delete en DB
  const { error: updateError } = await supabase
    .from("usuarios")
    .update({
      activo: false,
      deleted_at: deletedAt,
      deleted_by: currentUid,
      email_snapshot: emailSnapshot,
      ...(motivo_baja ? { motivo_baja } : {}),
    })
    .eq("uid", uid);

  if (updateError) {
    console.error("[eliminarUsuario] update error:", updateError);
    return { error: "Error al desactivar usuario" };
  }

  // 3. Invalidar acceso futuro (app_metadata.activo = false → JWT siguiente será bloqueado)
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(uid, {
    app_metadata: { activo: false },
  });
  if (authUpdateError) {
    console.error("[eliminarUsuario] auth update error:", authUpdateError);
  }

  // 4. Log auditoría
  const { error: logError } = await supabase.rpc("log_usuario_accion", {
    p_accion: "SOFT_DELETE_USUARIO",
    p_tabla: "usuarios",
    p_registro_id: uid,
    p_datos_prev: {
      uid,
      nombre_completo: u.nombre_completo,
      activo: u.activo,
    },
    p_datos_new: {
      activo: false,
      deleted_at: deletedAt,
      deleted_by: currentUid,
    },
  });
  if (logError) console.error("[eliminarUsuario] log error:", logError.message);

  // HIGH-3: sin nombre del usuario en logs de producción (PII).
  devLog("[eliminarUsuario] SOFT_DELETE_USUARIO ok");

  return { ok: true };
}
