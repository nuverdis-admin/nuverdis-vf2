// app/(dashboard)/dashboard/vf2/proyecto/[ref]/page.tsx
// SERVER — lista colecciones de un proyecto + modal crear colección

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { VF2_ESTADO_BADGE, VF2_ESTADO_LABEL } from '@/lib/vf2/permisos'
import Vf2CrearColeccionModal from '@/app/(dashboard)/dashboard/vf2/components/Vf2CrearColeccionModal'
import type { Vf2Coleccion } from '@/lib/vf2/types'

export default async function Vf2ProyectoPage({
  params,
}: {
  params: { ref: string }
}) {
  const actor = await requireSession()
  const supabase = await createClient()

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('proyecto_id, nombre_proyecto, ref')
    .eq('ref', params.ref)
    .eq('empresa_id', actor.empresaId)
    .single()

  if (!proyecto) notFound()

  const { data: colecciones } = await supabase
    .from('vf2_coleccion')
    .select('*')
    .eq('proyecto_id', proyecto.proyecto_id)
    .eq('empresa_id', actor.empresaId)
    .order('created_at', { ascending: true })

  const lista = (colecciones ?? []) as Vf2Coleccion[]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-4">
        <Link href={`/dashboard/org`} className="hover:text-gray-7">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/dashboard/proyecto/${params.ref}`} className="hover:text-gray-7">
          {proyecto.nombre_proyecto}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-7">Editor de colección</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-9 mb-0.5">Editor de colección</h1>
          <p className="text-sm text-gray-5">
            {proyecto.nombre_proyecto} — datos ESG con trazabilidad y aprobación por roles
          </p>
        </div>
        {actor.rol === 'administrador' && (
          <Vf2CrearColeccionModal
            proyectoId={proyecto.proyecto_id}
            proyectoRef={params.ref}
          />
        )}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-gray-3 bg-gray-1 p-12 text-center">
          <FolderOpen className="h-10 w-10 text-gray-4 mx-auto mb-3" />
          <p className="text-gray-6 font-medium mb-1">Sin colecciones aún</p>
          <p className="text-gray-4 text-sm">
            Las colecciones agrupan tareas de recolección de datos para un estándar (GRI, NCG, SASB).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(col => (
            <Link
              key={col.public_id}
              href={`/dashboard/vf2/proyecto/${params.ref}/coleccion/${col.public_id}`}
              className="flex items-center justify-between rounded-xl border border-gray-3 bg-white px-5 py-4 hover:border-primary-4 hover:bg-primary-1/30 transition-colors group"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-9">{col.nombre}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-2 text-secondary-7">
                    {col.estandar}
                  </span>
                  {col.estado === 'cerrada' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-2 text-gray-5">
                      Cerrada
                    </span>
                  )}
                </div>
                {col.descripcion && (
                  <p className="text-xs text-gray-4">{col.descripcion}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-gray-4 group-hover:text-primary-5 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
