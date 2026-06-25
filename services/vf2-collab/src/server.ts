// services/vf2-collab/src/server.ts
// Servidor Hocuspocus para co-edición en vivo de hojas vf2_.
// Desplegado en Railway como servicio persistente (collab.nuverdis.com).
// Auth: verifica JWT efímero firmado con HS256 (secreto compartido con Next.js).
// Persistencia: snapshots Yjs en Supabase (vf2_yjs_snapshot) via service_role.
//
// INVARIANTE: este servicio NUNCA produce ni valida verdad de negocio.
// Solo persiste el estado CRDT (bytes Yjs). La aprobación la hace el RPC SQL.

import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

// ─── Variables de entorno ─────────────────────────────────────────────────────
const {
  VF2_COLAB_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PORT = '3001',
} = process.env

if (!VF2_COLAB_SECRET) throw new Error('VF2_COLAB_SECRET no configurado')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL no configurado')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const secret = new TextEncoder().encode(VF2_COLAB_SECRET)

// ─── Tipo del token vf2_ ──────────────────────────────────────────────────────
interface Vf2ColabToken {
  empresaId: number
  uid: string
  sheetId: number
  docName: string
  canEdit: boolean
}

// ─── Servidor Hocuspocus ──────────────────────────────────────────────────────
const server = Server.configure({
  port: parseInt(PORT, 10),
  name: 'vf2-collab',

  // Autenticación por token efímero JWT (HS256)
  async onAuthenticate({ token, documentName, connection }) {
    if (!token) throw new Error('Token requerido')

    let payload: Vf2ColabToken
    try {
      const result = await jwtVerify(token, secret)
      payload = result.payload as unknown as Vf2ColabToken
    } catch {
      throw new Error('Token inválido o expirado')
    }

    // Verificar que el doc_name del token coincide con el documento solicitado
    if (payload.docName !== documentName) {
      throw new Error('Token no corresponde al documento')
    }

    // Propagar al contexto de conexión para usarlo en onLoadDocument/onChange
    connection.readOnly = !payload.canEdit

    return payload
  },

  // Cargar snapshot persistido desde Supabase
  extensions: [
    new Database({
      async fetch({ documentName, context }) {
        const token = context as Vf2ColabToken
        const { data } = await supabase
          .from('vf2_yjs_snapshot')
          .select('state_vector')
          .eq('empresa_id', token.empresaId)
          .eq('yjs_doc_name', documentName)
          .single()

        if (!data) return null
        return Buffer.from(data.state_vector as string, 'base64')
      },

      async store({ documentName, state, context }) {
        const token = context as Vf2ColabToken
        const stateB64 = Buffer.from(state).toString('base64')

        await supabase
          .from('vf2_yjs_snapshot')
          .upsert(
            {
              empresa_id: token.empresaId,
              yjs_doc_name: documentName,
              state_vector: stateB64,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'empresa_id,yjs_doc_name' }
          )
      },
    }),
  ],
})

server.listen().then(() => {
  console.log(`[vf2-collab] Servidor Hocuspocus escuchando en puerto ${PORT}`)
})
