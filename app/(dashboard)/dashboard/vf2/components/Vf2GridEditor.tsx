'use client'
// app/(dashboard)/vf2/components/Vf2GridEditor.tsx
// Editor de celdas vf2_ con glide-data-grid + autosave debounced.
// Las celdas input se muestran en azul (primary-2 / primary-5).
// El valor canónico NUNCA se determina aquí; solo al aprobar via RPC.

import { useState, useCallback, useRef, useEffect } from 'react'
import DataEditor, {
  type GridCell,
  type GridColumn,
  type Item,
  GridCellKind,
  type EditableGridCell,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { vf2GuardarCeldas } from '@/app/actions/vf2-tareas'
import type { Vf2Sheet, Vf2Cell } from '@/lib/vf2/types'
import { rowKey, colKey } from '@/lib/vf2/fact-coord'

interface Props {
  sheet: Vf2Sheet
  celdas: Vf2Cell[]
  puedeEditar: boolean
  tareaPublicId: string
}

// Convierte las celdas de la BD a una matriz [row][col] para el grid
function buildMatrix(
  celdas: Vf2Cell[],
  rows: number,
  cols: number
): Map<string, Vf2Cell> {
  const map = new Map<string, Vf2Cell>()
  for (const c of celdas) {
    map.set(`${c.row_key}:${c.col_key}`, c)
  }
  return map
}

const AUTOSAVE_DELAY_MS = 1200
const DEFAULT_ROWS = 10
const DEFAULT_COLS = 5

export default function Vf2GridEditor({ sheet, celdas, puedeEditar }: Props) {
  const [rows] = useState(DEFAULT_ROWS)
  const [cols] = useState(DEFAULT_COLS)
  const [matrix, setMatrix] = useState(() => buildMatrix(celdas, rows, cols))
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dirtyRef = useRef<Map<string, { rowKey: string; colKey: string; valueNum: number | null; valueText: string | null }>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const columns: GridColumn[] = Array.from({ length: cols }, (_, i) => ({
    title: `Col ${i + 1}`,
    id: colKey(i),
    width: 160,
  }))

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const rk = rowKey(row)
      const ck = colKey(col)
      const cell = matrix.get(`${rk}:${ck}`)
      const isInput = !cell || cell.cell_kind === 'input'
      const value = cell?.value_num !== null && cell?.value_num !== undefined
        ? String(cell.value_num)
        : (cell?.value_text ?? '')

      if (!puedeEditar || !isInput) {
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
        // Celdas input = azul (tema Workiva)
        themeOverride: {
          bgCell: '#EFF6FF',         // azul muy claro
          bgCellMedium: '#DBEAFE',
          accentColor: '#3B82F6',
          textDark: '#1E3A5F',
        },
      }
    },
    [matrix, puedeEditar]
  )

  const onCellEdited = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      if (!puedeEditar) return
      const rk = rowKey(row)
      const ck = colKey(col)
      const rawValue = newValue.kind === GridCellKind.Text ? newValue.data : ''
      const numValue = rawValue !== '' && !isNaN(Number(rawValue)) ? Number(rawValue) : null
      const textValue = numValue === null ? rawValue : null

      // Actualizar estado local
      setMatrix(prev => {
        const next = new Map(prev)
        const existing = next.get(`${rk}:${ck}`)
        next.set(`${rk}:${ck}`, {
          ...(existing ?? {
            cell_id: 0,
            empresa_id: 0,
            sheet_id: sheet.sheet_id,
            row_key: rk,
            col_key: ck,
            cell_kind: 'input',
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

      // Acumular para autosave
      dirtyRef.current.set(`${rk}:${ck}`, { rowKey: rk, colKey: ck, valueNum: numValue, valueText: textValue })
      setIsDirty(true)

      // Debounce autosave
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        const cells = Array.from(dirtyRef.current.values())
        dirtyRef.current.clear()
        setIsDirty(false)
        setIsSaving(true)
        await vf2GuardarCeldas({ sheetPublicId: sheet.public_id, cells })
        setIsSaving(false)
      }, AUTOSAVE_DELAY_MS)
    },
    [puedeEditar, sheet]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Estado de guardado */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-3 bg-gray-1">
        <span className="text-xs text-gray-4">{sheet.nombre}</span>
        <span className="text-xs text-gray-4">
          {isSaving ? 'Guardando…' : isDirty ? 'Cambios sin guardar' : 'Guardado'}
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1">
        <DataEditor
          columns={columns}
          getCellContent={getCellContent}
          onCellEdited={puedeEditar ? onCellEdited : undefined}
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
