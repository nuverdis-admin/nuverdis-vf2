// SERVER — detalle de tarea vf2_ con grid de celdas, roles, co-edición Yjs (ruta canónica)

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import Vf2TareaView from '@/app/(dashboard)/dashboard/vf2/components/Vf2TareaView'
import type { Vf2Tarea, Vf2TareaRolRow, Vf2Sheet, Vf2Cell, Vf2Coleccion, Vf2Metric, Vf2Evidencia } from '@/lib/vf2/types'

export default async function TareaPage({
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

  const metricaQuery = tarea.gri_item_id
    ? supabase.from('vf2_metric').select('*').eq('empresa_id', actor.empresaId).eq('gri_item_id', tarea.gri_item_id).limit(1)
    : tarea.ncg_item_id
    ? supabase.from('vf2_metric').select('*').eq('empresa_id', actor.empresaId).eq('ncg_item_id', tarea.ncg_item_id).limit(1)
    : Promise.resolve({ data: [] })

  // Resolver info del item GRI o NCG para el header
  const griItemQuery = tarea.gri_item_id
    ? supabase.from('gri_items_reporte').select('estandar, jerarquia_1_nombre, jerarquia_2_nombre').eq('id', tarea.gri_item_id).single()
    : Promise.resolve({ data: null })

  const ncgItemQuery = tarea.ncg_item_id
    ? supabase.from('ncg_items_reporte').select('jerarquia_1, jerarquia_1_nombre, jerarquia_2_nombre').eq('id', tarea.ncg_item_id).single()
    : Promise.resolve({ data: null })

  const [rolesRes, sheetsRes, usuariosRes, equiposRes, metricaRes, griItemRes, ncgItemRes] = await Promise.all([
    supabase.from('vf2_tarea_rol').select('*').eq('tarea_id', tarea.tarea_id).eq('activo', true),
    supabase.from('vf2_sheet').select('*').eq('tarea_id', tarea.tarea_id).eq('empresa_id', actor.empresaId).order('orden', { ascending: true }),
    supabase.from('usuarios').select('uid, nombre_completo').eq('empresa_id', actor.empresaId).eq('activo', true),
    supabase.from('equipos').select('equipo_id, nombre').eq('empresa_id', actor.empresaId),
    metricaQuery,
    griItemQuery,
    ncgItemQuery,
  ])

  const roles = (rolesRes.data ?? []) as Vf2TareaRolRow[]
  const sheets = (sheetsRes.data ?? []) as Vf2Sheet[]

  const usuariosBase = (usuariosRes.data ?? []) as { uid: string; nombre_completo: string }[]
  const { data: userRolesData } = await supabase
    .from('user_roles')
    .select('uid, roles(name)')
    .eq('empresa_id', actor.empresaId)
    .in('uid', usuariosBase.map(u => u.uid))

  const userRolMap = new Map<string, string>()
  for (const ur of userRolesData ?? []) {
    const rolesData = ur.roles as { name: string }[] | { name: string } | null
    const rolName = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) ?? 'encargado'
    userRolMap.set(ur.uid as string, rolName)
  }

  const usuarios = usuariosBase.map(u => ({
    uid: u.uid,
    nombre_completo: u.nombre_completo,
    rol: userRolMap.get(u.uid) ?? 'encargado',
  }))

  const equipos = (equiposRes.data ?? []) as { equipo_id: number; nombre: string }[]
  const metrica = ((metricaRes as { data: unknown[] }).data?.[0] ?? null) as Vf2Metric | null

  // Construir itemInfo para el header
  let itemInfo: { estandar: string; etiqueta: string } | null = null
  if (griItemRes.data) {
    const g = griItemRes.data as { estandar: string; jerarquia_1_nombre: string; jerarquia_2_nombre: string | null }
    itemInfo = {
      estandar: 'GRI',
      etiqueta: g.jerarquia_2_nombre
        ? `${g.estandar} · ${g.jerarquia_1_nombre} / ${g.jerarquia_2_nombre}`
        : `${g.estandar} · ${g.jerarquia_1_nombre}`,
    }
  } else if (ncgItemRes.data) {
    const n = ncgItemRes.data as { jerarquia_1: string; jerarquia_1_nombre: string; jerarquia_2_nombre: string | null }
    itemInfo = {
      estandar: 'NCG',
      etiqueta: n.jerarquia_2_nombre
        ? `${n.jerarquia_1} ${n.jerarquia_1_nombre} / ${n.jerarquia_2_nombre}`
        : `${n.jerarquia_1} ${n.jerarquia_1_nombre}`,
    }
  }

  let celdas: Vf2Cell[] = []
  let evidencias: Vf2Evidencia[] = []
  if (sheets.length > 0) {
    const [celdasRaw, evidenciasRaw] = await Promise.all([
      supabase.from('vf2_cell').select('*').eq('sheet_id', sheets[0].sheet_id).eq('empresa_id', actor.empresaId),
      supabase.from('vf2_evidencia').select('*').eq('tarea_id', tarea.tarea_id).eq('empresa_id', actor.empresaId).eq('eliminado', false).order('created_at', { ascending: true }),
    ])
    celdas = (celdasRaw.data ?? []) as Vf2Cell[]
    evidencias = (evidenciasRaw.data ?? []) as Vf2Evidencia[]
  } else {
    const { data: evidenciasRaw } = await supabase
      .from('vf2_evidencia').select('*').eq('tarea_id', tarea.tarea_id).eq('empresa_id', actor.empresaId).eq('eliminado', false).order('created_at', { ascending: true })
    evidencias = (evidenciasRaw ?? []) as Vf2Evidencia[]
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
      usuarios={usuarios}
      equipos={equipos}
      metrica={metrica}
      evidencias={evidencias}
      actorEmpresaId={actor.empresaId}
      itemInfo={itemInfo}
    />
  )
}
