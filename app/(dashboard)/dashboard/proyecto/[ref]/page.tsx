// app/(dashboard)/dashboard/proyecto/[ref]/page.tsx
// SERVER — Overview del proyecto con stats vf2_ (reemplaza el legacy GRI/NCG overview).

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/supabase/auth-guard'
import { getProyectoByRef } from '@/lib/proyecto/data'
import Vf2OverviewSection from './components/Vf2OverviewSection'

export default async function ProyectoOverviewPage({
  params,
}: {
  params: { ref: string }
}) {
  const [actor, proyecto] = await Promise.all([
    requireSession(),
    getProyectoByRef(params.ref),
  ])

  if (!proyecto) notFound()

  const supabase = await createClient()

  // Nombre del actor
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('nombre_completo')
    .eq('uid', actor.uid)
    .single()
  const nombreCompleto = (usuarioData as { nombre_completo?: string } | null)?.nombre_completo ?? 'Usuario'

  // Overview vf2 (RPC server-side)
  const { data: statsRaw, error: statsError } = await supabase.rpc(
    'vf2_overview_proyecto',
    { p_proyecto_id: proyecto.proyecto_id }
  )

  const stats = statsRaw as {
    total: number
    borrador: number
    en_preparacion: number
    en_revision: number
    en_aprobacion: number
    aprobada: number
    devuelta: number
    colecciones: number
    facts_aprobados: number
    atrasadas: number
  } | null

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-9">
          ¡Hola, {nombreCompleto}!
        </h1>
        <p className="text-gray-6 mt-1">
          Resumen de{' '}
          <span className="font-semibold text-gray-8">{proyecto.nombre_proyecto}</span>
        </p>
      </div>

      {statsError ? (
        <p className="text-sm text-critique-6">Error al cargar overview.</p>
      ) : (
        <Vf2OverviewSection
          stats={stats}
          proyectoRef={params.ref}
          proyectoNombre={proyecto.nombre_proyecto}
        />
      )}
    </div>
  )
}
