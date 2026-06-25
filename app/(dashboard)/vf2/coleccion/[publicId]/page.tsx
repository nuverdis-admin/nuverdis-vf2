// app/(dashboard)/vf2/coleccion/[publicId]/page.tsx — Lista de tareas de una colección
// SERVER COMPONENT

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { ChevronRight, Plus } from 'lucide-react'
import { VF2_ESTADO_BADGE, VF2_ESTADO_LABEL } from '@/lib/vf2/permisos'
import type { Vf2Coleccion, Vf2Tarea } from '@/lib/vf2/types'

export default async function Vf2ColeccionPage({
  params,
}: {
  params: { publicId: string }
}) {
  const actor = await requireSession()
  const supabase = await createClient()

  const { data: coleccion } = await supabase
    .from('vf2_coleccion')
    .select('*')
    .eq('public_id', params.publicId)
    .eq('empresa_id', actor.empresaId)
    .single()

  if (!coleccion) notFound()

  const col = coleccion as Vf2Coleccion

  const { data: tareas } = await supabase
    .from('vf2_tarea')
    .select('*')
    .eq('coleccion_id', col.coleccion_id)
    .order('created_at', { ascending: true })

  const listaTareas = (tareas ?? []) as Vf2Tarea[]

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-4">
        <Link href="/dashboard/vf2" className="hover:text-gray-7">Colecciones</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-7">{col.nombre}</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-9">{col.nombre}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-2 text-secondary-7">
              {col.estandar}
            </span>
          </div>
          {col.descripcion && <p className="text-sm text-gray-5">{col.descripcion}</p>}
        </div>
        {col.estado === 'activa' && actor.rol === 'administrador' && (
          <Link
            href={`/dashboard/vf2/coleccion/${params.publicId}/nueva-tarea`}
            className="btn btn-primary rounded-lg flex items-center gap-1.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Link>
        )}
      </div>

      {listaTareas.length === 0 ? (
        <div className="rounded-xl border border-gray-3 bg-gray-1 p-10 text-center">
          <p className="text-gray-5 text-sm">Sin tareas en esta colección.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {listaTareas.map(t => (
            <Link
              key={t.public_id}
              href={`/dashboard/vf2/tarea/${t.public_id}`}
              className="flex items-center justify-between rounded-xl border border-gray-3 bg-white px-5 py-3.5 hover:border-primary-4 hover:bg-primary-1/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VF2_ESTADO_BADGE[t.estado]}`}>
                  {VF2_ESTADO_LABEL[t.estado]}
                </span>
                <span className="text-sm font-medium text-gray-8">{t.titulo}</span>
              </div>
              <div className="flex items-center gap-3">
                {t.fecha_limite && (
                  <span className="text-xs text-gray-4">{t.fecha_limite}</span>
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
