// ── NCG ───────────────────────────────────────────────────────────────────────

export interface NcgReporteData {
  empresa: { empresa_id: number; ref: string; nombre: string; icono: string | null };
  proyecto: {
    proyecto_id: number;
    ref: string;
    nombre_proyecto: string;
    anio_reporte: number;
    estado: string;
  };
  generado_at: string;
  generado_por: string;
  items: NcgReporteItem[];
}

export interface NcgReporteItem {
  tarea_id: number;
  estado: "completada" | "no_aplica";
  estandar: number;
  estandar_nombre: string;
  jerarquia_real: string;
  jerarquia_1: string;
  jerarquia_1_nombre: string;
  jerarquia_2: number;
  jerarquia_2_nombre: string | null;
  respuestas: Record<string, { aplica: boolean; contenido: string; borrador?: string }>;
  requerimientos: Array<{
    letra: string;
    requerimiento_letra: string;
    subtema_nombre: string | null;
    orientacion: string | null;
    tabla: string | null;
  }>;
}

// ── GRI ───────────────────────────────────────────────────────────────────────

export interface ReporteData {
  empresa: { empresa_id: number; ref: string; nombre: string; icono: string | null };
  proyecto: {
    proyecto_id: number;
    ref: string;
    nombre_proyecto: string;
    anio_reporte: number;
    estado: string;
  };
  generado_at: string;
  generado_por: string;
  items: ReporteItem[];
}

export interface ReporteItem {
  tarea_id: number;
  estado: "completada" | "no_aplica";
  estandar: string;
  jerarquia_1: number;
  jerarquia_1_nombre: string;
  jerarquia_2: number;
  jerarquia_2_nombre: string;
  respuestas: Record<string, { aplica: boolean; contenido: string; borrador?: string }>;
  requerimientos: Array<{
    letra: string;
    requerimiento_letra: string;
    orientacion: string | null;
    tabla: string | null;
  }>;
}
