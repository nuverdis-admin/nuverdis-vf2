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

    // Verificar sheet pertenece a empresa
    const { data: sheet } = await supabase
      .from('vf2_sheet')
      .select('sheet_id, tarea_id')
      .eq('public_id', parsed.data.sheetPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!sheet) return { ok: false, error: 'Hoja no encontrada' }

    // Upsert de celdas en batch
    const rows = parsed.data.cells.map(c => ({
      empresa_id: actor.empresaId,
      sheet_id: sheet.sheet_id,
      row_key: c.rowKey,
      col_key: c.colKey,
      value_num: c.valueNum ?? null,
      value_text: c.valueText ?? null,
      value_json: c.valueJson ?? null,
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
    await requireSession()
    const supabase = await createClient()

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
    await requireSession()
    const supabase = await createClient()

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

export async function vf2CrearMetrica(
  input: unknown
): Promise<{ ok: true; metricPublicId: string } | { ok: false; error: string }> {
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
      .select('public_id')
      .single()

    if (error) {
      console.error('[vf2-tareas] vf2CrearMetrica:', error.message)
      return { ok: false, error: 'Error al crear métrica' }
    }

    revalidatePath('/dashboard/proyecto', 'layout')
    return { ok: true, metricPublicId: data.public_id }
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
