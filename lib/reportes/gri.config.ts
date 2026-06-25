import type { ReporteConfig } from "./types";

export const griConfig: ReporteConfig = {
  tipo: "GRI",
  label: "GRI",

  tareasView: "v_gri_tareas_asignacion",
  tareasTable: "gri_tareas",

  rpcOverview: "overview_proyecto",

  rpcGuardarRespuestas: "guardar_respuestas_tarea",
  rpcCambiarEstado:     "cambiar_estado_tarea",
  rpcEliminar:          "eliminar_tarea",
  rpcAsignacionMasiva:  "asignacion_masiva_tareas",
  rpcNoAplicaMasiva:    "no_aplica_masiva_tareas",
  rpcEliminacionMasiva: "eliminacion_masiva_tareas",

  evidenciasTable:    "evidencias",
  mensajesTable:      "tarea_mensajes",
  lecturasTable:      "tarea_lecturas",
  exclusionesTable:   "tarea_exclusiones",
  miembrosExtraTable: "tarea_miembros_extra",
  derivacionesTable:  "derivaciones",

  rpcAprobarDerivacion:  "aprobar_derivacion_con_opcion",
  rpcAprobarExclusion:   "aprobar_exclusion_con_opcion",
  rpcResolverDerivacion: "resolver_derivacion",

  viewDerivaciones: "v_derivaciones_proyecto",
  viewEquiposTab:   "v_equipos_proyecto_tab",

  estados: {
    sin_asignar: { label: "Sin asignar",  badgeClass: "badge bg-gray-2 text-gray-6 whitespace-nowrap text-[11px]" },
    asignada:    { label: "Asignada",     badgeClass: "badge badge-asignada" },
    en_revision: { label: "En revisión",  badgeClass: "badge bg-secondary-2 text-secondary-7" },
    completada:  { label: "Completada",   badgeClass: "badge badge-success" },
    retornada:   { label: "Retornada",    badgeClass: "badge badge-warning" },
    no_aplica:   { label: "No aplica",    badgeClass: "badge bg-gray-1 text-gray-4 border border-gray-3" },
  },

  logAcciones: {
    asignar:  "ASIGNAR_TAREA",
    noAplica: "NO_APLICA_TAREA",
  },
};
