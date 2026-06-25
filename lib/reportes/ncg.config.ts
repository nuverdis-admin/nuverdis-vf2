import type { ReporteConfig } from "./types";

export const ncgConfig: ReporteConfig = {
  tipo: "NCG",
  label: "NCG",

  tareasView: "v_ncg_tareas_asignacion",
  tareasTable: "ncg_tareas",

  rpcOverview: "overview_proyecto",

  rpcGuardarRespuestas: "ncg_guardar_respuestas_tarea",
  rpcCambiarEstado:     "ncg_cambiar_estado_tarea",
  rpcEliminar:          "ncg_eliminar_tarea",
  rpcAsignacionMasiva:  "ncg_asignacion_masiva_tareas",
  rpcNoAplicaMasiva:    "ncg_no_aplica_masiva_tareas",
  rpcEliminacionMasiva: "ncg_eliminacion_masiva_tareas",

  evidenciasTable:    "ncg_evidencias",
  mensajesTable:      "ncg_tarea_mensajes",
  lecturasTable:      "ncg_tarea_lecturas",
  exclusionesTable:   "ncg_tarea_exclusiones",
  miembrosExtraTable: "ncg_tarea_miembros_extra",
  derivacionesTable:  "ncg_derivaciones",

  rpcAprobarDerivacion:  "ncg_aprobar_derivacion_con_opcion",
  rpcAprobarExclusion:   "ncg_aprobar_exclusion_con_opcion",
  rpcResolverDerivacion: "ncg_resolver_derivacion",

  viewDerivaciones: "v_ncg_derivaciones_proyecto",
  viewEquiposTab:   "v_ncg_equipos_proyecto_tab",

  estados: {
    sin_asignar: { label: "Sin asignar",  badgeClass: "badge bg-gray-2 text-gray-6 whitespace-nowrap text-[11px]" },
    asignada:    { label: "Asignada",     badgeClass: "badge badge-asignada" },
    en_revision: { label: "En revisión",  badgeClass: "badge bg-secondary-2 text-secondary-7" },
    completada:  { label: "Completada",   badgeClass: "badge badge-success" },
    retornada:   { label: "Retornada",    badgeClass: "badge badge-critique" },
    no_aplica:   { label: "No aplica",    badgeClass: "badge bg-gray-1 text-gray-4 border border-gray-3" },
  },

  logAcciones: {
    asignar:  "ASIGNAR_TAREA_NCG",
    noAplica: "NO_APLICA_TAREA_NCG",
  },
};
