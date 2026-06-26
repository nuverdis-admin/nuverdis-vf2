'use server'
// app/actions/vf2-evidencias.ts — Server Actions para evidencias (Storage) en tareas vf2_
// Patrón: signed URL TTL corto + chequeo IDOR por empresa_id + anti-path-traversal

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { requireSession } from '@/lib/supabase/auth-guard'
import { z } from 'zod'
import type { Vf2Evidencia } from '@/lib/vf2/types'

const BUCKET = 'vf2-evidencias'
const SIGNED_URL_TTL = 120 // 2 minutos

function getStorageAdminClient() {
  return createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Registrar evidencia (se llama después del upload directo del cliente) ────

const registrarSchema = z.object({
  tareaPublicId: z.string().min(1).max(50),
  storagePath: z.string().min(1).max(500),
  nombreArchivo: z.string().min(1).max(255),
  mimeType: z.string().max(100).optional(),
  tamanoBytes: z.number().int().positive().max(52_428_800).optional(), // 50MB
})

export async function vf2RegistrarEvidencia(
  input: unknown
): Promise<{ ok: true; evidencia: Vf2Evidencia } | { ok: false; error: string }> {
  const parsed = registrarSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('tarea_id, estado')
      .eq('public_id', parsed.data.tareaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }
    if (tarea.estado === 'aprobada') return { ok: false, error: 'La tarea está aprobada, no se pueden agregar evidencias' }

    // Anti-path-traversal: el path debe empezar con empresa_id/
    const expectedPrefix = `${actor.empresaId}/`
    if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
      return { ok: false, error: 'Ruta de archivo inválida' }
    }

    const { data, error } = await supabase
      .from('vf2_evidencia')
      .insert({
        empresa_id: actor.empresaId,
        tarea_id: tarea.tarea_id,
        storage_path: parsed.data.storagePath,
        nombre_archivo: parsed.data.nombreArchivo,
        mime_type: parsed.data.mimeType ?? null,
        tamano_bytes: parsed.data.tamanoBytes ?? null,
        subido_por_uid: actor.uid,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[vf2-evidencias] vf2RegistrarEvidencia:', error.message)
      return { ok: false, error: 'Error al registrar evidencia' }
    }

    return { ok: true, evidencia: data as Vf2Evidencia }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Obtener URL firmada para descargar ───────────────────────────────────────

const getUrlSchema = z.object({
  evidenciaPublicId: z.string().min(1).max(50),
})

export async function vf2GetEvidenciaUrl(
  input: unknown
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = getUrlSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // IDOR check: verificar que la evidencia pertenece a la empresa del actor
    const { data: evidencia } = await supabase
      .from('vf2_evidencia')
      .select('storage_path, empresa_id, eliminado')
      .eq('public_id', parsed.data.evidenciaPublicId)
      .eq('empresa_id', actor.empresaId)
      .eq('eliminado', false)
      .single()

    if (!evidencia) return { ok: false, error: 'Evidencia no encontrada' }

    // Generar URL firmada con TTL corto (service_role para acceder al bucket privado)
    const adminClient = getStorageAdminClient()
    const { data: urlData, error: urlError } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(evidencia.storage_path, SIGNED_URL_TTL)

    if (urlError || !urlData) {
      console.error('[vf2-evidencias] vf2GetEvidenciaUrl:', urlError?.message)
      return { ok: false, error: 'Error al generar enlace de descarga' }
    }

    return { ok: true, url: urlData.signedUrl }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Eliminar evidencia (soft delete + borrar en Storage) ────────────────────

const eliminarSchema = z.object({
  evidenciaPublicId: z.string().min(1).max(50),
})

export async function vf2EliminarEvidencia(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = eliminarSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // IDOR check
    const { data: evidencia } = await supabase
      .from('vf2_evidencia')
      .select('evidencia_id, storage_path, empresa_id, subido_por_uid, eliminado')
      .eq('public_id', parsed.data.evidenciaPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!evidencia || evidencia.eliminado) return { ok: false, error: 'Evidencia no encontrada' }

    // Solo puede eliminar quien subió el archivo o un admin
    const esAdmin = actor.rol === 'administrador'
    if (!esAdmin && evidencia.subido_por_uid !== actor.uid) {
      return { ok: false, error: 'No tienes permisos para eliminar esta evidencia' }
    }

    // 1. Borrar en Storage primero (service_role)
    const adminClient = getStorageAdminClient()
    const { error: storageError } = await adminClient.storage
      .from(BUCKET)
      .remove([evidencia.storage_path])

    if (storageError) {
      console.error('[vf2-evidencias] vf2EliminarEvidencia Storage:', storageError.message)
      // No bloquear: seguir con soft-delete aunque falle el storage
    }

    // 2. Soft delete en BD
    const { error: dbError } = await supabase
      .from('vf2_evidencia')
      .update({ eliminado: true })
      .eq('evidencia_id', evidencia.evidencia_id)
      .eq('empresa_id', actor.empresaId)

    if (dbError) {
      console.error('[vf2-evidencias] vf2EliminarEvidencia BD:', dbError.message)
      return { ok: false, error: 'Error al eliminar evidencia' }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}

// ─── Listar evidencias de una tarea ──────────────────────────────────────────

const listarSchema = z.object({
  tareaPublicId: z.string().min(1).max(50),
})

export async function vf2ListarEvidencias(
  input: unknown
): Promise<{ ok: true; evidencias: Vf2Evidencia[] } | { ok: false; error: string }> {
  const parsed = listarSchema.safeParse(input)
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

    const { data, error } = await supabase
      .from('vf2_evidencia')
      .select('*')
      .eq('tarea_id', tarea.tarea_id)
      .eq('empresa_id', actor.empresaId)
      .eq('eliminado', false)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[vf2-evidencias] vf2ListarEvidencias:', error.message)
      return { ok: false, error: 'Error al obtener evidencias' }
    }

    return { ok: true, evidencias: (data ?? []) as Vf2Evidencia[] }
  } catch {
    return { ok: false, error: 'Error al procesar la solicitud' }
  }
}
