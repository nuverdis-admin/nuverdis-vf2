"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSuperAdminClient } from "@/lib/supabase/auth-guard";
import { CrearEmpresaSchema, EditarEmpresaSchema } from "@/lib/validation/schemas";

// God Mode — CRUD cross-tenant de empresas + subida de icono a Storage.
// SEGURIDAD: getSuperAdminClient() valida el Doble Escudo (UID + rol_global) y
// devuelve el cliente Service Role (omite RLS).

export interface EmpresaRow {
  empresa_id: number;
  nombre: string;
  dominio_short: string;
  plan: string;
  activa: boolean;
  ref: string;
  icono: string | null;
  pausa_activada_at: string | null;
  membresia_vence_at: string | null;
  pausa_usada_en_ciclo: boolean;
  created_at: string;
  updated_at: string;
  total_usuarios?: number;
}

export interface EmpresaDetalle extends EmpresaRow {
  total_usuarios: number;
  total_proyectos: number;
  usuarios: UsuarioEmpresaRow[];
  proyectos: ProyectoEmpresaRow[];
}

export interface UsuarioEmpresaRow {
  uid: string;
  nombre_completo: string;
  email: string;
  rol: string;
  activo: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface ProyectoEmpresaRow {
  proyecto_id: number;
  ref: string;
  nombre_proyecto: string;
  estado: string;
  anio_reporte: number;
  cerrado_at: string | null;
  archivado_at: string | null;
  created_at: string;
}

export type EmpresaDetalleResult =
  | { ok: false; error: string }
  | { ok: true; empresa: EmpresaDetalle };

const COLUMNAS =
  "empresa_id, nombre, dominio_short, plan, activa, ref, icono, pausa_activada_at, membresia_vence_at, pausa_usada_en_ciclo, created_at, updated_at";

export type EmpresasListResult =
  | { ok: false; error: string }
  | { ok: true; empresas: EmpresaRow[] };

export type EmpresaMutationResult =
  | { ok: false; error: string }
  | { ok: true; empresa: EmpresaRow };

export type IconoUploadResult =
  | { ok: false; error: string }
  | { ok: true; url: string };

const EXT_ICONO = ["svg", "png", "jpg", "jpeg", "webp"];

export async function listarEmpresas(): Promise<EmpresasListResult> {
  let admin: SupabaseClient;
  try {
    ({ admin } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const [empresasRes, conteoRes] = await Promise.all([
    admin.from("empresas").select(COLUMNAS).order("created_at", { ascending: false }),
    admin.from("usuarios").select("empresa_id").eq("activo", true),
  ]);

  if (empresasRes.error) {
    console.error("[admin-empresas] list error:", empresasRes.error);
    return { ok: false, error: "No se pudieron cargar las empresas" };
  }

  // Contar usuarios activos por empresa
  const conteoMap = new Map<number, number>();
  for (const u of (conteoRes.data ?? []) as { empresa_id: number }[]) {
    conteoMap.set(u.empresa_id, (conteoMap.get(u.empresa_id) ?? 0) + 1);
  }

  const empresas = ((empresasRes.data ?? []) as EmpresaRow[]).map((e) => ({
    ...e,
    total_usuarios: conteoMap.get(e.empresa_id) ?? 0,
  }));

  return { ok: true, empresas };
}

export async function getDetalleEmpresa(ref: string): Promise<EmpresaDetalleResult> {
  let admin: SupabaseClient;
  try {
    ({ admin } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  // Empresa base
  const { data: empresaData, error: empresaErr } = await admin
    .from("empresas")
    .select(COLUMNAS)
    .eq("ref", ref)
    .single();

  if (empresaErr || !empresaData) {
    return { ok: false, error: "Empresa no encontrada" };
  }
  const empresa = empresaData as EmpresaRow;

  // Usuarios + emails desde auth + proyectos en paralelo
  const empresaIdNum = Number(empresa.empresa_id);
  const [usuariosDBRes, authRes, proyectosRes] = await Promise.all([
    admin
      .from("usuarios")
      .select("uid, nombre_completo, activo, created_at")
      .eq("empresa_id", empresaIdNum)
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("proyectos")
      .select("proyecto_id, ref, nombre_proyecto, estado, anio_reporte, cerrado_at, archivado_at, created_at")
      .eq("empresa_id", empresaIdNum)
      .order("created_at", { ascending: false }),
  ]);


  // Mapa email + rol desde auth.users
  const authMap = new Map<string, { email: string; rol: string; last_sign_in_at: string | null }>();
  for (const u of (authRes.data?.users ?? [])) {
    const meta = (u.app_metadata ?? {}) as { empresa_id?: number; rol?: string };
    if (meta.empresa_id === empresa.empresa_id) {
      authMap.set(u.id, {
        email: u.email ?? "—",
        rol: meta.rol ?? "—",
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
  }

  const usuarios: UsuarioEmpresaRow[] = (
    (usuariosDBRes.data ?? []) as { uid: string; nombre_completo: string; activo: boolean; created_at: string }[]
  ).map((u) => {
    const auth = authMap.get(u.uid);
    return {
      uid: u.uid,
      nombre_completo: u.nombre_completo,
      email: auth?.email ?? "—",
      rol: auth?.rol ?? "—",
      activo: u.activo,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      created_at: u.created_at,
    };
  });

  const proyectos: ProyectoEmpresaRow[] = (proyectosRes.data ?? []) as ProyectoEmpresaRow[];

  return {
    ok: true,
    empresa: {
      ...empresa,
      total_usuarios: usuarios.length,
      total_proyectos: proyectos.length,
      usuarios,
      proyectos,
    },
  };
}

// Sube el icono de empresa al bucket público `icons` y devuelve su URL pública.
// Cambiamos 'file: File' por 'formData: FormData'
export async function subirIconoEmpresa(
  formData: FormData
): Promise<IconoUploadResult> {
  let admin: SupabaseClient;
  try {
    ({ admin } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  // Extraemos el archivo del FormData de forma segura en el servidor
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "El icono no puede superar 2 MB" };
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!EXT_ICONO.includes(ext)) {
    return { ok: false, error: "Formato no permitido (svg, png, jpg, webp)" };
  }

  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("icons").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    console.error("[admin-empresas] upload icono error:", error);
    return { ok: false, error: "No se pudo subir el icono" };
  }

  const { data } = admin.storage.from("icons").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

export async function crearEmpresa(
  input: unknown
): Promise<EmpresaMutationResult> {
  let admin: SupabaseClient;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const parsed = CrearEmpresaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const { data, error } = await admin
    .from("empresas")
    .insert({
      nombre: parsed.data.nombre,
      dominio_short: parsed.data.dominio_short,
      plan: parsed.data.plan,
      icono: parsed.data.icono ?? null,
    })
    .select(COLUMNAS)
    .single();

  if (error || !data) {
    console.error("[admin-empresas] create error:", error);
    return {
      ok: false,
      error:
        error?.code === "23505"
          ? "Ya existe una empresa con ese dominio"
          : "No se pudo crear la empresa",
    };
  }

  const empresa = data as EmpresaRow;
  await registrarLog(admin, uid, "CREATE_EMPRESA", empresa.empresa_id, {
    nombre: empresa.nombre,
    dominio_short: empresa.dominio_short,
    plan: empresa.plan,
  });

  return { ok: true, empresa };
}

export async function editarEmpresa(
  input: unknown
): Promise<EmpresaMutationResult> {
  let admin: SupabaseClient;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const parsed = EditarEmpresaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const { data, error } = await admin
    .from("empresas")
    .update({
      nombre: parsed.data.nombre,
      plan: parsed.data.plan,
      activa: parsed.data.activa,
      icono: parsed.data.icono ?? null,
    })
    .eq("empresa_id", parsed.data.empresa_id)
    .select(COLUMNAS)
    .single();

  if (error || !data) {
    console.error("[admin-empresas] update error:", error);
    return { ok: false, error: "No se pudo actualizar la empresa" };
  }

  const empresa = data as EmpresaRow;
  await registrarLog(admin, uid, "UPDATE_EMPRESA", empresa.empresa_id, {
    nombre: empresa.nombre,
    plan: empresa.plan,
    activa: empresa.activa,
    icono: empresa.icono,
  });

  return { ok: true, empresa };
}

export type PausaResult = { ok: true; mensaje: string } | { ok: false; error: string };

export async function activarPausaEmpresa(empresaId: number): Promise<PausaResult> {
  let admin: SupabaseClient;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const { data, error } = await admin.rpc("activar_pausa", {
    p_empresa_id: empresaId,
    p_actor_uid: uid,
  });
  if (error) {
    console.error("[admin-empresas] activar_pausa error:", error);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (result?.error) return { ok: false, error: result.error };
  return { ok: true, mensaje: "Empresa pausada correctamente" };
}

export async function reactivarPausaEmpresa(empresaId: number): Promise<PausaResult> {
  let admin: SupabaseClient;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  const { data, error } = await admin.rpc("reactivar_pausa", {
    p_empresa_id: empresaId,
    p_actor_uid: uid,
  });
  if (error) {
    console.error("[admin-empresas] reactivar_pausa error:", error);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
  const result = data as { ok?: boolean; error?: string; dias_en_pausa?: number } | null;
  if (result?.error) return { ok: false, error: result.error };
  return {
    ok: true,
    mensaje: `Empresa reactivada (estuvo ${result?.dias_en_pausa ?? 0} días en pausa).`,
  };
}

export type PurgarEmpresaResult =
  | { ok: false; error: string }
  | { ok: true; storage_files: number; storage_errors: number; uids_eliminados: number; auth_errors: string[] };

// DELETE directo en storage.objects está prohibido por Supabase (error 42501).
// Esta helper usa la Storage API para borrar archivos de una carpeta (2 niveles).
// Retorna { deleted: confirmados por la API, failed: intentados pero no confirmados }.
async function borrarCarpetaStorage(
  admin: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<{ deleted: number; failed: number }> {
  const { data: items, error: listErr } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (listErr) {
    console.error(`[purgar_storage] list ${bucket}/${prefix}:`, listErr.message);
    return { deleted: 0, failed: 1 };
  }
  if (!items?.length) return { deleted: 0, failed: 0 };

  const paths: string[] = [];
  for (const item of items) {
    if (item.id) {
      paths.push(`${prefix}/${item.name}`);
    } else {
      const { data: sub, error: subErr } = await admin.storage
        .from(bucket)
        .list(`${prefix}/${item.name}`, { limit: 1000 });
      if (subErr) {
        console.error(`[purgar_storage] list subfolder ${bucket}/${prefix}/${item.name}:`, subErr.message);
        continue;
      }
      if (sub?.length) {
        paths.push(...sub.filter((f) => f.id).map((f) => `${prefix}/${item.name}/${f.name}`));
      }
    }
  }
  if (!paths.length) return { deleted: 0, failed: 0 };

  const { data: removed, error: removeErr } = await admin.storage.from(bucket).remove(paths);
  if (removeErr) {
    console.error(`[purgar_storage] remove ${bucket}/${prefix}:`, removeErr.message);
  }
  const deletedCount = removed?.length ?? 0;
  return { deleted: deletedCount, failed: paths.length - deletedCount };
}

// Purga completa de empresa: BD (via RPC) + auth.users + Storage (via API, best-effort).
// Orden crítico: RPC primero (atómico, irreversible) → auth → storage (fallos son limpiables por el cron).
// Solo ejecutable desde el backoffice (Doble Escudo).
export async function purgarEmpresa(empresaId: number): Promise<PurgarEmpresaResult> {
  let admin: SupabaseClient;
  let uid: string;
  try {
    ({ admin, uid } = await getSuperAdminClient());
  } catch {
    return { ok: false, error: "Acceso denegado" };
  }

  // 1. Recolectar IDs ANTES del RPC — el RPC borra estas filas de la BD
  const [{ data: proyectos }, { data: tickets }, { data: usuariosRows }] = await Promise.all([
    admin.from("proyectos").select("proyecto_id").eq("empresa_id", empresaId),
    admin.from("soporte_tickets").select("id").eq("empresa_id", empresaId),
    admin.from("usuarios").select("uid").eq("empresa_id", empresaId).not("uid", "is", null),
  ]);
  const preUids: string[] = ((usuariosRows ?? []) as { uid: string }[]).map((u) => u.uid);

  // 2. Purga BD via RPC (crítico — falla rápido; storage intacto si falla)
  const { data: rpcData, error: rpcErr } = await admin.rpc("purgar_empresa", {
    p_empresa_id: empresaId,
    p_actor_uid: uid,
  });

  if (rpcErr) {
    console.error("[admin-empresas] purgar_empresa RPC error:", rpcErr);
    return { ok: false, error: "Error al procesar la solicitud" };
  }

  const result = rpcData as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false, error: (result as { error?: string } | null)?.error ?? "Error al procesar la solicitud" };
  }

  // 3. Eliminar auth.users (usa UIDs pre-consultados — usuarios ya borrado por el RPC)
  const authErrors: string[] = [];
  for (const u of preUids) {
    const { error: authErr } = await admin.auth.admin.deleteUser(u);
    if (authErr) {
      console.error(`[admin-empresas] deleteUser ${u} error:`, authErr.message);
      authErrors.push(u);
    }
  }

  // 4. Borrar Storage via API (best-effort, post-RPC — archivos huérfanos son limpiables por el cron)
  let storageFiles = 0;
  let storageErrors = 0;
  for (const { proyecto_id } of proyectos ?? []) {
    const r = await borrarCarpetaStorage(admin, "evidencias", String(proyecto_id));
    storageFiles += r.deleted;
    storageErrors += r.failed;
  }
  for (const { id } of tickets ?? []) {
    const r = await borrarCarpetaStorage(admin, "soporte-tickets", id as string);
    storageFiles += r.deleted;
    storageErrors += r.failed;
  }

  return {
    ok: true,
    storage_files: storageFiles,
    storage_errors: storageErrors,
    uids_eliminados: preUids.length - authErrors.length,
    auth_errors: authErrors,
  };
}

// Registro de auditoría en logs_sistema. No bloquea la mutación si falla.
async function registrarLog(
  admin: SupabaseClient,
  uid: string,
  accion: string,
  empresaId: number,
  datos: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("logs_sistema").insert({
    empresa_id: empresaId,
    user_id: uid,
    accion,
    tabla: "empresas",
    registro_id: String(empresaId),
    datos_prev: null,
    datos_new: datos,
  });
  if (error) console.error("[admin-empresas] log error:", error.message);
}
