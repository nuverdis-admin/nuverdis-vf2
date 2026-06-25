"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireSession, assertProyectoEnEmpresa } from "@/lib/supabase/auth-guard";
import { EvidenciaPathSchema } from "@/lib/validation/schemas";

const ALLOWED_TAREAS_TABLES = new Set(["gri_tareas", "ncg_tareas"]);

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getSignedUploadUrl(
  path: string,
  tareaId: number,
  tareasTable: string = "gri_tareas",
): Promise<{ signedUrl: string; token: string }> {
  if (!EvidenciaPathSchema.safeParse({ path, tareaId }).success) {
    throw new Error("Datos inválidos");
  }
  if (!ALLOWED_TAREAS_TABLES.has(tareasTable)) throw new Error("Datos inválidos");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: tarea } = await supabase
    .from(tareasTable)
    .select("equipo_id")
    .eq("tarea_id", tareaId)
    .single();

  if (!tarea?.equipo_id) throw new Error("Tarea sin equipo asignado");

  const rol = user.app_metadata?.rol as string | undefined;
  if (rol !== "administrador") {
    const { data: miembro } = await supabase
      .from("equipo_miembros")
      .select("user_id")
      .eq("equipo_id", tarea.equipo_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!miembro) throw new Error("Sin acceso a esta tarea");
  }

  const admin = getAdmin();
  const { data, error } = await admin.storage.from("evidencias").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[getSignedUploadUrl] storage error:", error);
    throw new Error("No se pudo generar la URL de subida");
  }
  return { signedUrl: data.signedUrl, token: data.token };
}

export async function getSignedDownloadUrl(
  path: string,
  tareaId: number,
  tareasTable: string = "gri_tareas",
): Promise<string> {
  if (!EvidenciaPathSchema.safeParse({ path, tareaId }).success) {
    throw new Error("Datos inválidos");
  }
  if (!ALLOWED_TAREAS_TABLES.has(tareasTable)) throw new Error("Datos inválidos");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: tarea } = await supabase
    .from(tareasTable)
    .select("equipo_id")
    .eq("tarea_id", tareaId)
    .single();

  const rol = user.app_metadata?.rol as string | undefined;
  if (rol !== "administrador" && tarea?.equipo_id) {
    const { data: miembro } = await supabase
      .from("equipo_miembros")
      .select("user_id")
      .eq("equipo_id", tarea.equipo_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!miembro) throw new Error("Sin acceso a esta evidencia");
  }

  const admin = getAdmin();
  const { data, error } = await admin.storage.from("evidencias").createSignedUrl(path, 60);
  if (error || !data) {
    console.error("[getSignedDownloadUrl] storage error:", error);
    throw new Error("No se pudo generar la URL de descarga");
  }
  return data.signedUrl;
}

export async function deleteFromStorage(
  path: string,
  tareaId: number,
  tareasTable: string = "gri_tareas",
): Promise<void> {
  if (!EvidenciaPathSchema.safeParse({ path, tareaId }).success) {
    throw new Error("Datos inválidos");
  }
  if (!ALLOWED_TAREAS_TABLES.has(tareasTable)) throw new Error("Datos inválidos");

  const actor = await requireSession();
  const supabase = await createClient();
  const { data: tarea } = await supabase
    .from(tareasTable)
    .select("proyecto_id")
    .eq("tarea_id", tareaId)
    .single();
  if (!tarea?.proyecto_id) throw new Error("Tarea no encontrada");
  await assertProyectoEnEmpresa(tarea.proyecto_id, actor.empresaId);

  const admin = getAdmin();
  const { error } = await admin.storage.from("evidencias").remove([path]);
  if (error) {
    console.error("[deleteFromStorage] storage error:", error);
    throw new Error("No se pudo eliminar el archivo");
  }
}
