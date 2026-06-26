import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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

export const getEquiposEmpresa = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipos")
    .select("equipo_id, nombre")
    .order("nombre");
  return data ?? [];
});
