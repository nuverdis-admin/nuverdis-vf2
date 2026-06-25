"use server";

import { createClient } from "@/lib/supabase/server";
import {
  requireSession,
  assertEquipoEnEmpresa,
  assertProyectoEnEmpresa,
  type ActorContext,
} from "@/lib/supabase/auth-guard";
import {
  NotificarTareaEnviadaRevisionSchema,
  NotificarTareaRetornadaSchema,
  NotificarTareaCompletadaSchema,
} from "@/lib/validation/schemas";

interface CambioEstadoArgs {
  proyectoId: string | number;
  proyectoRef: string;
  publicId: string;
  jerarquia2Nombre: string;
  tipoReporte: string;
  equipoId: number | null;
}

interface RolRow {
  user_id: string;
  roles: { name: string } | null;
}

async function destinatariosEquipoConRol(
  equipoId: number,
  rolNombre: "encargado" | "revisor"
): Promise<string[]> {
  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", equipoId);
  const ids = ((miembros as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", ids);

  return ((rolesData as unknown as RolRow[] | null) ?? [])
    .filter((r) => r.roles?.name === rolNombre)
    .map((r) => r.user_id);
}

async function adminsEmpresa(empresaId: number): Promise<string[]> {
  const supabase = await createClient();
  // HIGH-1: filtrar por empresa. Sin este filtro la consulta devolvía
  // administradores de TODAS las empresas → fuga cross-tenant.
  const { data: usuariosEmpresa } = await supabase
    .from("usuarios")
    .select("uid")
    .eq("empresa_id", empresaId);
  const uids = ((usuariosEmpresa as { uid: string }[] | null) ?? []).map(
    (u) => u.uid
  );
  if (uids.length === 0) return [];

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", uids);
  return ((rolesData as unknown as RolRow[] | null) ?? [])
    .filter((r) => r.roles?.name === "administrador")
    .map((r) => r.user_id);
}

function linkDetalle(args: CambioEstadoArgs): string {
  const tipoLower = args.tipoReporte.toLowerCase();
  return `/dashboard/proyecto/${args.proyectoRef}/${tipoLower}/seguimiento/${args.publicId}`;
}

export async function notificarTareaEnviadaRevision(args: CambioEstadoArgs): Promise<void> {
  if (!args.equipoId) return;
  if (!NotificarTareaEnviadaRevisionSchema.safeParse(args).success) return;
  // HIGH-1: cerrar IDOR — equipo y proyecto deben pertenecer a la empresa del actor.
  let actor: ActorContext;
  try {
    actor = await requireSession();
    await assertEquipoEnEmpresa(args.equipoId, actor.empresaId);
    await assertProyectoEnEmpresa(args.proyectoId, actor.empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const [revisores, admins] = await Promise.all([
    destinatariosEquipoConRol(args.equipoId, "revisor"),
    adminsEmpresa(actor.empresaId),
  ]);
  const userIds = Array.from(new Set([...revisores, ...admins]));
  if (userIds.length === 0) return;

  await supabase.rpc("crear_notificacion", {
    p_user_ids: userIds,
    p_tipo: "TAREA_ENVIADA_REVISION",
    p_titulo: "Tarea enviada a revisión",
    p_mensaje: `Tarea pendiente de revisar: ${args.jerarquia2Nombre}`,
    p_datos: { proyecto_id: args.proyectoId, link: linkDetalle(args) },
  });
}

export async function notificarTareaRetornada(
  args: CambioEstadoArgs & { motivo: string }
): Promise<void> {
  if (!args.equipoId) return;
  if (!NotificarTareaRetornadaSchema.safeParse(args).success) return;
  // HIGH-1: cerrar IDOR — equipo y proyecto deben pertenecer a la empresa del actor.
  let actor: ActorContext;
  try {
    actor = await requireSession();
    await assertEquipoEnEmpresa(args.equipoId, actor.empresaId);
    await assertProyectoEnEmpresa(args.proyectoId, actor.empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const [encargados, admins] = await Promise.all([
    destinatariosEquipoConRol(args.equipoId, "encargado"),
    adminsEmpresa(actor.empresaId),
  ]);
  const userIds = Array.from(new Set([...encargados, ...admins]));
  if (userIds.length === 0) return;

  await supabase.rpc("crear_notificacion", {
    p_user_ids: userIds,
    p_tipo: "TAREA_RETORNADA",
    p_titulo: "Tarea retornada",
    p_mensaje: `Se retornó la tarea ${args.jerarquia2Nombre}: ${args.motivo}`,
    p_datos: { proyecto_id: args.proyectoId, link: linkDetalle(args), motivo: args.motivo },
  });
}

export async function notificarTareaCompletada(args: CambioEstadoArgs): Promise<void> {
  if (!NotificarTareaCompletadaSchema.safeParse(args).success) return;
  // HIGH-1: cerrar IDOR — el proyecto debe pertenecer a la empresa del actor.
  let actor: ActorContext;
  try {
    actor = await requireSession();
    await assertProyectoEnEmpresa(args.proyectoId, actor.empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const admins = await adminsEmpresa(actor.empresaId);
  if (admins.length === 0) return;
  await supabase.rpc("crear_notificacion", {
    p_user_ids: admins,
    p_tipo: "TAREA_COMPLETADA",
    p_titulo: "Tarea completada",
    p_mensaje: `Aprobada la tarea ${args.jerarquia2Nombre}`,
    p_datos: { proyecto_id: args.proyectoId, link: linkDetalle(args) },
  });
}
