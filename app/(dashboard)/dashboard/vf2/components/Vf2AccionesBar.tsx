'use client'
// app/(dashboard)/vf2/components/Vf2AccionesBar.tsx — Barra de acciones de workflow

import { useState } from 'react'
import { CheckCircle, RotateCcw, ArrowRight, Loader2, Play } from 'lucide-react'
import type { Vf2TareaEstado } from '@/lib/vf2/types'

interface Props {
  estado: Vf2TareaEstado
  isPending: boolean
  puedeIniciarPreparacion: boolean
  puedeEnviarRevision: boolean
  puedeEnviarAprobacion: boolean
  puedeAprobar: boolean
  puedeDevolver: boolean
  onIniciarPreparacion: () => void
  onEnviarRevision: () => void
  onEnviarAprobacion: () => void
  onAprobar: (notas?: string) => void
  onDevolver: (nota: string) => void
}

export default function Vf2AccionesBar({
  isPending,
  puedeIniciarPreparacion,
  puedeEnviarRevision,
  puedeEnviarAprobacion,
  puedeAprobar,
  puedeDevolver,
  onIniciarPreparacion,
  onEnviarRevision,
  onEnviarAprobacion,
  onAprobar,
  onDevolver,
}: Props) {
  const [modalDevolver, setModalDevolver] = useState(false)
  const [modalAprobar, setModalAprobar] = useState(false)
  const [nota, setNota] = useState('')
  const [notasAprobacion, setNotasAprobacion] = useState('')

  if (
    !puedeIniciarPreparacion &&
    !puedeEnviarRevision &&
    !puedeEnviarAprobacion &&
    !puedeAprobar &&
    !puedeDevolver
  ) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-4" />}

        {puedeIniciarPreparacion && (
          <button
            onClick={onIniciarPreparacion}
            disabled={isPending}
            className="btn btn-primary rounded-lg text-sm flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Iniciar preparación
          </button>
        )}

        {puedeDevolver && (
          <button
            onClick={() => setModalDevolver(true)}
            disabled={isPending}
            className="btn btn-outline rounded-lg text-sm flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Devolver
          </button>
        )}

        {puedeEnviarRevision && (
          <button
            onClick={onEnviarRevision}
            disabled={isPending}
            className="btn btn-primary rounded-lg text-sm flex items-center gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Enviar a revisión
          </button>
        )}

        {puedeEnviarAprobacion && (
          <button
            onClick={onEnviarAprobacion}
            disabled={isPending}
            className="btn btn-primary rounded-lg text-sm flex items-center gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Enviar a aprobación
          </button>
        )}

        {puedeAprobar && (
          <button
            onClick={() => setModalAprobar(true)}
            disabled={isPending}
            className="bg-primary-5 hover:bg-primary-6 text-white text-sm px-4 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Aprobar
          </button>
        )}
      </div>

      {/* Modal devolver */}
      {modalDevolver && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-warning-5">
            <h2 className="text-base font-bold text-gray-9 mb-1">Devolver tarea</h2>
            <p className="text-sm text-gray-5 mb-4">Indica el motivo de devolución al preparador.</p>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Motivo de devolución..."
              className="w-full border border-gray-3 rounded-lg px-3 py-2 text-sm text-gray-8 resize-none focus:outline-none focus:border-primary-4 h-24"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setModalDevolver(false); setNota('') }}
                className="btn btn-ghost rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDevolver(nota)
                  setModalDevolver(false)
                  setNota('')
                }}
                disabled={!nota.trim() || isPending}
                className="bg-warning-5 hover:bg-warning-6 text-white text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                Devolver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal aprobar */}
      {modalAprobar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            <h2 className="text-base font-bold text-gray-9 mb-1">Aprobar tarea</h2>
            <p className="text-sm text-gray-5 mb-4">
              Al aprobar, los valores serán materializados como Facts en el Fact Graph.
            </p>
            <textarea
              value={notasAprobacion}
              onChange={e => setNotasAprobacion(e.target.value)}
              placeholder="Notas de aprobación (opcional)..."
              className="w-full border border-gray-3 rounded-lg px-3 py-2 text-sm text-gray-8 resize-none focus:outline-none focus:border-primary-4 h-20"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setModalAprobar(false); setNotasAprobacion('') }}
                className="btn btn-ghost rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onAprobar(notasAprobacion || undefined)
                  setModalAprobar(false)
                  setNotasAprobacion('')
                }}
                disabled={isPending}
                className="bg-primary-5 hover:bg-primary-6 text-white text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Confirmar aprobación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
