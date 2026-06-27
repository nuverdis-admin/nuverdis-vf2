'use server'
// app/actions/vf2-tareas.ts — Server Actions para el módulo vf2_ (tareas, celdas, workflow)
// Patrón: safeParse(zod) → guard → assertProyectoEnEmpresa → doble muralla → log → error genérico

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession, requireAdmin } from '@/lib/supabase/auth-guard'
import {
  vf2CrearColeccionSchema,
  vf2CrearTareaSchema,
  vf2AsignarRolSchema,
  vf2GuardarCeldasSchema,
  vf2CambiarEstadoSchema,
  vf2AprobarSchema,
  vf2AgregarComentarioSchema,
  vf2CrearMetricaSchema,
} from '@/lib/vf2/schemas'
import type {
  Vf2CrearColeccionResult,
  Vf2CambiarEstadoResult,
  Vf2AprobarTareaResult,
} from '@/lib/vf2/types'

// ─── Crear colección ──────────────────────────────────────────────────────────

export async function vf2CrearColeccion(
  input: unknown
): Promise<{ ok: true; data: Vf2CrearColeccionResult } | { ok: false; error: string }> {
  const parsed = vf2CrearColeccionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    // Verificar proyecto pertenece a empresa (anti-IDOR)
    const { data: proyecto } = await supabase
      .from('proyectos')
      .select('proyecto_id')
      .eq('proyecto_id', parsed.data.proyectoId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!proyecto) return { ok: false, error: 'Proyecto no encontrado' }

    const { data, error } = await supabase.rpc('vf2_crear_coleccion', {
      p_proyecto_id: parsed.data.proyectoId,
      p_estandar: parsed.data.estandar,
      p_nombre: parsed.data.nombre,
    })

    if (error) {
      console.error('[vf2-tareas] vf2CrearColeccion:', error.message)
      return { ok: false, error: 'Error al crear colección' }
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true, data: data as Vf2CrearColeccionResult }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Crear tarea ──────────────────────────────────────────────────────────────

export async function vf2CrearTarea(
  input: unknown
): Promise<{ ok: true; tareaPublicId: string } | { ok: false; error: string }> {
  const parsed = vf2CrearTareaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    // Verificar que la colección pertenece a la empresa
    const { data: coleccion } = await supabase
      .from('vf2_coleccion')
      .select('coleccion_id, proyecto_id')
      .eq('public_id', parsed.data.coleccionPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!coleccion) return { ok: false, error: 'Colección no encontrada' }

    const { data, error } = await supabase
      .from('vf2_tarea')
      .insert({
        empresa_id: actor.empresaId,
        coleccion_id: coleccion.coleccion_id,
        titulo: parsed.data.titulo,
        instruccion: parsed.data.instruccion ?? null,
        fecha_limite: parsed.data.fechaLimite ?? null,
        gri_item_id: parsed.data.griItemId ?? null,
        gri_requerimiento_id: parsed.data.griRequerimientoId ?? null,
        ncg_item_id: parsed.data.ncgItemId ?? null,
        ncg_requerimiento_id: parsed.data.ncgRequerimientoId ?? null,
      })
      .select('public_id, tarea_id')
      .single()

    if (error) {
      console.error('[vf2-tareas] vf2CrearTarea:', error.message)
      return { ok: false, error: 'Error al crear tarea' }
    }

    // Auto-crear hoja por defecto para que el grid esté listo al abrir la tarea
    const { data: sheet } = await supabase
      .from('vf2_sheet')
      .insert({
        empresa_id: actor.empresaId,
        tarea_id: data.tarea_id,
        nombre: 'Hoja 1',
        yjs_doc_name: 'pending',
      })
      .select('sheet_id, public_id')
      .single()

    if (sheet) {
      const docName = `vf2:${actor.empresaId}:${sheet.public_id}`
      await supabase
        .from('vf2_sheet')
        .update({ yjs_doc_name: docName })
        .eq('sheet_id', sheet.sheet_id)
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true, tareaPublicId: data.public_id }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Asignar rol ──────────────────────────────────────────────────────────────

export async function vf2AsignarRol(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = vf2AsignarRolSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id')
      .eq('public_id', parsed.data.tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    // Verificar equipo pertenece a empresa si aplica
    if (parsed.data.asignadoEquipoId) {
      const { data: equipo } = await supabase
        .from('equipos')
        .select('equipo_id')
        .eq('equipo_id', parsed.data.asignadoEquipoId)
        .eq('empresa_id', actor.empresaId)
        .single()
      if (!equipo) return { ok: false, error: 'Equipo no encontrado' }
    }

    const { error } = await supabase
      .from('vf2_tarea_rol')
      .upsert(
        {
          empresa_id: actor.empresaId,
          tarea_id: tarea.tarea_id,
          rol: parsed.data.rol,
          asignado_user_id: parsed.data.asignadoUserId ?? null,
          asignado_equipo_id: parsed.data.asignadoEquipoId ?? null,
          activo: true,
        },
        { onConflict: 'tarea_id,rol' }
      )

    if (error) {
      console.error('[vf2-tareas] vf2AsignarRol:', error.message)
      return { ok: false, error: 'Error al asignar rol' }
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Guardar celdas (autosave) ────────────────────────────────────────────────

export async function vf2GuardarCeldas(
  input: unknown
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = vf2GuardarCeldasSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // Verificar sheet pertenece a empresa (doble muralla)
    const { data: sheet } = await supabase
      .from('vf2_sheet')
      .select('sheet_id, tarea_id')
      .eq('public_id', parsed.data.sheetPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!sheet) return { ok: false, error: 'Hoja no encontrada' }

    // Upsert de celdas en batch — incluye validation para coordenada por celda
    const rows = parsed.data.cells.map(c => ({
      empresa_id: actor.empresaId,
      sheet_id: sheet.sheet_id,
      row_key: c.rowKey,
      col_key: c.colKey,
      value_num: c.valueNum ?? null,
      value_text: c.valueText ?? null,
      value_json: c.valueJson ?? null,
      ...(c.validation ? { validation: c.validation } : {}),
      estado_celda: 'borrador' as const,
    }))

    const { error } = await supabase
      .from('vf2_cell')
      .upsert(rows, { onConflict: 'empresa_id,sheet_id,row_key,col_key' })

    if (error) {
      console.error('[vf2-tareas] vf2GuardarCeldas:', error.message)
      return { ok: false, error: 'Error al guardar celdas' }
    }

    return { ok: true, count: rows.length }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Cambiar estado ───────────────────────────────────────────────────────────

export async function vf2CambiarEstado(
  input: unknown
): Promise<{ ok: true; data: Vf2CambiarEstadoResult } | { ok: false; error: string }> {
  const parsed = vf2CambiarEstadoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // Doble muralla app-level: verificar tarea pertenece a empresa antes del RPC
    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id')
      .eq('public_id', parsed.data.tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    const { data, error } = await supabase.rpc('vf2_cambiar_estado_tarea', {
      p_tarea_public_id: parsed.data.tareaPublicId,
      p_nuevo_estado: parsed.data.nuevoEstado,
      p_nota: parsed.data.nota ?? null,
    })

    if (error) {
      console.error('[vf2-tareas] vf2CambiarEstado:', error.message)
      return { ok: false, error: 'Error al cambiar estado' }
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true, data: data as Vf2CambiarEstadoResult }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Aprobar tarea ────────────────────────────────────────────────────────────

export async function vf2Aprobar(
  input: unknown
): Promise<{ ok: true; data: Vf2AprobarTareaResult } | { ok: false; error: string }> {
  const parsed = vf2AprobarSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // Doble muralla app-level: verificar tarea pertenece a empresa antes del RPC
    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id')
      .eq('public_id', parsed.data.tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    const { data, error } = await supabase.rpc('vf2_aprobar_tarea', {
      p_tarea_public_id: parsed.data.tareaPublicId,
      p_notas: parsed.data.notas ?? null,
    })

    if (error) {
      console.error('[vf2-tareas] vf2Aprobar:', error.message)
      return { ok: false, error: 'Error al aprobar tarea' }
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true, data: data as Vf2AprobarTareaResult }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Agregar comentario ───────────────────────────────────────────────────────

export async function vf2AgregarComentario(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = vf2AgregarComentarioSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id')
      .eq('public_id', parsed.data.tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    const { error } = await supabase.from('vf2_comentario').insert({
      empresa_id: actor.empresaId,
      tarea_id: tarea.tarea_id,
      tipo: parsed.data.tipo,
      contenido: parsed.data.contenido,
      revision_id: parsed.data.revisionId ?? null,
      autor_uid: actor.uid,
    })

    if (error) {
      console.error('[vf2-tareas] vf2AgregarComentario:', error.message)
      return { ok: false, error: 'Error al agregar comentario' }
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Crear métrica ───────────────────────────────────────────────────────────

interface Vf2MetricaCatalogo {
  metric_id: number
  public_id: string
  codigo: string
  nombre: string
  unidad: string | null
}

export async function vf2CrearMetrica(
  input: unknown
): Promise<
  | { ok: true; metricPublicId: string; metrica: Vf2MetricaCatalogo }
  | { ok: false; error: string }
> {
  const parsed = vf2CrearMetricaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('vf2_metric')
      .insert({
        empresa_id: actor.empresaId,
        codigo: parsed.data.codigo,
        nombre: parsed.data.nombre,
        value_kind: parsed.data.valueKind,
        unidad: parsed.data.unidad ?? null,
        gri_item_id: parsed.data.griItemId ?? null,
        ncg_item_id: parsed.data.ncgItemId ?? null,
      })
      .select('metric_id, public_id, codigo, nombre, unidad')
      .single()

    if (error) {
      console.error('[vf2-tareas] vf2CrearMetrica:', error.message)
      return { ok: false, error: 'Error al crear métrica' }
    }

    // Sin revalidatePath: el catálogo se actualiza en cliente (evita una carrera de
    // refresh que obligaba a F5). El alta queda persistida y aparece al navegar.
    return {
      ok: true,
      metricPublicId: data.public_id,
      metrica: {
        metric_id: data.metric_id,
        public_id: data.public_id,
        codigo: data.codigo,
        nombre: data.nombre,
        unidad: data.unidad,
      },
    }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Crear sheet ──────────────────────────────────────────────────────────────

export async function vf2CrearSheet(input: {
  tareaPublicId: string
  nombre?: string
  templateId?: string
}): Promise<{ ok: true; sheetPublicId: string; docName: string } | { ok: false; error: string }> {
  if (!input.tareaPublicId) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id, empresa_id')
      .eq('public_id', input.tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    // El public_id lo genera nanoid() en BD; el doc_name se construye después
    const { data: sheet, error } = await supabase
      .from('vf2_sheet')
      .insert({
        empresa_id: actor.empresaId,
        tarea_id: tarea.tarea_id,
        template_id: input.templateId ?? null,
        nombre: input.nombre ?? 'Hoja 1',
        yjs_doc_name: 'pending', // se actualiza al tener el public_id
      })
      .select('sheet_id, public_id')
      .single()

    if (error) {
      console.error('[vf2-tareas] vf2CrearSheet:', error.message)
      return { ok: false, error: 'Error al crear hoja' }
    }

    // Actualizar yjs_doc_name con el public_id real
    const docName = `vf2:${actor.empresaId}:${sheet.public_id}`
    await supabase
      .from('vf2_sheet')
      .update({ yjs_doc_name: docName })
      .eq('sheet_id', sheet.sheet_id)

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true, sheetPublicId: sheet.public_id, docName }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Eliminar tarea (admin, cascade) ─────────────────────────────────────────
// Las FK con CASCADE limpian: vf2_sheet → vf2_cell, vf2_tarea_rol,
// vf2_evidencia (fila BD; archivos Storage los limpia el pg_cron huérfanos),
// vf2_comentario. Requiere admin de la misma empresa (anti-IDOR).

export async function vf2EliminarTarea(
  tareaPublicId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tareaPublicId) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    // Anti-IDOR: verificar que la tarea pertenece a la empresa del actor.
    // El proyecto se obtiene vía la colección (vf2_tarea no tiene proyecto_id).
    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id, titulo, coleccion_id, vf2_coleccion(proyecto_id)')
      .eq('public_id', tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single<{
        tarea_id: number
        titulo: string
        coleccion_id: number
        vf2_coleccion: { proyecto_id: number } | null
      }>()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    const { error } = await supabase
      .from('vf2_tarea')
      .delete()
      .eq('public_id', tareaPublicId)
      .eq('empresa_id', actor.empresaId)

    if (error) {
      console.error('[vf2EliminarTarea]', error.message)
      return { ok: false, error: 'Error al eliminar la tarea' }
    }

    await supabase.rpc('log_usuario_accion', {
      p_empresa_id: actor.empresaId,
      p_user_id: actor.uid,
      p_accion: 'DELETE_VF2_TAREA',
      p_tabla: 'vf2_tarea',
      p_registro_id: tareaPublicId,
      p_datos_prev: { public_id: tareaPublicId, titulo: tarea.titulo },
      p_datos_new: null,
      p_proyecto_id: tarea.vf2_coleccion?.proyecto_id ?? null,
    })

    return { ok: true }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Cargar plantilla de grid (GRI / NCG) ────────────────────────────────────
// Dado el public_id de una tarea, detecta su ítem vinculado (GRI o NCG),
// encuentra el template predefinido, crea las métricas (ON CONFLICT DO NOTHING),
// y devuelve la lista de {rowIndex, metric} para que el cliente configure el grid.

export interface Vf2TemplateMetricaResult {
  rowIndex: number
  metricId: number
  publicId: string
  codigo: string
  nombre: string
  unidad: string | null
}

export async function vf2CargarTemplate(
  tareaPublicId: string
): Promise<
  | { ok: true; templateTitulo: string; metricas: Vf2TemplateMetricaResult[] }
  | { ok: false; error: string }
> {
  if (!tareaPublicId) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireAdmin()
    const supabase = await createClient()

    // Verificar tarea y obtener item vinculado (anti-IDOR)
    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id, empresa_id, gri_item_id, ncg_item_id')
      .eq('public_id', tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    // Importar helper de templates en servidor (no expone datos al cliente)
    const { findTemplateByTablaCodes } = await import('@/lib/vf2/templates/index')

    // La plantilla se resuelve por la columna `tabla` (identificador vf1: T8, T26,
    // NCG-T3...), la MISMA que marca la "(T)" en el modal. No por el nombre del ítem
    // (los nombres son descriptivos, sin código numérico).
    let template = null

    if (tarea.gri_item_id) {
      const { data: reqs } = await supabase
        .from('gri_items_requerimientos_reporte')
        .select('tabla')
        .eq('item_id', tarea.gri_item_id)
        .not('tabla', 'is', null)

      const codes = (reqs ?? [])
        .map(r => (r as { tabla: string | null }).tabla)
        .filter((t): t is string => !!t)
      if (codes.length) template = findTemplateByTablaCodes(codes)
    }

    if (!template && tarea.ncg_item_id) {
      const { data: reqs } = await supabase
        .from('ncg_items_requerimientos_reporte')
        .select('tabla')
        .eq('item_id', tarea.ncg_item_id)
        .not('tabla', 'is', null)

      const codes = (reqs ?? [])
        .map(r => (r as { tabla: string | null }).tabla)
        .filter((t): t is string => !!t)
      if (codes.length) template = findTemplateByTablaCodes(codes)
    }

    if (!template) {
      return { ok: false, error: 'No hay plantilla predefinida para este ítem. Usa el catálogo para asignar métricas manualmente.' }
    }

    // Crear o recuperar las métricas de la plantilla (ON CONFLICT DO NOTHING via upsert)
    const metricas: Vf2TemplateMetricaResult[] = []

    for (let i = 0; i < template.rows.length; i++) {
      const row = template.rows[i]

      // Upsert: si la métrica ya existe (mismo empresa_id + codigo), la recupera
      const { data: existing } = await supabase
        .from('vf2_metric')
        .select('metric_id, public_id, codigo, nombre, unidad')
        .eq('empresa_id', actor.empresaId)
        .eq('codigo', row.codigo)
        .maybeSingle()

      if (existing) {
        metricas.push({
          rowIndex: i,
          metricId: existing.metric_id,
          publicId: existing.public_id,
          codigo: existing.codigo,
          nombre: existing.nombre,
          unidad: existing.unidad,
        })
        continue
      }

      const { data: created, error } = await supabase
        .from('vf2_metric')
        .insert({
          empresa_id: actor.empresaId,
          codigo: row.codigo,
          nombre: row.nombre,
          value_kind: row.value_kind,
          unidad: row.unidad ?? null,
        })
        .select('metric_id, public_id, codigo, nombre, unidad')
        .single()

      if (error || !created) {
        console.error('[vf2CargarTemplate] metric insert:', row.codigo, error?.message)
        continue
      }

      metricas.push({
        rowIndex: i,
        metricId: created.metric_id,
        publicId: created.public_id,
        codigo: created.codigo,
        nombre: created.nombre,
        unidad: created.unidad,
      })
    }

    return { ok: true, templateTitulo: template.titulo, metricas }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}
