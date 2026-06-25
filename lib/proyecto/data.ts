import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { OverviewStats } from "@/lib/reportes/types";

export interface EmpresaPublic {
  empresa_id: string;
  ref: string;
  nombre: string;
}

export interface ProyectoServer {
  proyecto_id: string;
  ref: string;
  nombre_proyecto: string;
  anio_reporte: number;
  estado: string;
  empresa_id: string;
  cerrado_at: string | null;
  archivado_at: string | null;
}

export interface ReporteHabilitado {
  proyecto_reporte_id: string;
  reporte_id: string;
  tipo_reporte: string;
}

interface ProyectoReporteRow {
  proyecto_reporte_id: string;
  reporte_id: string;
  reportes: { tipo_reporte: string } | null;
}

// Una sola lectura por request gracias a React.cache().

export const getCurrentEmpresa = cache(async (): Promise<EmpresaPublic | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empresaId = (user?.app_metadata as { empresa_id?: string } | undefined)?.empresa_id;
  if (!empresaId) return null;
  const { data } = await supabase
    .from("empresas_public")
    .select("empresa_id, ref, nombre")
    .eq("empresa_id", empresaId)
    .single();
  return (data as EmpresaPublic) ?? null;
});

export const getProyectoByRef = cache(async (ref: string): Promise<ProyectoServer | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proyectos")
    .select("proyecto_id, ref, nombre_proyecto, anio_reporte, estado, empresa_id, cerrado_at, archivado_at")
    .eq("ref", ref)
    .single();
  return (data as ProyectoServer) ?? null;
});

export const getReportesHabilitados = cache(
  async (proyectoId: string): Promise<ReporteHabilitado[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("proyectos_reportes")
      .select("proyecto_reporte_id, reporte_id, reportes(tipo_reporte)")
      .eq("proyecto_id", proyectoId);

    const rows = (data as ProyectoReporteRow[] | null) ?? [];
    return rows
      .filter((r) => r.reportes !== null)
      .map((r) => ({
        proyecto_reporte_id: r.proyecto_reporte_id,
        reporte_id: r.reporte_id,
        tipo_reporte: r.reportes!.tipo_reporte,
      }));
  }
);

export const getConteoTareasGRI = cache(async (proyectoId: string): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("gri_tareas")
    .select("*", { count: "exact", head: true })
    .eq("proyecto_id", proyectoId);
  return count ?? 0;
});

export const getConteoTareasNCG = cache(async (proyectoId: string): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("ncg_tareas")
    .select("*", { count: "exact", head: true })
    .eq("proyecto_id", proyectoId);
  return count ?? 0;
});

export const getEquiposEmpresa = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipos")
    .select("equipo_id, nombre")
    .order("nombre");
  return data ?? [];
});

export const getOverviewStats = cache(
  async (
    proyectoId: string,
    tipoReporte: string = "GRI"
  ): Promise<{ stats: OverviewStats | null; error: string | null }> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("overview_proyecto", {
      p_proyecto_id: proyectoId,
      p_tipo_reporte: tipoReporte.toUpperCase(),
    });
    if (error) return { stats: null, error: error.message };
    const raw = Array.isArray(data) ? data[0] : data;
    return { stats: (raw as OverviewStats) ?? null, error: null };
  }
);

export interface EquipoStats {
  equipo_id: number;
  nombre: string;
  total: number;
  porEstado: {
    completada: number;
    en_revision: number;
    asignada: number;
    retornada: number;
    no_aplica: number;
    sin_asignar: number;
  };
}

export interface ActividadLog {
  log_id: number;
  accion: string;
  datos_new: Record<string, unknown> | null;
  actor: string | null;
  created_at: string;
}

export const getCargaEquipos = cache(async (proyectoId: string): Promise<EquipoStats[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_gri_tareas_asignacion")
    .select("equipo_id, equipo_nombre, estado")
    .eq("proyecto_id", proyectoId)
    .not("equipo_id", "is", null);

  if (!data) return [];

  const map = new Map<number, EquipoStats>();
  for (const row of data as { equipo_id: number; equipo_nombre: string | null; estado: string }[]) {
    if (!map.has(row.equipo_id)) {
      map.set(row.equipo_id, {
        equipo_id: row.equipo_id,
        nombre: row.equipo_nombre ?? `Equipo ${row.equipo_id}`,
        total: 0,
        porEstado: { completada: 0, en_revision: 0, asignada: 0, retornada: 0, no_aplica: 0, sin_asignar: 0 },
      });
    }
    const eq = map.get(row.equipo_id)!;
    eq.total++;
    const e = row.estado as keyof EquipoStats["porEstado"];
    if (e in eq.porEstado) eq.porEstado[e]++;
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
});

export const getActividadReciente = cache(
  async (proyectoId: string, tipoReporte = "gri"): Promise<ActividadLog[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_historial_proyecto", {
      p_proyecto_id: proyectoId,
      p_limit: 12,
      p_offset: 0,
      p_tipo_reporte: tipoReporte.toLowerCase(),
    });
    return (data as ActividadLog[]) ?? [];
  }
);

// ── Multi-reporte helpers (overview con pills GRI / NCG / …) ──────────────────

export const getOverviewStatsMulti = cache(
  async (
    proyectoId: string,
    tipos: string[]
  ): Promise<{ stats: OverviewStats | null; error: string | null }> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("overview_proyecto_multi", {
      p_proyecto_id: proyectoId,
      p_tipos: tipos,
    });
    if (error) return { stats: null, error: error.message };
    const raw = Array.isArray(data) ? data[0] : data;
    return { stats: (raw as OverviewStats) ?? null, error: null };
  }
);

export const getCargaEquiposMulti = cache(
  async (proyectoId: string, tipos: string[]): Promise<EquipoStats[]> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_carga_equipos_multi", {
      p_proyecto_id: proyectoId,
      p_tipos: tipos,
    });

    if (!data) return [];

    const map = new Map<number, EquipoStats>();
    for (const row of data as { equipo_id: number; equipo_nombre: string | null; estado: string }[]) {
      if (!map.has(row.equipo_id)) {
        map.set(row.equipo_id, {
          equipo_id: row.equipo_id,
          nombre: row.equipo_nombre ?? `Equipo ${row.equipo_id}`,
          total: 0,
          porEstado: { completada: 0, en_revision: 0, asignada: 0, retornada: 0, no_aplica: 0, sin_asignar: 0 },
        });
      }
      const eq = map.get(row.equipo_id)!;
      eq.total++;
      const e = row.estado as keyof EquipoStats["porEstado"];
      if (e in eq.porEstado) eq.porEstado[e]++;
    }

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }
);

// null p_tipo_reporte → todos los tipos (MIX); string → filtra por ese tipo
export const getActividadRecienteMulti = cache(
  async (proyectoId: string, tipos: string[]): Promise<ActividadLog[]> => {
    const supabase = await createClient();
    const tipoParam = tipos.length === 1 ? tipos[0].toLowerCase() : null;
    const { data } = await supabase.rpc("get_historial_proyecto", {
      p_proyecto_id: proyectoId,
      p_limit: 12,
      p_offset: 0,
      p_tipo_reporte: tipoParam,
    });
    return (data as ActividadLog[]) ?? [];
  }
);
