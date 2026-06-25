// Matriz de permisos del módulo Detalle de Tarea.
// Reglas espejo de las RPCs `guardar_respuestas_tarea` y `cambiar_estado_tarea`,
// pero aplicadas en cliente para habilitar/deshabilitar UI.

import type { EstadoTarea, RespuestasMap, TareaDetalle, EvidenciaRow } from "./types";

export interface PermisoCtx {
  uid: string;
  tarea: TareaDetalle;
  esAdmin: boolean;
  esEncargado: boolean;
  esRevisor: boolean;
  adminModoEdicion: boolean;
}

export function tieneContenido(respuestas: RespuestasMap): boolean {
  return Object.values(respuestas).some(
    (r) => r?.aplica === true && (r.contenido?.trim().length ?? 0) > 0
  );
}

export function canEditarRespuestas(ctx: PermisoCtx): boolean {
  const estado = ctx.tarea.estado;
  if (
    estado === "completada" ||
    estado === "sin_asignar" ||
    estado === "no_aplica" ||
    estado === "en_revision"
  ) return false;
  if (ctx.esAdmin) return ctx.adminModoEdicion;
  if (!ctx.esEncargado) return false;
  return estado === "asignada" || estado === "retornada";
}

export function canEnviarRevision(ctx: PermisoCtx, respuestas: RespuestasMap): boolean {
  if (ctx.esAdmin && !ctx.adminModoEdicion) return false;
  if (!ctx.esEncargado && !(ctx.esAdmin && ctx.adminModoEdicion)) return false;
  const estado = ctx.tarea.estado;
  if (estado !== "asignada" && estado !== "retornada") return false;
  return tieneContenido(respuestas);
}

export function canAprobar(ctx: PermisoCtx, respuestas: RespuestasMap): boolean {
  if (ctx.tarea.estado !== "en_revision") return false;
  if (!ctx.esRevisor) return false;
  return tieneContenido(respuestas);
}

export function canRechazar(ctx: PermisoCtx, respuestas: RespuestasMap): boolean {
  return canAprobar(ctx, respuestas);
}

export function canAprobarAdmin(ctx: PermisoCtx, respuestas: RespuestasMap): boolean {
  if (!ctx.esAdmin || !ctx.adminModoEdicion) return false;
  const e: EstadoTarea = ctx.tarea.estado;
  if (e === "en_revision" || e === "completada" || e === "sin_asignar" || e === "no_aplica") return false;
  return tieneContenido(respuestas);
}

export function canEliminar(ctx: PermisoCtx): boolean {
  return ctx.esAdmin;
}

// Evidencias: subida, borrado y descarga permitidos en todos los estados activos.
// No se bloquea por estado — solo por rol.
export function canSubirEvidencias(ctx: PermisoCtx): boolean {
  if (ctx.esAdmin) return true;
  return ctx.esEncargado || ctx.esRevisor;
}

export function canBorrarEvidencia(ctx: PermisoCtx, ev: EvidenciaRow): boolean {
  if (ctx.esAdmin) return true;
  return ev.uploader_uid === ctx.uid;
}
