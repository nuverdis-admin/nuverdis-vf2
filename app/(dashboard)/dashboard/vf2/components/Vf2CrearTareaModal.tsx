'use client'
// Vf2CrearTareaModal.tsx — Modal para crear una tarea vf2_

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { vf2CrearTarea } from '@/app/actions/vf2-tareas'

interface Props {
  coleccionPublicId: string
  proyectoRef: string
}

export default function Vf2CrearTareaModal({ coleccionPublicId, proyectoRef }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [titulo, setTitulo] = useState('')
  const [instruccion, setInstruccion] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setOpen(false)
    setTitulo('')
    setInstruccion('')
    setFechaLimite('')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await vf2CrearTarea({
        coleccionPublicId,
        titulo,
        instruccion: instruccion || undefined,
        fechaLimite: fechaLimite || undefined,
      })
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
        Nueva tarea
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-9">Nueva tarea</h2>
              <button onClick={handleClose} className="text-gray-4 hover:text-gray-7">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-7 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ej. Emisiones GEI Alcance 1 (305-1)"
                  required
                  className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-7 mb-1">
                  Instrucción <span className="text-gray-4 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={instruccion}
                  onChange={e => setInstruccion(e.target.value)}
                  rows={3}
                  placeholder="Describe qué debe completar el preparador…"
                  className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-7 mb-1">
                  Fecha límite <span className="text-gray-4 font-normal">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={fechaLimite}
                  onChange={e => setFechaLimite(e.target.value)}
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
                  disabled={isPending || !titulo.trim()}
                  className="flex-1 btn btn-primary rounded-lg text-sm disabled:opacity-50"
                >
                  {isPending ? 'Creando…' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
