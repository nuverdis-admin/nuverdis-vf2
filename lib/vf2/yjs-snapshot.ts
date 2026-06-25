'server-only'
// lib/vf2/yjs-snapshot.ts — Persistencia del snapshot Yjs en vf2_yjs_snapshot
// IMPORTANTE: el snapshot Yjs es la experiencia de edición, NUNCA la verdad del dato.
// La verdad canónica la produce únicamente el RPC vf2_aprobar_tarea.

import { createClient } from '@/lib/supabase/server'

// Guardar (upsert) snapshot Yjs para un doc
export async function saveYjsSnapshot(
  empresaId: number,
  docName: string,
  stateVector: Uint8Array
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('vf2_yjs_snapshot')
    .upsert(
      {
        empresa_id: empresaId,
        yjs_doc_name: docName,
        state_vector: Buffer.from(stateVector).toString('base64'),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'empresa_id,yjs_doc_name' }
    )

  if (error) {
    console.error('[vf2/yjs-snapshot] saveYjsSnapshot:', error.message)
  }
}

// Cargar snapshot Yjs para un doc
export async function loadYjsSnapshot(
  empresaId: number,
  docName: string
): Promise<Uint8Array | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_yjs_snapshot')
    .select('state_vector')
    .eq('empresa_id', empresaId)
    .eq('yjs_doc_name', docName)
    .single()

  if (error || !data) return null

  try {
    return Uint8Array.from(Buffer.from(data.state_vector as string, 'base64'))
  } catch {
    return null
  }
}
