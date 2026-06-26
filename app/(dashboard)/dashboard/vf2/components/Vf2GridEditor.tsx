'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2GridEditor.tsx
// Editor de celdas vf2_ con glide-data-grid + co-edición Yjs/Hocuspocus.
// Invariante: el valor canónico NUNCA se determina aquí; solo al aprobar via RPC.
// Co-edición: Hocuspocus en wss://collab.nuverdis.com via token efímero (60s TTL).
// Degradación: si el WS no conecta, autosave directo a vf2_cell vía server action.

import { useState, useCallback, useRef, useEffect } from 'react'
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
import { vf2GuardarCeldas } from '@/app/actions/vf2-tareas'
import { vf2EmitirTokenColab } from '@/app/actions/vf2-colab'
import type { Vf2Sheet, Vf2Cell } from '@/lib/vf2/types'
import { rowKey, colKey } from '@/lib/vf2/fact-coord'

interface Props {
  sheet: Vf2Sheet
  celdas: Vf2Cell[]
  puedeEditar: boolean
  tareaPublicId: string
}

type ColabStatus = 'connecting' | 'connected' | 'degraded' | 'readonly'

const AUTOSAVE_DELAY_MS = 1200
const DEFAULT_ROWS = 10
const DEFAULT_COLS = 5
const COLAB_URL = process.env.NEXT_PUBLIC_VF2_COLLAB_URL ?? 'wss://collab.nuverdis.com'

// Convierte celdas BD a Map keyed por "rN:cN"
function buildMatrix(celdas: Vf2Cell[]): Map<string, Vf2Cell> {
  const map = new Map<string, Vf2Cell>()
  for (const c of celdas) map.set(`${c.row_key}:${c.col_key}`, c)
  return map
}

// Valor de celda para mostrar (num tiene precedencia sobre text)
function cellDisplayValue(cell: Vf2Cell | undefined): string {
  if (!cell) return ''
  if (cell.value_num !== null && cell.value_num !== undefined) return String(cell.value_num)
  return cell.value_text ?? ''
}

export default function Vf2GridEditor({ sheet, celdas, puedeEditar }: Props) {
  const [rows] = useState(DEFAULT_ROWS)
  const [cols] = useState(DEFAULT_COLS)

  // Estado local del grid (fuente de verdad para el render)
  const [matrix, setMatrix] = useState<Map<string, Vf2Cell>>(() => buildMatrix(celdas))

  // Estado de co-edición
  const [colabStatus, setColabStatus] = useState<ColabStatus>(puedeEditar ? 'connecting' : 'readonly')
  const [presenceCount, setPresenceCount] = useState(0)

  // Autosave local (fallback si WS no disponible o para flush final)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const dirtyRef = useRef<Map<string, { rowKey: string; colKey: string; valueNum: number | null; valueText: string | null }>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs Yjs
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
      // 1. Emitir token efímero desde el servidor
      const tokenResult = await vf2EmitirTokenColab({ sheetPublicId: sheet.public_id })
      if (!tokenResult.ok || destroyed) {
        setColabStatus('degraded')
        return
      }

      const { token, docName } = tokenResult

      // 2. Crear el Y.Doc y conectar Hocuspocus
      const ydoc = new Y.Doc()
      ydocRef.current = ydoc

      const ycells = ydoc.getMap<string>('cells')
      ycellsRef.current = ycells

      // Precarga estado local en el Y.Map (seed inicial)
      ydoc.transact(() => {
        matrix.forEach((cell, key) => {
          const v = cellDisplayValue(cell)
          if (v !== '') ycells.set(key, v)
        })
      })

      // 3. Observar cambios remotos y actualizar el grid
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
        onConnect() {
          if (!destroyed) setColabStatus('connected')
        },
        onDisconnect() {
          if (!destroyed) setColabStatus('degraded')
        },
        onAwarenessUpdate({ states }) {
          if (!destroyed) setPresenceCount(states.length)
        },
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
    title: `Col ${i + 1}`,
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

  // ── Edición ───────────────────────────────────────────────────────────────
  const flushAutosave = useCallback(async () => {
    const cells = Array.from(dirtyRef.current.values())
    if (cells.length === 0) return
    dirtyRef.current.clear()
    setIsDirty(false)
    setIsSaving(true)
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

      // Actualizar estado local
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

      // Propagar a Yjs (co-edición en vivo)
      if (ycellsRef.current && colabStatus === 'connected') {
        ydocRef.current?.transact(() => {
          ycellsRef.current!.set(key, rawValue)
        })
      }

      // Acumular para autosave (fallback o flush final)
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

  return (
    <div className="flex flex-col h-full">
      {/* Barra de estado */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-3 bg-gray-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-5">{sheet.nombre}</span>
          <span className={`text-xs font-medium ${statusColor[colabStatus]}`}>
            {statusLabel[colabStatus]}
          </span>
        </div>
        <span className="text-xs text-gray-4">
          {isSaving ? 'Guardando…' : isDirty ? 'Cambios sin guardar' : 'Guardado'}
        </span>
      </div>

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
