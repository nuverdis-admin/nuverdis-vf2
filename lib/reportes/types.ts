// Tipos genéricos para todos los reportes (GRI / SASB / NCG / …).

export type TipoReporte = "GRI" | "SASB" | "NCG";

export interface EstadoConfig {
  label: string;
  badgeClass: string;
}

// Acciones para `log_usuario_accion` por reporte.
export interface ReporteLogAcciones {
  asignar: string;
  noAplica: string;
}

// Configuración por reporte que consumen los componentes genéricos
// (TareasTable, AsignacionesView, TareaDetalleView, etc.).
export interface ReporteConfig {
  tipo: TipoReporte;
  label: string;

  // Vista que entrega tareas + jerarquías + equipos + días restantes.
  tareasView: string;
  // Tabla raíz para UPDATE de estado/equipo/fechas + realtime subscription.
  tareasTable: string;

  // RPC común a todos los reportes (overview_proyecto agrega por estado).
  rpcOverview: string;

  // Nombres de RPCs de mutación (duplicadas por reporte para aislar GRI de NCG).
  rpcGuardarRespuestas: string;   // "guardar_respuestas_tarea" | "ncg_guardar_respuestas_tarea"
  rpcCambiarEstado: string;       // "cambiar_estado_tarea"     | "ncg_cambiar_estado_tarea"
  rpcEliminar: string;            // "eliminar_tarea"            | "ncg_eliminar_tarea"
  rpcAsignacionMasiva: string;    // "asignacion_masiva_tareas"  | "ncg_asignacion_masiva_tareas"
  rpcNoAplicaMasiva: string;      // "no_aplica_masiva_tareas"   | "ncg_no_aplica_masiva_tareas"
  rpcEliminacionMasiva: string;   // "eliminacion_masiva_tareas" | "ncg_eliminacion_masiva_tareas"

  // Tablas satélite de la tarea (espejadas por reporte para aislar GRI de NCG).
  evidenciasTable: string;     // "evidencias"            | "ncg_evidencias"
  mensajesTable: string;       // "tarea_mensajes"        | "ncg_tarea_mensajes"
  lecturasTable: string;       // "tarea_lecturas"        | "ncg_tarea_lecturas"
  exclusionesTable: string;    // "tarea_exclusiones"     | "ncg_tarea_exclusiones"
  miembrosExtraTable: string;  // "tarea_miembros_extra"  | "ncg_tarea_miembros_extra"
  derivacionesTable: string;   // "derivaciones"          | "ncg_derivaciones"

  // RPCs de derivaciones (duplicadas por reporte).
  rpcAprobarDerivacion: string;  // "aprobar_derivacion_con_opcion" | "ncg_aprobar_derivacion_con_opcion"
  rpcAprobarExclusion: string;   // "aprobar_exclusion_con_opcion"  | "ncg_aprobar_exclusion_con_opcion"
  rpcResolverDerivacion: string; // "resolver_derivacion"           | "ncg_resolver_derivacion"

  // Vistas enriquecidas para derivaciones y equipos-tab (distintas por reporte).
  viewDerivaciones: string;  // "v_derivaciones_proyecto"   | "v_ncg_derivaciones_proyecto"
  viewEquiposTab: string;    // "v_equipos_proyecto_tab"    | "v_ncg_equipos_proyecto_tab"

  // Estados y su presentación visual (badges).
  estados: Record<string, EstadoConfig>;

  // Acciones para los logs de auditoría.
  logAcciones: ReporteLogAcciones;
}

// Tipo de tarea genérico para la tabla (El Padre)
export interface TareaRow {
  tarea_id: string;
  public_id: string | null;
  proyecto_id: string;
  item_id: string;

  // -- CAMPOS SUBIDOS AQUÍ (Comunes para Tabla y Asignaciones) --
  estandar: string;
  estandar_nombre?: string;
  jerarquia_1: string;
  jerarquia_2: string;
  // -------------------------------------------------------------

  jerarquia_1_nombre: string;
  jerarquia_2_nombre: string;
  codigo_item: string | null;
  estado: string;
  equipo_id: number | null;
  equipo_nombre: string | null;
  fecha_limite: string | null;
  dias_restantes: number | null;
  esta_atrasada: boolean;
}

// Tipo extendido para la vista de asignación (El Hijo)
export interface TareaAsignacionRow extends TareaRow {
  instruccion: string | null;
  fecha_limite_encargado: string | null;
  fecha_limite_revisor: string | null;
  requerimientos: Array<{ letra: string; requerimiento_letra: string; subtema_nombre?: string | null }> | null;
  
  // ELIMINADOS DE AQUÍ: 
  // public_id, jerarquia_1, jerarquia_2 y estandar
  // porque ya los hereda automáticamente de TareaRow.
}

export interface EquipoItem {
  equipo_id: number;
  nombre: string;
}

export interface OverviewStats {
  total: number;
  sin_asignar: number;
  asignada: number;
  en_revision: number;
  completada: number;
  retornada: number;
  no_aplica: number;
  atrasadas: number;
}
