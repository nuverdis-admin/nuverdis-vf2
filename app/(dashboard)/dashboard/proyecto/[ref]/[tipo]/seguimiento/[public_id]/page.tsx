import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTareaDetalle,
  getEvidenciasTarea,
  verificarAccesoTarea,
} from "@/lib/tareas/data";
import { getCurrentEmpresa, getProyectoByRef } from "@/lib/proyecto/data";
import { getReporteConfig } from "@/lib/reportes";
import type { MiembroEquipo } from "@/lib/tareas/types";
import { TareaDetalleView } from "@/app/(dashboard)/components/tareas-detalle/TareaDetalleView";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type RolRowMin = { user_id: string; roles: { name: string } | null };
type UsuarioMin = { uid: string; nombre_completo: string | null };

async function fetchMiembrosEnriquecidos(
  sb: SupabaseClient,
  equipoId: number | null,
  tareaId: number,
  esAdmin: boolean,
  exclusionesTable: string,
  miembrosExtraTable: string
): Promise<MiembroEquipo[]> {
  if (!equipoId) return [];

  const [
    { data: normalesData },
    { data: temporalesData },
    { data: excluidosData },
  ] = await Promise.all([
    sb.from("equipo_miembros").select("user_id").eq("equipo_id", equipoId),
    sb.from(miembrosExtraTable).select("user_id").eq("tarea_id", tareaId),
    esAdmin
      ? sb.from(exclusionesTable).select("user_id").eq("tarea_id", tareaId)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const normalesIds = ((normalesData as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
  const temporalesIds = ((temporalesData as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
  const excluidosIds = ((excluidosData as { user_id: string }[] | null) ?? []).map((r) => r.user_id);

  const todosIds = Array.from(new Set([...normalesIds, ...temporalesIds, ...excluidosIds]));
  if (todosIds.length === 0) return [];

  const [{ data: usuariosData }, { data: rolesData }] = await Promise.all([
    sb.from("usuarios").select("uid, nombre_completo").in("uid", todosIds),
    sb.from("user_roles").select("user_id, roles(name)").in("user_id", todosIds),
  ]);

  const nombreMap = new Map<string, string>();
  for (const u of (usuariosData as UsuarioMin[] | null) ?? []) {
    nombreMap.set(u.uid, u.nombre_completo ?? "Sin nombre");
  }
  const rolMap = new Map<string, string>();
  for (const r of (rolesData as unknown as RolRowMin[] | null) ?? []) {
    if (r.roles?.name) rolMap.set(r.user_id, r.roles.name);
  }

  const temporalesSet = new Set(temporalesIds);
  const resultado = new Map<string, MiembroEquipo>();

  for (const id of normalesIds) {
    resultado.set(id, {
      user_id: id,
      nombre_completo: nombreMap.get(id) ?? "Sin nombre",
      rol: rolMap.get(id) ?? null,
      tipo_miembro: "normal",
    });
  }
  for (const id of temporalesIds) {
    resultado.set(id, {
      user_id: id,
      nombre_completo: nombreMap.get(id) ?? "Sin nombre",
      rol: rolMap.get(id) ?? null,
      tipo_miembro: "temporal",
    });
  }
  for (const id of excluidosIds) {
    if (!temporalesSet.has(id)) {
      const existing = resultado.get(id);
      resultado.set(id, {
        user_id: id,
        nombre_completo: nombreMap.get(id) ?? "Sin nombre",
        rol: rolMap.get(id) ?? null,
        tipo_miembro: existing?.tipo_miembro === "temporal" ? "temporal" : "excluido",
      });
    }
  }

  return Array.from(resultado.values());
}

export default async function TareaDetallePage({
  params,
}: {
  params: { ref: string; tipo: string; public_id: string };
}) {
  const config = getReporteConfig(params.tipo);
  if (!config) notFound();

  const tarea = await getTareaDetalle(params.public_id, config.tareasView, config.tareasTable);
  if (!tarea) notFound();

  // REGLA INVIOLABLE: tareas sin asignar o no aplicables son inaccesibles.
  if (tarea.estado === "sin_asignar" || tarea.estado === "no_aplica") {
    notFound();
  }

  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto || proyecto.proyecto_id.toString() !== tarea.proyecto_id.toString()) {
    notFound();
  }

  const supabase = await createClient();
  // HIGH-5: identidad y rol desde getUser() (validado por GoTrue), no del header.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const uid = user.id;
  const rol = (user.app_metadata as { rol?: string }).rol ?? "";

  const { acceso, esAdmin, esEncargado, esRevisor } = await verificarAccesoTarea(tarea, uid, rol);

  if (!acceso) {
    // No pasa la verificación estándar (no admin, no en equipo).
    // Última oportunidad: acceso temporal asignado por derivación aprobada.
    const { data: accesoTemporal } = await supabase
      .from(config.miembrosExtraTable)
      .select("id")
      .eq("tarea_id", tarea.tarea_id)
      .eq("user_id", uid)
      .maybeSingle();
    if (!accesoTemporal) notFound();
  }

  // Miembros excluidos no pueden ver el detalle de la tarea (admins siempre acceden).
  if (!esAdmin) {
    const { data: exclusion } = await supabase
      .from(config.exclusionesTable)
      .select("id")
      .eq("tarea_id", tarea.tarea_id)
      .eq("user_id", uid)
      .maybeSingle();

    if (exclusion) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-4">
          <p className="text-gray-7 font-semibold text-lg">No perteneces a esta tarea</p>
          <p className="text-gray-5 text-sm max-w-sm">
            Si crees que es un error, contacta con tu administrador.
          </p>
        </div>
      );
    }
  }

  const [miembros, evidencias, empresa] = await Promise.all([
    fetchMiembrosEnriquecidos(supabase, tarea.equipo_id, tarea.tarea_id, esAdmin, config.exclusionesTable, config.miembrosExtraTable),
    getEvidenciasTarea(tarea.tarea_id, config.evidenciasTable),
    getCurrentEmpresa(),
  ]);

  return (
    <TareaDetalleView
      key={String(tarea.version)}
      config={config}
      tarea={tarea}
      miembros={miembros}
      evidencias={evidencias}
      uid={uid}
      esAdmin={esAdmin}
      esEncargado={esEncargado}
      esRevisor={esRevisor}
      empresaRef={empresa?.ref ?? ""}
      proyectoRef={params.ref}
      proyectoNombre={proyecto.nombre_proyecto}
      tipo={params.tipo}
    />
  );
}
