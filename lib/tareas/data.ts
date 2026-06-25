import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  TareaDetalle,
  RespuestasMap,
  RequerimientoItem,
  MiembroEquipo,
  EvidenciaRow,
  EstadoTarea,
} from "./types";

interface TareaVistaRow {
  tarea_id: number;
  public_id: string;
  proyecto_id: number;
  empresa_id: number;
  equipo_id: number | null;
  equipo_nombre: string | null;
  estado: string;
  aprobado_admin: boolean;
  instruccion: string | null;
  fecha_limite: string | null;
  fecha_limite_encargado: string | null;
  fecha_limite_revisor: string | null;
  dias_restantes: number | null;
  esta_atrasada: boolean;
  estandar: string;
  jerarquia_1: number | null;
  jerarquia_1_nombre: string;
  jerarquia_2: number | null;
  jerarquia_2_nombre: string;
  requerimientos: RequerimientoItem[] | null;
}

interface TareaRowExtra {
  version: number;
  respuestas: RespuestasMap | null;
  motivo_rechazo: string | null;
}

// Vista + columnas extra de la tabla raíz (motivo_rechazo, version, respuestas).
export const getTareaDetalle = cache(async (
  publicId: string,
  tareasView: string = "v_gri_tareas_asignacion",
  tareasTable: string = "gri_tareas",
): Promise<TareaDetalle | null> => {
  const supabase = await createClient();

  const { data: vistaData, error: vistaErr } = await supabase
    .from(tareasView)
    .select(
      "tarea_id, public_id, proyecto_id, empresa_id, equipo_id, equipo_nombre, estado, aprobado_admin, instruccion, fecha_limite, fecha_limite_encargado, fecha_limite_revisor, dias_restantes, esta_atrasada, estandar, jerarquia_1, jerarquia_1_nombre, jerarquia_2, jerarquia_2_nombre, requerimientos"
    )
    .eq("public_id", publicId)
    .maybeSingle();
  if (vistaErr || !vistaData) return null;
  const vista = vistaData as TareaVistaRow;

  const { data: extraData, error: extraErr } = await supabase
    .from(tareasTable)
    .select("version, respuestas, motivo_rechazo")
    .eq("public_id", publicId)
    .maybeSingle();
  if (extraErr || !extraData) return null;
  const extra = extraData as TareaRowExtra;

  return {
    tarea_id: vista.tarea_id,
    public_id: vista.public_id,
    proyecto_id: vista.proyecto_id,
    empresa_id: vista.empresa_id,
    equipo_id: vista.equipo_id,
    equipo_nombre: vista.equipo_nombre,
    estado: vista.estado as EstadoTarea,
    version: extra.version,
    aprobado_admin: vista.aprobado_admin,
    instruccion: vista.instruccion,
    motivo_rechazo: extra.motivo_rechazo,
    fecha_limite: vista.fecha_limite,
    fecha_limite_encargado: vista.fecha_limite_encargado,
    fecha_limite_revisor: vista.fecha_limite_revisor,
    dias_restantes: vista.dias_restantes,
    esta_atrasada: vista.esta_atrasada,
    estandar: vista.estandar,
    jerarquia_1: vista.jerarquia_1,
    jerarquia_1_nombre: vista.jerarquia_1_nombre,
    jerarquia_2: vista.jerarquia_2,
    jerarquia_2_nombre: vista.jerarquia_2_nombre,
    requerimientos: vista.requerimientos ?? [],
    respuestas: extra.respuestas ?? {},
  };
});

interface RolRowMin {
  user_id: string;
  roles: { name: string } | null;
}

export const getMiembrosEquipo = cache(async (equipoId: number): Promise<MiembroEquipo[]> => {
  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", equipoId);

  const userIds = ((miembros as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const [{ data: usuariosData }, { data: rolesData }] = await Promise.all([
    supabase.from("usuarios").select("uid, nombre_completo").in("uid", userIds),
    supabase.from("user_roles").select("user_id, roles(name)").in("user_id", userIds),
  ]);

  const nombreMap = new Map<string, string>();
  for (const u of (usuariosData as { uid: string; nombre_completo: string | null }[] | null) ?? []) {
    nombreMap.set(u.uid, u.nombre_completo ?? "Sin nombre");
  }

  const rolMap = new Map<string, string>();
  for (const r of (rolesData as unknown as RolRowMin[] | null) ?? []) {
    if (r.roles?.name) rolMap.set(r.user_id, r.roles.name);
  }

  return userIds.map((uid) => ({
    user_id: uid,
    nombre_completo: nombreMap.get(uid) ?? "Sin nombre",
    rol: rolMap.get(uid) ?? null,
  }));
});

// Verifica si el usuario actual tiene acceso a la tarea.
// Reglas:
// - Admin de la empresa → acceso siempre.
// - Si no es admin: debe estar en equipo_miembros del equipo asignado.
export async function verificarAccesoTarea(
  tarea: TareaDetalle,
  uid: string,
  rol: string
): Promise<{ acceso: boolean; esAdmin: boolean; esEncargado: boolean; esRevisor: boolean }> {
  const esAdmin = rol === "administrador";
  if (esAdmin) return { acceso: true, esAdmin: true, esEncargado: false, esRevisor: false };

  if (!tarea.equipo_id) {
    return { acceso: false, esAdmin: false, esEncargado: false, esRevisor: false };
  }

  const supabase = await createClient();
  const { data: miembro } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", tarea.equipo_id)
    .eq("user_id", uid)
    .maybeSingle();

  if (!miembro) {
    return { acceso: false, esAdmin: false, esEncargado: false, esRevisor: false };
  }

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", uid);

  const nombres = new Set<string>(
    ((rolesData as unknown as Array<{ roles: { name: string } | null }>) ?? [])
      .map((r) => r.roles?.name)
      .filter((n): n is string => !!n)
  );

  const esEncargado = nombres.has("encargado") || rol === "encargado";
  const esRevisor = nombres.has("revisor") || rol === "revisor";

  return { acceso: true, esAdmin: false, esEncargado, esRevisor };
}

export const getEvidenciasTarea = cache(async (tareaId: number, evidenciasTable: string = "evidencias"): Promise<EvidenciaRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from(evidenciasTable)
    .select(
      "evidencia_id, public_id, tarea_id, empresa_id, proyecto_id, path, nombre_archivo, mime_type, size_bytes, extension, uploader_uid, uploader_nombre, created_at"
    )
    .eq("tarea_id", tareaId)
    .order("created_at", { ascending: false });
  return (data as EvidenciaRow[] | null) ?? [];
});
