// SERVER — lista tareas de una colección + modal crear tarea (ruta canónica)

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { ChevronRight, Calendar } from 'lucide-react'
import { VF2_ESTADO_BADGE, VF2_ESTADO_LABEL } from '@/lib/vf2/permisos'
import Vf2CrearTareaModal from '@/app/(dashboard)/dashboard/vf2/components/Vf2CrearTareaModal'
import type { Vf2Coleccion, Vf2Tarea } from '@/lib/vf2/types'

interface TareaConItem extends Vf2Tarea {
  gri_item?: { estandar: string; jerarquia_1_nombre: string; jerarquia_2_nombre: string | null } | null
  ncg_item?: { jerarquia_1: string; jerarquia_1_nombre: string; jerarquia_2_nombre: string | null } | null
}

function ItemBadge({ tarea, estandar }: { tarea: TareaConItem; estandar: string }) {
  if (estandar === 'GRI' && tarea.gri_item) {
    const { estandar: std, jerarquia_1_nombre, jerarquia_2_nombre } = tarea.gri_item
    return (
      <span className="text-xs text-gray-4 truncate max-w-[200px]" title={jerarquia_2_nombre ?? jerarquia_1_nombre}>
        {std} · {jerarquia_2_nombre ?? jerarquia_1_nombre}
      </span>
    )
  }
  if (estandar === 'NCG' && tarea.ncg_item) {
    const { jerarquia_1, jerarquia_1_nombre, jerarquia_2_nombre } = tarea.ncg_item
    return (
      <span className="text-xs text-gray-4 truncate max-w-[200px]" title={jerarquia_2_nombre ?? jerarquia_1_nombre}>
        {jerarquia_1} · {jerarquia_2_nombre ?? jerarquia_1_nombre}
      </span>
    )
  }
  return null
}

export default async function ColeccionPage({
  params,
}: {
  params: { ref: string; colRef: string }
}) {
  const actor = await requireSession()
  const supabase = await createClient()

  const { data: coleccion } = await supabase
    .from('vf2_coleccion')
    .select('*')
    .eq('public_id', params.colRef)
    .eq('empresa_id', actor.empresaId)
    .single()

  if (!coleccion) notFound()
  const col = coleccion as Vf2Coleccion

  const { data: tareasRaw } = await supabase
    .from('vf2_tarea')
    .select('*')
    .eq('coleccion_id', col.coleccion_id)
    .eq('empresa_id', actor.empresaId)
    .order('created_at', { ascending: true })

  const tareasList = (tareasRaw ?? []) as Vf2Tarea[]

  // Enriquecer con info del item GRI o NCG
  let tareas: TareaConItem[] = tareasList

  if (col.estandar === 'GRI') {
    const griIds = tareasList.map(t => t.gri_item_id).filter(Boolean) as number[]
    if (griIds.length > 0) {
      const { data: griItems } = await supabase
        .from('gri_items_reporte')
        .select('id, estandar, jerarquia_1_nombre, jerarquia_2_nombre')
        .in('id', griIds)
      const griMap = new Map((griItems ?? []).map(g => [g.id, g]))
      tareas = tareasList.map(t => ({
        ...t,
        gri_item: t.gri_item_id ? (griMap.get(t.gri_item_id) ?? null) : null,
      }))
    }
  } else if (col.estandar === 'NCG') {
    const ncgIds = tareasList.map(t => t.ncg_item_id).filter(Boolean) as number[]
    if (ncgIds.length > 0) {
      const { data: ncgItems } = await supabase
        .from('ncg_items_reporte')
        .select('id, jerarquia_1, jerarquia_1_nombre, jerarquia_2_nombre')
        .in('id', ncgIds)
      const ncgMap = new Map((ncgItems ?? []).map(n => [n.id, n]))
      tareas = tareasList.map(t => ({
        ...t,
        ncg_item: t.ncg_item_id ? (ncgMap.get(t.ncg_item_id) ?? null) : null,
      }))
    }
  }

  const base = `/dashboard/proyecto/${params.ref}/coleccion/${params.colRef}`

  const totalTareas = tareas.length
  const aprobadas = tareas.filter(t => t.estado === 'aprobada').length
  const pct = totalTareas > 0 ? Math.round((aprobadas / totalTareas) * 100) : 0

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-4">
        <Link href={`/dashboard/proyecto/${params.ref}`} className="hover:text-gray-7">
          Proyecto
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-7">{col.nombre}</span>
      </div>

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-9">{col.nombre}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              col.estandar === 'GRI' ? 'bg-success-1 text-success-7'
              : col.estandar === 'NCG' ? 'bg-secondary-2 text-secondary-7'
              : 'bg-gray-2 text-gray-6'
            }`}>
              {col.estandar}
            </span>
          </div>
          {col.descripcion && <p className="text-sm text-gray-5 mb-2">{col.descripcion}</p>}
          {totalTareas > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-40 rounded-full bg-gray-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-success-5 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-5">{aprobadas}/{totalTareas} aprobadas</span>
            </div>
          )}
        </div>
        {actor.rol === 'administrador' && col.estado === 'activa' && (
          <Vf2CrearTareaModal
            coleccionPublicId={col.public_id}
            proyectoRef={params.ref}
            estandar={col.estandar}
          />
        )}
      </div>

      {/* Lista de tareas */}
      {tareas.length === 0 ? (
        <div className="rounded-xl border border-gray-3 bg-gray-1 p-10 text-center">
          <p className="text-gray-5 text-sm">Sin tareas en esta colección.</p>
          {actor.rol === 'administrador' && (
            <p className="text-gray-4 text-xs mt-1">Usa "Nueva tarea" para comenzar.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tareas.map(t => (
            <Link
              key={t.public_id}
              href={`${base}/tarea/${t.public_id}`}
              className="flex items-center justify-between rounded-xl border border-gray-3 bg-white px-5 py-3.5 hover:border-primary-4 hover:bg-primary-1/30 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-0.5">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${VF2_ESTADO_BADGE[t.estado]}`}>
                    {VF2_ESTADO_LABEL[t.estado]}
                  </span>
                  <span className="text-sm font-medium text-gray-8 truncate">{t.titulo}</span>
                </div>
                <ItemBadge tarea={t} estandar={col.estandar} />
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {t.fecha_limite && (
                  <span className="flex items-center gap-1 text-xs text-gray-4">
                    <Calendar className="h-3 w-3" />
                    {t.fecha_limite}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-gray-4 group-hover:text-primary-5 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
