'use client'
// Sidenav de proyecto — colecciones vf2_ con modal de creación integrado.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Plus, ChevronRight, X } from 'lucide-react'
import { vf2CrearColeccion } from '@/app/actions/vf2-tareas'

interface Coleccion {
  public_id: string
  nombre: string
  estandar: string
  estado: string
}

interface Props {
  proyectoRef: string
  proyectoNombre: string
  proyectoId: number
  empresaRef: string
  colecciones: Coleccion[]
  esAdmin: boolean
}

const ESTANDAR_LABEL: Record<string, string> = {
  GRI: 'GRI',
  NCG: 'NCG 461',
  SASB: 'SASB',
}

const ESTANDAR_COLOR: Record<string, string> = {
  GRI: 'bg-success-1 text-success-7',
  NCG: 'bg-secondary-2 text-secondary-7',
  SASB: 'bg-gray-2 text-gray-6',
}

const ESTADO_DOT: Record<string, string> = {
  activa: 'bg-primary-5',
  cerrada: 'bg-gray-3',
  archivada: 'bg-gray-2',
}

const ESTANDARES = ['GRI', 'NCG', 'SASB'] as const

export default function Vf2ProyectoSidenav({
  proyectoRef,
  proyectoNombre,
  proyectoId,
  empresaRef,
  colecciones,
  esAdmin,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [estandar, setEstandar] = useState<'GRI' | 'NCG' | 'SASB'>('GRI')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = `/dashboard/proyecto/${proyectoRef}`

  const byEstandar = colecciones.reduce<Record<string, Coleccion[]>>((acc, c) => {
    const k = c.estandar ?? 'Otro'
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  function handleClose() {
    setModalOpen(false)
    setNombre('')
    setEstandar('GRI')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      const res = await vf2CrearColeccion({ proyectoId, estandar, nombre })
      if (!res.ok) {
        setError(res.error)
        return
      }
      handleClose()
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
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
              {esAdmin && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-gray-3 hover:text-primary-6 transition-colors"
                  title="Nueva colección"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {colecciones.length === 0 ? (
              <div className="px-3 py-2">
                <p className="text-xs text-gray-3">Sin colecciones.</p>
                {esAdmin && (
                  <button
                    onClick={() => setModalOpen(true)}
                    className="mt-1 text-xs text-primary-5 hover:text-primary-7 underline underline-offset-2"
                  >
                    Crear la primera
                  </button>
                )}
              </div>
            ) : (
              Object.entries(byEstandar).map(([est, cols]) => (
                <div key={est} className="mb-2">
                  <div className="flex items-center gap-1.5 px-3 py-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTANDAR_COLOR[est] ?? 'bg-gray-2 text-gray-6'}`}>
                      {ESTANDAR_LABEL[est] ?? est}
                    </span>
                  </div>
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

        {/* Footer — link configuración */}
        {esAdmin && (
          <div className="px-4 py-3 border-t border-gray-2">
            <Link
              href={`${baseUrl}/configuracion`}
              className="text-xs text-gray-4 hover:text-gray-6 transition-colors"
            >
              Configuración del proyecto
            </Link>
          </div>
        )}
      </aside>

      {/* Modal crear colección */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-9">Nueva colección</h2>
              <button onClick={handleClose} className="text-gray-4 hover:text-gray-7">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-7 mb-1">
                  Estándar
                </label>
                <div className="flex gap-2">
                  {ESTANDARES.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEstandar(e)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        estandar === e
                          ? 'border-primary-5 bg-primary-1 text-primary-7'
                          : 'border-gray-3 text-gray-6 hover:border-gray-4'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-7 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder={`Ej. Colección ${estandar} ${new Date().getFullYear()}`}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                />
              </div>

              {error && <p className="text-sm text-critique-6">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 btn btn-outline rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !nombre.trim()}
                  className="flex-1 btn btn-primary rounded-lg text-sm disabled:opacity-50"
                >
                  {isPending ? 'Creando…' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
