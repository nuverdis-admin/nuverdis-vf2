'use server'
// app/actions/vf2-colab.ts — Server Action para emitir token efímero de co-edición (Hocuspocus/Yjs)
// El token se firma con jose (HS256). El navegador lo recibe y lo usa para autenticarse
// en collab.nuverdis.com/vf2. NUNCA se expone el secreto ni el service_role al cliente.

import { SignJWT } from 'jose'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { vf2EmitirTokenSchema } from '@/lib/vf2/schemas'
import type { Vf2ColabToken } from '@/lib/vf2/types'

const COLAB_SECRET = process.env.VF2_COLAB_SECRET
const TOKEN_TTL_SECONDS = 60 // 60s de vida (el cliente conecta inmediatamente)

export async function vf2EmitirTokenColab(
  input: unknown
): Promise<{ ok: true; token: string; docName: string } | { ok: false; error: string }> {
  const parsed = vf2EmitirTokenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  if (!COLAB_SECRET) {
    console.error('[vf2-colab] VF2_COLAB_SECRET no configurado')
    return { ok: false, error: 'Servicio de co-edición no disponible' }
  }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // Verificar que el sheet pertenece a la empresa del actor
    const { data: sheet } = await supabase
      .from('vf2_sheet')
      .select('sheet_id, tarea_id, yjs_doc_name, empresa_id')
      .eq('public_id', parsed.data.sheetPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!sheet) return { ok: false, error: 'Hoja no encontrada' }

    // Verificar estado de la tarea (solo editable si no está aprobada)
    const { data: tarea } = await supabase
      .from('vf2_tarea')
      .select('estado, empresa_id')
      .eq('tarea_id', sheet.tarea_id)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!tarea) return { ok: false, error: 'Tarea no encontrada' }

    const canEdit = tarea.estado !== 'aprobada'

    // Verificar rol del usuario en la tarea
    const { data: rolRow } = await supabase
      .from('vf2_tarea_rol')
      .select('rol')
      .eq('tarea_id', sheet.tarea_id)
      .eq('activo', true)
      .eq('asignado_user_id', actor.uid)
      .single()

    // Admins siempre pueden editar (si la tarea no está aprobada)
    const esAdmin = actor.rol === 'administrador'
    const tieneRolEnTarea = rolRow !== null
    const puedeEditar = canEdit && (esAdmin || tieneRolEnTarea)

    const payload: Omit<Vf2ColabToken, 'iat' | 'exp'> = {
      empresaId: actor.empresaId,
      uid: actor.uid,
      sheetId: sheet.sheet_id,
      docName: sheet.yjs_doc_name,
      canEdit: puedeEditar,
    }

    const secret = new TextEncoder().encode(COLAB_SECRET)
    const token = await new SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
      .sign(secret)

    return { ok: true, token, docName: sheet.yjs_doc_name }
  } catch (err) {
    console.error('[vf2-colab] vf2EmitirTokenColab:', err)
    return { ok: false, error: 'Error al generar token de co-edición' }
  }
}
