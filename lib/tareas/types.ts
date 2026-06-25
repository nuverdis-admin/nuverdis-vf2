// Tipos compartidos del módulo Detalle de Tarea (GRI Fase 1 + Fase 2).

export type EstadoTarea =
  | "sin_asignar"
  | "asignada"
  | "en_revision"
  | "completada"
  | "retornada"
  | "no_aplica";

// Estructura del JSONB `respuestas` en gri_tareas.
// Clave = letra del requerimiento (a, b, c, …).
export interface RespuestaLetra {
  aplica: boolean;
  contenido: string;
  borrador: string;
}

export type RespuestasMap = Record<string, RespuestaLetra>;

export interface RequerimientoItem {
  letra: string;
  requerimiento_letra: string;
  orientacion?: string | null;
  tabla?: string | null;
  // NCG: nombre del sub-tema (nivel 3) que agrupa la letra. null = va directo a la letra.
  subtema_nombre?: string | null;
}

export interface MiembroEquipo {
  user_id: string;
  nombre_completo: string;
  rol: string | null;
  tipo_miembro?: "normal" | "temporal" | "excluido";
}

export interface EvidenciaRow {
  evidencia_id: number;
  public_id: string;
  tarea_id: number;
  empresa_id: number;
  proyecto_id: number;
  path: string;
  nombre_archivo: string;
  mime_type: string | null;
  size_bytes: number;
  extension: string | null;
  uploader_uid: string;
  uploader_nombre: string | null;
  created_at: string;
}

export interface ChatMensaje {
  mensaje_id: number;
  tarea_id: number;
  uid: string;
  nombre: string;
  contenido: string;
  created_at: string;
}

export interface PresenciaUser {
  uid: string;
  nombre: string;
  rol: string;
  joined_at: string;
}

export interface GriTableRow {
  label: string;
  cells: Record<string, string>;
}

export interface GriTableData {
  rows: GriTableRow[];
  dynamicColumns?: string[];
  // Data de la tabla secundaria (config.extraTableId). Mismo JSON, sin colisión
  // con `rows`. undefined si la tabla no tiene secundaria o aún no se editó.
  extra?: GriTableData;
}

export interface TareaDetalle {
  tarea_id: number;
  public_id: string;
  proyecto_id: number;
  empresa_id: number;
  equipo_id: number | null;
  equipo_nombre: string | null;
  estado: EstadoTarea;
  version: number;
  aprobado_admin: boolean;
  instruccion: string | null;
  motivo_rechazo: string | null;
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

  requerimientos: RequerimientoItem[];
  respuestas: RespuestasMap;
}
