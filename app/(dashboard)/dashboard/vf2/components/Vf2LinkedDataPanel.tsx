'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2LinkedDataPanel.tsx
// Panel Linked Data: valor canónico actual del Fact Graph + historial de revisiones.
// Se carga bajo demanda (lazy) para no bloquear el render principal.

import { useState, useTransition } from 'react'
import { Link2, ChevronDown, ChevronRight, CheckCircle2, RotateCcw, Clock, AlertCircle } from 'lucide-react'
import { vf2GetLinkedData } from '@/app/actions/vf2-linked-data'
import type { FactActual, RevisionItem } from '@/app/actions/vf2-linked-data'

interface Props {
  metricPublicId: string
  metricCodigo: string
  metricNombre: string
  metricUnidad: string | null
}

function formatValue(fact: FactActual | RevisionItem): string {
  if ('value_num' in fact && fact.value_num !== null) {
    return `${Number(fact.value_num).toLocaleString('es-CL')}${('unidad' in fact && fact.unidad) ? ` ${fact.unidad}` : ''}`
  }
  if ('value_text' in fact && fact.value_text) return fact.value_text
  if ('value_json' in fact && fact.value_json) return JSON.stringify(fact.value_json)
  return '—'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_ICON = {
  approved: <CheckCircle2 className="h-3.5 w-3.5 text-success-6" />,
  superseded: <RotateCcw className="h-3.5 w-3.5 text-gray-4" />,
  draft: <Clock className="h-3.5 w-3.5 text-warning-6" />,
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Aprobado',
  superseded: 'Reemplazado',
  draft: 'Borrador',
}

export default function Vf2LinkedDataPanel({
  metricPublicId,
  metricCodigo,
  metricNombre,
  metricUnidad,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fact, setFact] = useState<FactActual | null>(null)
  const [revisiones, setRevisiones] = useState<RevisionItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showHistory, setShowHistory] = useState(false)

  function handleToggle() {
    if (!open && !loaded) {
      startTransition(async () => {
        const res = await vf2GetLinkedData({ metricPublicId })
        if (res.ok) {
          setFact(res.fact)
          setRevisiones(res.revisiones)
          setLoaded(true)
        } else {
          setError(res.error)
        }
      })
    }
    setOpen(prev => !prev)
  }

  return (
    <div className="border-t border-gray-3 bg-gray-1">
      {/* Header togglable */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 md:px-8 py-3 text-left hover:bg-gray-2 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-7">
          <Link2 className="h-4 w-4" />
          Linked Data
          <span className="text-xs font-normal text-gray-4">· {metricCodigo}</span>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-4" />
          : <ChevronRight className="h-4 w-4 text-gray-4" />
        }
      </button>

      {open && (
        <div className="px-4 md:px-8 pb-4 space-y-3">
          {isPending && (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-8 bg-gray-2 rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-critique-7">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loaded && !isPending && (
            <>
              {/* Métrica info */}
              <div className="text-xs text-gray-5">{metricNombre}{metricUnidad ? ` · ${metricUnidad}` : ''}</div>

              {/* Valor canónico actual */}
              {fact ? (
                <div className="bg-white border border-primary-3 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-6">Valor canónico actual</span>
                    <span className="flex items-center gap-1 text-xs text-success-7">
                      <CheckCircle2 className="h-3 w-3" />
                      {fact.revision_status ? STATUS_LABEL[fact.revision_status] ?? fact.revision_status : 'Sin revisión'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-9">
                    {formatValue(fact)}
                  </p>
                  {fact.periodo_inicio && (
                    <p className="text-xs text-gray-4 mt-1">
                      Período: {fact.periodo_inicio} → {fact.periodo_fin ?? '…'}
                    </p>
                  )}
                  {fact.aprobado_en && (
                    <p className="text-xs text-gray-4">
                      Aprobado: {formatDate(fact.aprobado_en)}
                    </p>
                  )}
                  {fact.nota && (
                    <p className="text-xs text-gray-5 italic mt-1">"{fact.nota}"</p>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-gray-2 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-4">Sin valor aprobado aún.</p>
                  <p className="text-xs text-gray-3 mt-0.5">El Fact se materializa al aprobar esta tarea.</p>
                </div>
              )}

              {/* Historial de revisiones */}
              {revisiones.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHistory(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-4 hover:text-gray-6 transition-colors"
                  >
                    {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Historial de revisiones ({revisiones.length})
                  </button>

                  {showHistory && (
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {revisiones.map(r => (
                        <div
                          key={r.revision_id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                            r.is_current
                              ? 'bg-success-1 border-success-3 text-success-8'
                              : 'bg-white border-gray-2 text-gray-6'
                          }`}
                        >
                          <span className="shrink-0">
                            {STATUS_ICON[r.status as keyof typeof STATUS_ICON] ?? <Clock className="h-3.5 w-3.5 text-gray-4" />}
                          </span>
                          <span className="flex-1 font-medium">{formatValue(r)}</span>
                          {r.is_current && (
                            <span className="shrink-0 text-xs text-success-7 font-semibold">actual</span>
                          )}
                          <span className="shrink-0 text-gray-4">
                            {formatDate(r.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {revisiones.length === 0 && fact && (
                <p className="text-xs text-gray-4">Sin historial de revisiones previas.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
