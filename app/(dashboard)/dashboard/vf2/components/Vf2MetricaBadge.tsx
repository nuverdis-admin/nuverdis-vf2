'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2MetricaBadge.tsx
// Muestra la métrica vinculada a una tarea y permite crear una si no existe.
// Es la pieza que conecta la tarea con el Fact Graph al aprobar.

import { useState, useTransition } from 'react'
import { Hash, Plus, X, Check } from 'lucide-react'
import { vf2CrearMetrica } from '@/app/actions/vf2-tareas'
import type { Vf2Metric } from '@/lib/vf2/types'

interface Props {
  metrica: Vf2Metric | null
  griItemId: number | null
  ncgItemId: number | null
  tareaPublicId: string
  esAdmin: boolean
  onMetricaCreada: (metrica: Vf2Metric) => void
}

export default function Vf2MetricaBadge({
  metrica: metricaInit,
  griItemId,
  ncgItemId,
  esAdmin,
  onMetricaCreada,
}: Props) {
  const [metrica, setMetrica] = useState<Vf2Metric | null>(metricaInit)
  const [showForm, setShowForm] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [valueKind, setValueKind] = useState<'num' | 'text' | 'json'>('num')
  const [unidad, setUnidad] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCrear() {
    if (!codigo || !nombre) {
      setError('Código y nombre son obligatorios')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await vf2CrearMetrica({
        codigo,
        nombre,
        valueKind,
        unidad: unidad || undefined,
        griItemId: griItemId ?? undefined,
        ncgItemId: ncgItemId ?? undefined,
      })
      if (res.ok) {
        const nueva: Vf2Metric = {
          metric_id: 0,
          empresa_id: 0,
          public_id: res.metricPublicId,
          codigo,
          nombre,
          descripcion: null,
          value_kind: valueKind,
          unidad: unidad || null,
          data_type_meta: {},
          gri_item_id: griItemId,
          gri_requerimiento_id: null,
          ncg_item_id: ncgItemId,
          ncg_requerimiento_id: null,
          gri_tabla_template: null,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setMetrica(nueva)
        onMetricaCreada(nueva)
        setShowForm(false)
      } else {
        setError(res.error)
      }
    })
  }

  if (metrica) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary-1 border border-primary-3 rounded-lg text-xs text-primary-7">
        <Hash className="h-3 w-3" />
        <span className="font-medium">{metrica.codigo}</span>
        <span className="text-primary-5">·</span>
        <span>{metrica.nombre}</span>
        {metrica.unidad && (
          <>
            <span className="text-primary-5">·</span>
            <span className="text-primary-5">{metrica.unidad}</span>
          </>
        )}
      </div>
    )
  }

  if (!esAdmin) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning-9 bg-warning-1 px-2 py-0.5 rounded-lg">
        Sin métrica vinculada — la aprobación no materializará Facts
      </span>
    )
  }

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-4 hover:text-primary-6 border border-dashed border-gray-3 px-2 py-1 rounded-lg hover:border-primary-4 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Vincular métrica (necesario para aprobar)
        </button>
      ) : (
        <div className="bg-white border border-gray-3 rounded-xl p-4 shadow-sm max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-7">Nueva métrica</p>
            <button onClick={() => setShowForm(false)} className="text-gray-3 hover:text-gray-5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              placeholder="Código (ej. GRI-305-1)"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              className="w-full text-xs border border-gray-3 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-4"
            />
            <input
              type="text"
              placeholder="Nombre (ej. Emisiones GEI Alcance 1)"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full text-xs border border-gray-3 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-4"
            />
            <div className="flex gap-2">
              <select
                value={valueKind}
                onChange={e => setValueKind(e.target.value as 'num' | 'text' | 'json')}
                className="flex-1 text-xs border border-gray-3 rounded-lg px-2 py-1.5"
              >
                <option value="num">Numérico</option>
                <option value="text">Texto</option>
                <option value="json">Tabla/JSON</option>
              </select>
              <input
                type="text"
                placeholder="Unidad (tCO2e)"
                value={unidad}
                onChange={e => setUnidad(e.target.value)}
                className="flex-1 text-xs border border-gray-3 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-4"
              />
            </div>
          </div>

          {griItemId && (
            <p className="text-xs text-gray-4 mt-2">
              Se vinculará al item GRI #{griItemId}
            </p>
          )}
          {ncgItemId && (
            <p className="text-xs text-gray-4 mt-2">
              Se vinculará al item NCG #{ncgItemId}
            </p>
          )}

          {error && <p className="text-xs text-critique-7 mt-2">{error}</p>}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCrear}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1 bg-primary-5 text-white text-xs py-1.5 rounded-lg hover:bg-primary-6 disabled:opacity-50 transition-colors"
            >
              <Check className="h-3 w-3" />
              Crear y vincular
            </button>
            <button
              onClick={() => setShowForm(false)}
              disabled={isPending}
              className="flex-1 text-xs text-gray-5 border border-gray-3 py-1.5 rounded-lg hover:bg-gray-1 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
