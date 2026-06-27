'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { vf2CrearTarea } from '@/app/actions/vf2-tareas'

interface GriItem {
  id: number
  estandar: string
  jerarquia_1_nombre: string
  jerarquia_2_nombre: string | null
}

interface NcgItem {
  id: number
  estandar_nombre: string
  jerarquia_1: string
  jerarquia_1_nombre: string
  jerarquia_2_nombre: string | null
}

interface Props {
  coleccionPublicId: string
  proyectoRef: string
  estandar: 'GRI' | 'NCG' | 'SASB'
}

export default function Vf2CrearTareaModal({ coleccionPublicId, proyectoRef, estandar }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [titulo, setTitulo] = useState('')
  const [instruccion, setInstruccion] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [griItemId, setGriItemId] = useState<number | null>(null)
  const [ncgItemId, setNcgItemId] = useState<number | null>(null)
  const [griItems, setGriItems] = useState<GriItem[]>([])
  const [ncgItems, setNcgItems] = useState<NcgItem[]>([])
  const [itemsConTabla, setItemsConTabla] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Cargar items del estándar cuando se abre el modal
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    if (estandar === 'GRI') {
      Promise.all([
        supabase
          .from('gri_items_reporte')
          .select('id, estandar, jerarquia_1_nombre, jerarquia_2_nombre')
          .order('id', { ascending: true }),
        supabase
          .from('gri_items_requerimientos_reporte')
          .select('item_id')
          .not('tabla', 'is', null),
      ]).then(([items, tablas]) => {
        setGriItems((items.data as GriItem[] | null) ?? [])
        const ids = new Set<number>(((tablas.data as { item_id: number }[] | null) ?? []).map(r => r.item_id))
        setItemsConTabla(ids)
      })
    } else if (estandar === 'NCG') {
      Promise.all([
        supabase
          .from('ncg_items_reporte')
          .select('id, estandar_nombre, jerarquia_1, jerarquia_1_nombre, jerarquia_2_nombre')
          .order('id', { ascending: true }),
        supabase
          .from('ncg_items_requerimientos_reporte')
          .select('item_id')
          .not('tabla', 'is', null),
      ]).then(([items, tablas]) => {
        setNcgItems((items.data as NcgItem[] | null) ?? [])
        const ids = new Set<number>(((tablas.data as { item_id: number }[] | null) ?? []).map(r => r.item_id))
        setItemsConTabla(ids)
      })
    }
  }, [open, estandar])

  function handleClose() {
    setOpen(false)
    setTitulo('')
    setInstruccion('')
    setFechaLimite('')
    setGriItemId(null)
    setNcgItemId(null)
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
        griItemId: griItemId ?? undefined,
        ncgItemId: ncgItemId ?? undefined,
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
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5 max-h-[90vh] overflow-y-auto">
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
                  placeholder={estandar === 'GRI' ? 'Ej. Emisiones GEI Alcance 1 (305-1)' : estandar === 'NCG' ? 'Ej. Misión y visión corporativa (2.1)' : 'Ej. Métrica de sostenibilidad'}
                  required
                  className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                />
              </div>

              {/* Selector de item según estándar */}
              {estandar === 'GRI' && griItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-7 mb-1">
                    Item GRI <span className="text-gray-4 font-normal">(opcional)</span>
                  </label>
                  <select
                    value={griItemId ?? ''}
                    onChange={e => setGriItemId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                  >
                    <option value="">Sin vincular</option>
                    {griItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {itemsConTabla.has(item.id) ? '(T) ' : ''}{item.estandar} — {item.jerarquia_1_nombre}{item.jerarquia_2_nombre ? ` / ${item.jerarquia_2_nombre}` : ''}
                      </option>
                    ))}
                  </select>
                  {itemsConTabla.size > 0 && (
                    <p className="text-xs text-gray-4 italic mt-1">
                      * (T) indica que este ítem tiene una plantilla de tabla predefinida disponible.
                    </p>
                  )}
                </div>
              )}

              {estandar === 'NCG' && ncgItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-7 mb-1">
                    Item NCG <span className="text-gray-4 font-normal">(opcional)</span>
                  </label>
                  <select
                    value={ncgItemId ?? ''}
                    onChange={e => setNcgItemId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm text-gray-8 focus:outline-none focus:border-primary-4"
                  >
                    <option value="">Sin vincular</option>
                    {ncgItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {itemsConTabla.has(item.id) ? '(T) ' : ''}{item.jerarquia_1} {item.jerarquia_1_nombre}{item.jerarquia_2_nombre ? ` / ${item.jerarquia_2_nombre}` : ''}
                      </option>
                    ))}
                  </select>
                  {itemsConTabla.size > 0 && (
                    <p className="text-xs text-gray-4 italic mt-1">
                      * (T) indica que este ítem tiene una plantilla de tabla predefinida disponible.
                    </p>
                  )}
                </div>
              )}

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
