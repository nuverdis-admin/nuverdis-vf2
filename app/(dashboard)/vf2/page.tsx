// app/(dashboard)/vf2/page.tsx — Landing del módulo Fact Graph
// SERVER COMPONENT — lista colecciones del proyecto activo o vista de onboarding

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import Link from 'next/link'
import { ChevronRight, FolderOpen, PlusCircle } from 'lucide-react'
import type { Vf2Coleccion } from '@/lib/vf2/types'

interface SearchParams {
  proyectoId?: string
}

export default async function Vf2LandingPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireSession()
  const supabase = await createClient()

  let colecciones: Vf2Coleccion[] = []

  if (searchParams.proyectoId) {
    const proyectoId = parseInt(searchParams.proyectoId, 10)
    if (!isNaN(proyectoId)) {
      const { data } = await supabase
        .from('vf2_coleccion')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true })
      colecciones = (data ?? []) as Vf2Coleccion[]
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-9 mb-1">Editor de colección</h1>
        <p className="text-gray-5 text-sm">
          Ingresa datos ESG con trazabilidad completa, co-edición en vivo y aprobación por roles.
        </p>
      </div>

      {colecciones.length === 0 ? (
        <div className="rounded-xl border border-gray-3 bg-gray-1 p-12 text-center">
          <FolderOpen className="h-10 w-10 text-gray-4 mx-auto mb-4" />
          <p className="text-gray-6 mb-2 font-medium">Sin colecciones aún</p>
          <p className="text-gray-4 text-sm mb-6">
            Las colecciones agrupan las tareas de recolección de datos para un proyecto y estándar.
          </p>
          <p className="text-gray-4 text-xs">
            Selecciona un proyecto con{' '}
            <code className="bg-gray-2 px-1 rounded">?proyectoId=X</code> para comenzar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {colecciones.map(col => (
            <Link
              key={col.public_id}
              href={`/dashboard/vf2/coleccion/${col.public_id}`}
              className="flex items-center justify-between rounded-xl border border-gray-3 bg-white px-5 py-4 hover:border-primary-4 hover:bg-primary-1/30 transition-colors group"
            >
              <div>
                <div className="flex items-center gap-2">
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
                  <p className="text-xs text-gray-4 mt-0.5">{col.descripcion}</p>
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
