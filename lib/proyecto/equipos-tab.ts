import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface TareaEquipoRow {
  tarea_id: number;
  tarea_public_id: string;
  estado: string;
  estandar: string;
  jerarquia_1: number;
  jerarquia_1_nombre: string;
  jerarquia_2: number;
  jerarquia_2_nombre: string;
  situacion?: "normal" | "excluido" | "derivado_solo_tarea";
}

export interface EquipoConTareas {
  equipo_id: number;
  equipo_nombre: string;
  esMiembro: boolean;
  tieneTareaDerivadaSinEquipo: boolean;
  tareas: TareaEquipoRow[];
}

interface ViewRow {
  equipo_id: number;
  equipo_nombre: string;
  empresa_id: string;
  tarea_id: number;
  proyecto_id: number;
  tarea_public_id: string;
  estado: string;
  estandar: string;
  jerarquia_1: number;
  jerarquia_1_nombre: string;
  jerarquia_2: number;
  jerarquia_2_nombre: string;
}

export const getEquiposTab = cache(
  async (
    proyectoId: number,
    uid: string,
    esAdmin: boolean,
    viewEquiposTab: string = "v_equipos_proyecto_tab",
    exclusionesTable: string = "tarea_exclusiones",
    miembrosExtraTable: string = "tarea_miembros_extra"
  ): Promise<EquipoConTareas[]> => {
    const supabase = await createClient();

    const { data: viewData } = await supabase
      .from(viewEquiposTab)
      .select(
        "equipo_id, equipo_nombre, empresa_id, tarea_id, proyecto_id, tarea_public_id, estado, estandar, jerarquia_1, jerarquia_1_nombre, jerarquia_2, jerarquia_2_nombre"
      )
      .eq("proyecto_id", proyectoId);

    const rows = (viewData as ViewRow[] | null) ?? [];

    if (esAdmin) {
      const equiposMap = new Map<number, EquipoConTareas>();
      for (const row of rows) {
        if (!equiposMap.has(row.equipo_id)) {
          equiposMap.set(row.equipo_id, {
            equipo_id: row.equipo_id,
            equipo_nombre: row.equipo_nombre,
            esMiembro: true,
            tieneTareaDerivadaSinEquipo: false,
            tareas: [],
          });
        }
        equiposMap.get(row.equipo_id)!.tareas.push({
          tarea_id: row.tarea_id,
          tarea_public_id: row.tarea_public_id,
          estado: row.estado,
          estandar: row.estandar,
          jerarquia_1: row.jerarquia_1,
          jerarquia_1_nombre: row.jerarquia_1_nombre,
          jerarquia_2: row.jerarquia_2,
          jerarquia_2_nombre: row.jerarquia_2_nombre,
        });
      }
      return Array.from(equiposMap.values());
    }

    // enc/rev: necesitamos membresías, exclusiones y derivaciones
    const equipoIds = Array.from(new Set(rows.map((r) => r.equipo_id)));
    const tareaIds = Array.from(new Set(rows.map((r) => r.tarea_id)));

    const [membresiasRes, exclusionesRes, derivadosRes] = await Promise.all([
      equipoIds.length > 0
        ? supabase
            .from("equipo_miembros")
            .select("equipo_id")
            .eq("user_id", uid)
            .in("equipo_id", equipoIds)
        : Promise.resolve({ data: [] }),
      tareaIds.length > 0
        ? supabase
            .from(exclusionesTable)
            .select("tarea_id")
            .eq("user_id", uid)
            .in("tarea_id", tareaIds)
        : Promise.resolve({ data: [] }),
      tareaIds.length > 0
        ? supabase
            .from(miembrosExtraTable)
            .select("tarea_id")
            .eq("user_id", uid)
            .in("tarea_id", tareaIds)
        : Promise.resolve({ data: [] }),
    ]);

    const equiposMiembro = new Set(
      ((membresiasRes.data ?? []) as { equipo_id: number }[]).map(
        (m) => m.equipo_id
      )
    );
    const tareasExcluido = new Set(
      ((exclusionesRes.data ?? []) as { tarea_id: number }[]).map(
        (e) => e.tarea_id
      )
    );
    const tareasDerivado = new Set(
      ((derivadosRes.data ?? []) as { tarea_id: number }[]).map(
        (d) => d.tarea_id
      )
    );

    const equiposMap = new Map<number, EquipoConTareas>();

    for (const row of rows) {
      const esMiembro = equiposMiembro.has(row.equipo_id);
      const esDerivadoEnTarea = tareasDerivado.has(row.tarea_id);

      // Solo incluir el equipo si el usuario es miembro O tiene una tarea derivada en él
      if (!esMiembro && !esDerivadoEnTarea) continue;

      if (!equiposMap.has(row.equipo_id)) {
        equiposMap.set(row.equipo_id, {
          equipo_id: row.equipo_id,
          equipo_nombre: row.equipo_nombre,
          esMiembro,
          tieneTareaDerivadaSinEquipo: false,
          tareas: [],
        });
      }

      const equipo = equiposMap.get(row.equipo_id)!;

      let situacion: TareaEquipoRow["situacion"] = "normal";
      if (tareasExcluido.has(row.tarea_id)) {
        situacion = "excluido";
      } else if (!esMiembro && esDerivadoEnTarea) {
        situacion = "derivado_solo_tarea";
        equipo.tieneTareaDerivadaSinEquipo = true;
      }

      equipo.tareas.push({
        tarea_id: row.tarea_id,
        tarea_public_id: row.tarea_public_id,
        estado: row.estado,
        estandar: row.estandar,
        jerarquia_1: row.jerarquia_1,
        jerarquia_1_nombre: row.jerarquia_1_nombre,
        jerarquia_2: row.jerarquia_2,
        jerarquia_2_nombre: row.jerarquia_2_nombre,
        situacion,
      });
    }

    return Array.from(equiposMap.values());
  }
);
