'use client'
// Vf2CrearColeccionModal.tsx — Modal para crear una colección vf2_

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { vf2CrearColeccion } from '@/app/actions/vf2-tareas'

interface Props {
  proyectoId: number
  proyectoRef: string
}

const ESTANDARES = ['GRI', 'NCG', 'SASB'] as const

export default function Vf2CrearColeccionModal({ proyectoId, proyectoRef }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [nombre, setNombre] = useState('')
  const [estandar, setEstandar] = useState<'GRI' | 'NCG' | 'SASB'>('GRI')
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setOpen(false)
    setNombre('')
    setEstandar('GRI')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await vf2CrearColeccion({ proyectoId, estandar, nombre })
      if (!res.ok) {
        setError(res.error)
        return
      }
      handleClose()
      router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary rounded-lg flex items-center gap-1.5 text-sm"
      >
        <Plus className="h-4 w-4" />
        Nueva colección
      </button>

      {open && (
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
                <select
                  value={estandar}
                  onChange={e => setEstandar(e.target.value as typeof estandar)}
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                >
                  {ESTANDARES.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-7 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej. Colección GRI 2024"
                  required
                  className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                />
              </div>

              {error && (
                <p className="text-sm text-critique-6">{error}</p>
              )}

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
                  {isPending ? 'Creando…' : 'Crear colección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
