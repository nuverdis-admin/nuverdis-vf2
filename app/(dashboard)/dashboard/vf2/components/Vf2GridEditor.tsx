'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2GridEditor.tsx
// Editor de celdas vf2_ con glide-data-grid + co-edición Yjs/Hocuspocus.
// Invariante: el valor canónico NUNCA se determina aquí; solo al aprobar via RPC.
// Co-edición: Hocuspocus en wss://collab.nuverdis.com via token efímero (60s TTL).
// Degradación: si el WS no conecta, autosave directo a vf2_cell vía server action.
// A1: cada celda lleva su coordenada (metric_id, periodo_inicio/fin) en `validation`
//     derivada de la config de fila/columna → el RPC materializa 1 Fact por coordenada.

import { useState, useCallback, useRef, useEffect, useTransition } from 'react'
import DataEditor, {
  type GridCell,
  type GridColumn,
  type Item,
  GridCellKind,
  type EditableGridCell,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Settings2, ChevronDown, ChevronUp, Plus, Check, X } from 'lucide-react'
import { vf2GuardarCeldas, vf2CrearMetrica } from '@/app/actions/vf2-tareas'
import { vf2EmitirTokenColab } from '@/app/actions/vf2-colab'
import type { Vf2Sheet, Vf2Cell } from '@/lib/vf2/types'
import { rowKey, colKey } from '@/lib/vf2/fact-coord'

interface MetricaMin {
  metric_id: number
  public_id: string
  codigo: string
  nombre: string
  unidad: string | null
}

interface Props {
  sheet: Vf2Sheet
  celdas: Vf2Cell[]
  puedeEditar: boolean
  tareaPublicId: string
  metricas: MetricaMin[]
  esAdmin: boolean
}

type ColabStatus = 'connecting' | 'connected' | 'degraded' | 'readonly'

interface RowConfig { metricId: number | null }
interface ColConfig { year: number | null }

interface DirtyCellPayload {
  rowKey: string
  colKey: string
  valueNum: number | null
  valueText: string | null
}

const AUTOSAVE_DELAY_MS = 1200
const DEFAULT_ROWS = 10
const DEFAULT_COLS = 5
const COLAB_URL = process.env.NEXT_PUBLIC_VF2_COLLAB_URL ?? 'wss://collab.nuverdis.com'

function buildMatrix(celdas: Vf2Cell[]): Map<string, Vf2Cell> {
  const map = new Map<string, Vf2Cell>()
  for (const c of celdas) map.set(`${c.row_key}:${c.col_key}`, c)
  return map
}

function cellDisplayValue(cell: Vf2Cell | undefined): string {
  if (!cell) return ''
  if (cell.value_num !== null && cell.value_num !== undefined) return String(cell.value_num)
  return cell.value_text ?? ''
}

function makeDefaultRowConfigs(n: number): RowConfig[] {
  return Array.from({ length: n }, () => ({ metricId: null }))
}

function makeDefaultColConfigs(n: number): ColConfig[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: n }, (_, i) => ({ year: currentYear - (n - 1 - i) }))
}

export default function Vf2GridEditor({ sheet, celdas, puedeEditar, metricas, esAdmin }: Props) {
  const [rows] = useState(DEFAULT_ROWS)
  const [cols] = useState(DEFAULT_COLS)

  const [matrix, setMatrix] = useState<Map<string, Vf2Cell>>(() => buildMatrix(celdas))
  const [colabStatus, setColabStatus] = useState<ColabStatus>(puedeEditar ? 'connecting' : 'readonly')
  const [presenceCount, setPresenceCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // Catálogo de métricas de la empresa — estado local para reflejar altas sin recargar.
  const [catalogo, setCatalogo] = useState<MetricaMin[]>(metricas)

  // Formulario inline "+ nueva métrica" (solo admin)
  const [showMetricaForm, setShowMetricaForm] = useState(false)
  const [mCodigo, setMCodigo] = useState('')
  const [mNombre, setMNombre] = useState('')
  const [mValueKind, setMValueKind] = useState<'num' | 'text' | 'json'>('num')
  const [mUnidad, setMUnidad] = useState('')
  const [mError, setMError] = useState<string | null>(null)
  const [isCreatingMetrica, startCrearMetrica] = useTransition()

  // Configuración de coordenadas por fila y columna (A1)
  const [rowConfigs, setRowConfigs] = useState<RowConfig[]>(() => makeDefaultRowConfigs(DEFAULT_ROWS))
  const [colConfigs, setColConfigs] = useState<ColConfig[]>(() => makeDefaultColConfigs(DEFAULT_COLS))

  function handleCrearMetrica() {
    if (!mCodigo.trim() || !mNombre.trim()) {
      setMError('Código y nombre son obligatorios')
      return
    }
    setMError(null)
    startCrearMetrica(async () => {
      const res = await vf2CrearMetrica({
        codigo: mCodigo.trim(),
        nombre: mNombre.trim(),
        valueKind: mValueKind,
        unidad: mUnidad.trim() || undefined,
      })
      if (res.ok) {
        setCatalogo(prev =>
          prev.some(m => m.metric_id === res.metrica.metric_id) ? prev : [...prev, res.metrica]
        )
        setMCodigo('')
        setMNombre('')
        setMUnidad('')
        setMValueKind('num')
        setShowMetricaForm(false)
      } else {
        setMError(res.error)
      }
    })
  }

  const dirtyRef = useRef<Map<string, DirtyCellPayload>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowConfigsRef = useRef(rowConfigs)
  const colConfigsRef = useRef(colConfigs)

  // Mantener refs en sync con state (para el closure de flushAutosave)
  useEffect(() => { rowConfigsRef.current = rowConfigs }, [rowConfigs])
  useEffect(() => { colConfigsRef.current = colConfigs }, [colConfigs])

  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const ycellsRef = useRef<Y.Map<string> | null>(null)

  // ── Inicializar co-edición ────────────────────────────────────────────────
  useEffect(() => {
    if (!puedeEditar) {
      setColabStatus('readonly')
      return
    }

    let provider: HocuspocusProvider | null = null
    let destroyed = false

    async function initColab() {
      const tokenResult = await vf2EmitirTokenColab({ sheetPublicId: sheet.public_id })
      if (!tokenResult.ok || destroyed) {
        setColabStatus('degraded')
        return
      }

      const { token, docName } = tokenResult
      const ydoc = new Y.Doc()
      ydocRef.current = ydoc

      const ycells = ydoc.getMap<string>('cells')
      ycellsRef.current = ycells

      ydoc.transact(() => {
        matrix.forEach((cell, key) => {
          const v = cellDisplayValue(cell)
          if (v !== '') ycells.set(key, v)
        })
      })

      ycells.observe(() => {
        if (destroyed) return
        setMatrix(prev => {
          const next = new Map(prev)
          ycells.forEach((value, key) => {
            const [rk, ck] = key.split(':')
            const existing = next.get(key)
            const numValue = value !== '' && !isNaN(Number(value)) ? Number(value) : null
            const textValue = numValue === null ? value : null
            next.set(key, {
              ...(existing ?? {
                cell_id: 0,
                empresa_id: 0,
                sheet_id: sheet.sheet_id,
                row_key: rk,
                col_key: ck,
                cell_kind: 'input' as const,
                fact_ref_id: null,
                formula: null,
                validation: {},
                created_at: '',
                updated_at: '',
              }),
              row_key: rk,
              col_key: ck,
              value_num: numValue,
              value_text: textValue,
              value_json: null,
              estado_celda: 'borrador',
            } as Vf2Cell)
          })
          return next
        })
      })

      provider = new HocuspocusProvider({
        url: `${COLAB_URL}/${docName}`,
        name: docName,
        document: ydoc,
        token,
        onConnect() { if (!destroyed) setColabStatus('connected') },
        onDisconnect() { if (!destroyed) setColabStatus('degraded') },
        onAwarenessUpdate({ states }) { if (!destroyed) setPresenceCount(states.length) },
      })

      providerRef.current = provider
    }

    initColab()

    return () => {
      destroyed = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      provider?.destroy()
      ydocRef.current?.destroy()
      ydocRef.current = null
      providerRef.current = null
      ycellsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.public_id, puedeEditar])

  // ── Columnas del grid ─────────────────────────────────────────────────────
  const columns: GridColumn[] = Array.from({ length: cols }, (_, i) => ({
    title: colConfigs[i]?.year ? String(colConfigs[i].year) : `Col ${i + 1}`,
    id: colKey(i),
    width: 160,
  }))

  // ── Render de celda ───────────────────────────────────────────────────────
  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const rk = rowKey(row)
      const ck = colKey(col)
      const cell = matrix.get(`${rk}:${ck}`)
      const isInput = !cell || cell.cell_kind === 'input'
      const value = cellDisplayValue(cell)
      const canEdit = puedeEditar && isInput && colabStatus !== 'readonly'

      if (!canEdit) {
        return {
          kind: GridCellKind.Text,
          displayData: value,
          data: value,
          allowOverlay: false,
          readonly: true,
          style: cell?.estado_celda === 'aprobada' ? 'faded' : 'normal',
        }
      }

      return {
        kind: GridCellKind.Text,
        displayData: value,
        data: value,
        allowOverlay: true,
        readonly: false,
        themeOverride: {
          bgCell: '#EFF6FF',
          bgCellMedium: '#DBEAFE',
          accentColor: '#3B82F6',
          textDark: '#1E3A5F',
        },
      }
    },
    [matrix, puedeEditar, colabStatus]
  )

  // ── Autosave con coordenada por celda (A1) ────────────────────────────────
  const flushAutosave = useCallback(async () => {
    const dirtyCells = Array.from(dirtyRef.current.values())
    if (dirtyCells.length === 0) return
    dirtyRef.current.clear()
    setIsDirty(false)
    setIsSaving(true)

    const cells = dirtyCells.map(c => {
      const rowIdx = parseInt(c.rowKey.replace('r', ''), 10)
      const colIdx = parseInt(c.colKey.replace('c', ''), 10)
      const rCfg = rowConfigsRef.current[rowIdx]
      const cCfg = colConfigsRef.current[colIdx]
      const year = cCfg?.year

      const validation =
        rCfg?.metricId || year
          ? {
              ...(rCfg?.metricId ? { metric_id: rCfg.metricId } : {}),
              ...(year
                ? {
                    periodo_inicio: `${year}-01-01`,
                    periodo_fin: `${year}-12-31`,
                  }
                : {}),
            }
          : undefined

      return {
        rowKey: c.rowKey,
        colKey: c.colKey,
        valueNum: c.valueNum,
        valueText: c.valueText,
        ...(validation ? { validation } : {}),
      }
    })

    await vf2GuardarCeldas({ sheetPublicId: sheet.public_id, cells })
    setIsSaving(false)
  }, [sheet.public_id])

  const onCellEdited = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      if (!puedeEditar || colabStatus === 'readonly') return
      const rk = rowKey(row)
      const ck = colKey(col)
      const rawValue = newValue.kind === GridCellKind.Text ? newValue.data : ''
      const numValue = rawValue !== '' && !isNaN(Number(rawValue)) ? Number(rawValue) : null
      const textValue = numValue === null ? rawValue : null
      const key = `${rk}:${ck}`

      setMatrix(prev => {
        const next = new Map(prev)
        const existing = next.get(key)
        next.set(key, {
          ...(existing ?? {
            cell_id: 0,
            empresa_id: 0,
            sheet_id: sheet.sheet_id,
            row_key: rk,
            col_key: ck,
            cell_kind: 'input' as const,
            fact_ref_id: null,
            formula: null,
            validation: {},
            created_at: '',
            updated_at: '',
          }),
          row_key: rk,
          col_key: ck,
          value_num: numValue,
          value_text: textValue,
          value_json: null,
          estado_celda: 'borrador',
        } as Vf2Cell)
        return next
      })

      if (ycellsRef.current && colabStatus === 'connected') {
        ydocRef.current?.transact(() => {
          ycellsRef.current!.set(key, rawValue)
        })
      }

      dirtyRef.current.set(key, { rowKey: rk, colKey: ck, valueNum: numValue, valueText: textValue })
      setIsDirty(true)

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(flushAutosave, AUTOSAVE_DELAY_MS)
    },
    [puedeEditar, colabStatus, sheet.sheet_id, flushAutosave]
  )

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusLabel: Record<ColabStatus, string> = {
    connecting: 'Conectando…',
    connected: presenceCount > 1 ? `${presenceCount} usuarios editando` : 'Co-edición activa',
    degraded: 'Sin co-edición (guardado local)',
    readonly: 'Solo lectura',
  }
  const statusColor: Record<ColabStatus, string> = {
    connecting: 'text-gray-4',
    connected: 'text-success-7',
    degraded: 'text-warning-9',
    readonly: 'text-gray-4',
  }

  // ── Panel de coordenadas (A1) ─────────────────────────────────────────────
  const coordConfigured = rowConfigs.some(r => r.metricId) || colConfigs.some(c => c.year)

  return (
    <div className="flex flex-col h-full">
      {/* Barra de estado */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-3 bg-gray-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-5">{sheet.nombre}</span>
          <span className={`text-xs font-medium ${statusColor[colabStatus]}`}>
            {statusLabel[colabStatus]}
          </span>
          {coordConfigured && (
            <span className="text-xs text-primary-6 font-medium">Coordenadas configuradas</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {puedeEditar && (
            <button
              type="button"
              onClick={() => setShowConfig(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-5 hover:text-gray-8 rounded-lg px-2 py-1 hover:bg-gray-2 transition-colors"
            >
              <Settings2 className="h-3 w-3" />
              Coordenadas
              {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          <span className="text-xs text-gray-4">
            {isSaving ? 'Guardando…' : isDirty ? 'Cambios sin guardar' : 'Guardado'}
          </span>
        </div>
      </div>

      {/* Panel de configuración de coordenadas */}
      {showConfig && puedeEditar && (
        <div className="border-b border-gray-3 bg-gray-1/60 px-4 py-3 space-y-3">
          {/* Periodos por columna */}
          <div>
            <p className="text-xs font-medium text-gray-6 mb-1.5">
              Periodos por columna (año)
            </p>
            <div className="flex gap-2 flex-wrap">
              {colConfigs.map((cfg, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-xs text-gray-4 w-10">Col {i + 1}</span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={cfg.year ?? ''}
                    onChange={e => {
                      const year = e.target.value ? parseInt(e.target.value, 10) : null
                      setColConfigs(prev => {
                        const next = [...prev]
                        next[i] = { year }
                        return next
                      })
                    }}
                    placeholder="Año"
                    className="w-20 text-xs border border-gray-3 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-4"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Métricas por fila */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-6">
                Métricas por fila
              </p>
              {esAdmin && !showMetricaForm && (
                <button
                  type="button"
                  onClick={() => { setShowMetricaForm(true); setMError(null) }}
                  className="flex items-center gap-1 text-xs text-primary-6 hover:text-primary-7 rounded-lg px-2 py-0.5 hover:bg-primary-1 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Nueva métrica
                </button>
              )}
            </div>

            {/* Formulario inline de nueva métrica */}
            {esAdmin && showMetricaForm && (
              <div className="mb-3 bg-white border border-gray-3 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-7">Nueva métrica</p>
                  <button
                    type="button"
                    onClick={() => { setShowMetricaForm(false); setMError(null) }}
                    className="text-gray-3 hover:text-gray-5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Código (ej. GRI-305-1)"
                    value={mCodigo}
                    onChange={e => setMCodigo(e.target.value)}
                    className="text-xs border border-gray-3 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-4"
                  />
                  <input
                    type="text"
                    placeholder="Nombre (ej. Emisiones Alcance 1)"
                    value={mNombre}
                    onChange={e => setMNombre(e.target.value)}
                    className="text-xs border border-gray-3 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-4"
                  />
                  <select
                    value={mValueKind}
                    onChange={e => setMValueKind(e.target.value as 'num' | 'text' | 'json')}
                    className="text-xs border border-gray-3 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="num">Numérico</option>
                    <option value="text">Texto</option>
                    <option value="json">Tabla/JSON</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Unidad (ej. tCO2e)"
                    value={mUnidad}
                    onChange={e => setMUnidad(e.target.value)}
                    className="text-xs border border-gray-3 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-4"
                  />
                </div>
                {mError && <p className="text-xs text-critique-7">{mError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowMetricaForm(false); setMError(null) }}
                    disabled={isCreatingMetrica}
                    className="btn btn-ghost rounded-lg text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearMetrica}
                    disabled={isCreatingMetrica}
                    className="flex items-center gap-1 bg-primary-5 hover:bg-primary-6 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    Crear
                  </button>
                </div>
              </div>
            )}

            {catalogo.length === 0 ? (
              <p className="text-xs text-gray-4 italic">
                {esAdmin
                  ? 'No hay métricas creadas. Usa "Nueva métrica" para crear la primera.'
                  : 'No hay métricas creadas. Pide a un administrador que cree métricas.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {rowConfigs.map((cfg, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-xs text-gray-4 w-10 shrink-0">Fila {i + 1}</span>
                    <select
                      value={cfg.metricId ?? ''}
                      onChange={e => {
                        const metricId = e.target.value ? parseInt(e.target.value, 10) : null
                        setRowConfigs(prev => {
                          const next = [...prev]
                          next[i] = { metricId }
                          return next
                        })
                      }}
                      className="flex-1 text-xs border border-gray-3 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-4 bg-white truncate"
                    >
                      <option value="">— sin métrica —</option>
                      {catalogo.map(m => (
                        <option key={m.metric_id} value={m.metric_id}>
                          {m.codigo} — {m.nombre}
                          {m.unidad ? ` (${m.unidad})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1">
        <DataEditor
          columns={columns}
          getCellContent={getCellContent}
          onCellEdited={puedeEditar && colabStatus !== 'readonly' ? onCellEdited : undefined}
          rows={rows}
          width="100%"
          height="100%"
          rowMarkers="number"
          smoothScrollX
          smoothScrollY
          getCellsForSelection
          keybindings={{ search: false }}
        />
      </div>
    </div>
  )
}
