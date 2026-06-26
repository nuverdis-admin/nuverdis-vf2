// app/(dashboard)/dashboard/proyecto/[ref]/layout.tsx
// SERVER — Layout del proyecto con sidenav de colecciones vf2_.
// Reemplaza el layout legacy que usaba ProyectoSidenav + conteos GRI/NCG.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { getCurrentEmpresa, getProyectoByRef } from '@/lib/proyecto/data'
import Vf2ProyectoSidenav from './components/Vf2ProyectoSidenav'

interface Coleccion {
  public_id: string
  nombre: string
  estandar: string
  estado: string
}

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { ref: string }
}) {
  const [actor, empresa, proyecto] = await Promise.all([
    requireSession(),
    getCurrentEmpresa(),
    getProyectoByRef(params.ref),
  ])

  if (!proyecto) notFound()

  // Proyecto archivado: solo admins pueden acceder
  if (proyecto.archivado_at && actor.rol !== 'administrador') {
    redirect(`/dashboard/org/${empresa?.ref ?? ''}`)
  }

  // Cargar colecciones vf2_ del proyecto
  const supabase = await createClient()
  const { data: coleccionesRaw } = await supabase
    .from('vf2_coleccion')
    .select('public_id, nombre, estandar, estado')
    .eq('proyecto_id', proyecto.proyecto_id)
    .eq('empresa_id', actor.empresaId)
    .order('created_at', { ascending: true })

  const colecciones = (coleccionesRaw ?? []) as Coleccion[]
  const esAdmin = actor.rol === 'administrador'

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] overflow-hidden md:-m-8">
      <Vf2ProyectoSidenav
        proyectoRef={params.ref}
        proyectoNombre={proyecto.nombre_proyecto}
        proyectoId={parseInt(proyecto.proyecto_id, 10)}
        empresaRef={empresa?.ref ?? ''}
        colecciones={colecciones}
        esAdmin={esAdmin}
      />
      <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
        {children}
      </div>
    </div>
  )
}
