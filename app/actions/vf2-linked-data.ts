'use server'
// app/actions/vf2-linked-data.ts — Consultas del panel Linked Data
// Patrón: requireSession + filtro empresa_id (muralla RLS + app)

import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

const getFactSchema = z.object({
  metricPublicId: z.string().min(1).max(50),
})

export interface FactActual {
  fact_id: string
  public_id: string
  metric_id: number
  periodo_inicio: string | null
  periodo_fin: string | null
  periodo_tipo: string | null
  dims: Record<string, unknown> | null
  current_revision_id: string | null
  revision_status: string | null
  value_num: number | null
  value_text: string | null
  value_json: unknown
  unidad: string | null
  aprobado_por_uid: string | null
  aprobado_en: string | null
  nota: string | null
}

export interface RevisionItem {
  revision_id: string
  status: string
  value_num: number | null
  value_text: string | null
  value_json: unknown
  unidad: string | null
  is_current: boolean
  source_kind: string | null
  actor_uid: string | null
  nota: string | null
  created_at: string
}

export async function vf2GetLinkedData(
  input: unknown
): Promise<{ ok: true; fact: FactActual | null; revisiones: RevisionItem[] } | { ok: false; error: string }> {
  const parsed = getFactSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  try {
    const actor = await requireSession()
    const supabase = await createClient()

    // Resolver metric_id desde public_id
    const { data: metric } = await supabase
      .from('vf2_metric')
      .select('metric_id')
      .eq('public_id', parsed.data.metricPublicId)
      .eq('empresa_id', actor.empresaId)
      .single()

    if (!metric) return { ok: true, fact: null, revisiones: [] }

    // Consultar fact actual (view vf2_fact_actual)
    const { data: factRaw } = await supabase
      .from('vf2_fact_actual')
      .select('*')
      .eq('metric_id', metric.metric_id)
      .eq('empresa_id', actor.empresaId)
      .limit(1)
      .maybeSingle()

    const fact = factRaw as FactActual | null

    // Historial de revisiones si hay un fact
    let revisiones: RevisionItem[] = []
    if (fact?.fact_id) {
      const { data: revRaw } = await supabase
        .from('vf2_fact_revision')
        .select('revision_id, status, value_num, value_text, value_json, unidad, is_current, source_kind, actor_uid, nota, created_at')
        .eq('fact_id', fact.fact_id)
        .eq('empresa_id', actor.empresaId)
        .order('created_at', { ascending: false })
        .limit(20)

      revisiones = (revRaw ?? []) as RevisionItem[]
    }

    return { ok: true, fact, revisiones }
  } catch {
    return { ok: false, error: 'Error al obtener datos del Fact Graph' }
  }
}
