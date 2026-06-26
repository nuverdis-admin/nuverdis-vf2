'use client'
// Sidenav de proyecto para el hub vf2_ — muestra colecciones agrupadas por estándar.
// Reemplaza ProyectoSidenav legacy (que mostraba tipos GRI/NCG con conteos de tareas legacy).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Layers, Plus, ChevronRight } from 'lucide-react'

interface Coleccion {
  public_id: string
  nombre: string
  estandar: string
  estado: string
}

interface Props {
  proyectoRef: string
  proyectoNombre: string
  empresaRef: string
  colecciones: Coleccion[]
  esAdmin: boolean
  onCrearColeccion?: () => void
}

const ESTANDAR_LABEL: Record<string, string> = {
  GRI: 'GRI',
  NCG: 'NCG 461',
  SASB: 'SASB',
}

const ESTADO_DOT: Record<string, string> = {
  activa: 'bg-primary-5',
  cerrada: 'bg-gray-3',
  archivada: 'bg-gray-2',
}

export default function Vf2ProyectoSidenav({
  proyectoRef,
  proyectoNombre,
  empresaRef,
  colecciones,
  esAdmin,
  onCrearColeccion,
}: Props) {
  const pathname = usePathname()

  const baseUrl = `/dashboard/proyecto/${proyectoRef}`

  // Agrupar por estándar
  const byEstandar = colecciones.reduce<Record<string, Coleccion[]>>((acc, c) => {
    const k = c.estandar ?? 'Otro'
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-gray-3 bg-white h-full overflow-y-auto z-30">
      {/* Header proyecto */}
      <div className="px-4 py-4 border-b border-gray-2">
        <Link
          href={`/dashboard/org/${empresaRef}`}
          className="text-xs text-gray-4 hover:text-gray-6 flex items-center gap-1 mb-1"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Proyectos
        </Link>
        <p className="text-sm font-bold text-gray-9 truncate" title={proyectoNombre}>
          {proyectoNombre}
        </p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {/* Overview */}
        <Link
          href={baseUrl}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === baseUrl
              ? 'bg-primary-1 text-primary-7 font-semibold'
              : 'text-gray-6 hover:bg-gray-1 hover:text-gray-8'
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Overview
        </Link>

        {/* Colecciones */}
        <div className="pt-3">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs font-semibold text-gray-4 uppercase tracking-wide">
              Colecciones
            </span>
            {esAdmin && onCrearColeccion && (
              <button
                onClick={onCrearColeccion}
                className="text-gray-3 hover:text-primary-6 transition-colors"
                title="Nueva colección"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {colecciones.length === 0 ? (
            <p className="px-3 text-xs text-gray-3 py-2">Sin colecciones</p>
          ) : (
            Object.entries(byEstandar).map(([estandar, cols]) => (
              <div key={estandar} className="mb-2">
                <p className="px-3 py-1 text-[10px] font-bold text-gray-3 uppercase tracking-widest">
                  {ESTANDAR_LABEL[estandar] ?? estandar}
                </p>
                {cols.map(col => {
                  const href = `${baseUrl}/coleccion/${col.public_id}`
                  const active = pathname.startsWith(href)
                  return (
                    <Link
                      key={col.public_id}
                      href={href}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        active
                          ? 'bg-primary-1 text-primary-7 font-semibold'
                          : 'text-gray-6 hover:bg-gray-1 hover:text-gray-8'
                      }`}
                    >
                      <span
                        className={`shrink-0 h-1.5 w-1.5 rounded-full ${ESTADO_DOT[col.estado] ?? 'bg-gray-3'}`}
                      />
                      <span className="truncate">{col.nombre}</span>
                    </Link>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </nav>
    </aside>
  )
}
