// app/(dashboard)/dashboard/vf2/proyecto/[ref]/coleccion/[colRef]/tarea/[tareaRef]/page.tsx
// SERVER — detalle de tarea vf2_ con grid de celdas

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import Vf2TareaView from '@/app/(dashboard)/dashboard/vf2/components/Vf2TareaView'
import type { Vf2Tarea, Vf2TareaRolRow, Vf2Sheet, Vf2Cell, Vf2Coleccion } from '@/lib/vf2/types'

export default async function Vf2TareaPage({
  params,
}: {
  params: { ref: string; colRef: string; tareaRef: string }
}) {
  const actor = await requireSession()
  const supabase = await createClient()

  const { data: tareaRaw } = await supabase
    .from('vf2_tarea')
    .select('*')
    .eq('public_id', params.tareaRef)
    .eq('empresa_id', actor.empresaId)
    .single()

  if (!tareaRaw) notFound()
  const tarea = tareaRaw as Vf2Tarea

  const { data: coleccionRaw } = await supabase
    .from('vf2_coleccion')
    .select('*')
    .eq('coleccion_id', tarea.coleccion_id)
    .single()
  const coleccion = coleccionRaw as Vf2Coleccion | null

  const [rolesRes, sheetsRes] = await Promise.all([
    supabase
      .from('vf2_tarea_rol')
      .select('*')
      .eq('tarea_id', tarea.tarea_id)
      .eq('activo', true),
    supabase
      .from('vf2_sheet')
      .select('*')
      .eq('tarea_id', tarea.tarea_id)
      .eq('empresa_id', actor.empresaId)
      .order('orden', { ascending: true }),
  ])

  const roles = (rolesRes.data ?? []) as Vf2TareaRolRow[]
  const sheets = (sheetsRes.data ?? []) as Vf2Sheet[]

  let celdas: Vf2Cell[] = []
  if (sheets.length > 0) {
    const { data: celdasRaw } = await supabase
      .from('vf2_cell')
      .select('*')
      .eq('sheet_id', sheets[0].sheet_id)
      .eq('empresa_id', actor.empresaId)
    celdas = (celdasRaw ?? []) as Vf2Cell[]
  }

  const rolEnTarea = roles.find(r => r.asignado_user_id === actor.uid)?.rol ?? null

  return (
    <Vf2TareaView
      tarea={tarea}
      coleccion={coleccion}
      roles={roles}
      sheets={sheets}
      celdas={celdas}
      actorUid={actor.uid}
      actorRolApp={actor.rol}
      actorRolTarea={rolEnTarea}
      proyectoRef={params.ref}
      colRef={params.colRef}
    />
  )
}
