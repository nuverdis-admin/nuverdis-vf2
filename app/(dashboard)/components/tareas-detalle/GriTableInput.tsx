"use client";

import React, { useCallback, useMemo } from "react";
import {
  getGriTablaConfig,
  getFlatColumns,
  type GriTableConfig,
  type GriTableColumn,
} from "@/lib/reportes/gri-tablas-config";
import { getNcgTablaConfig } from "@/lib/reportes/ncg-tablas-config";

function getTablaConfig(id: string): GriTableConfig | null {
  return getGriTablaConfig(id) ?? getNcgTablaConfig(id);
}
import type { GriTableData, GriTableRow } from "@/lib/tareas/types";

interface Props {
  tableId: string;
  value: GriTableData;
  onChange: (v: GriTableData) => void;
  disabled: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function sumColValues(rows: GriTableRow[], colKey: string): string {
  return fmtNum(rows.reduce((acc, r) => acc + parseNum(r.cells[colKey] ?? ""), 0));
}

function sumRowValues(row: GriTableRow, dataKeys: string[]): string {
  return fmtNum(dataKeys.reduce((acc, k) => acc + parseNum(row.cells[k] ?? ""), 0));
}

/** Todas las columnas de datos (excl. label y sum_row/sum_col) */
function dataKeys(cols: GriTableColumn[]): string[] {
  return cols.filter((c) => c.type === "number" || c.type === "percentage").map((c) => c.key);
}

/** Genera las columnas flat para Pattern G (incluyendo dinámicas) */
function buildPatternGCols(
  config: GriTableConfig,
  dynamicColumns: string[]
): GriTableColumn[] {
  const base = config.columns ?? [];
  const labelC = base.find((c) => c.key === "label");
  const sumC = base.find((c) => c.type === "sum_row");
  const staticData = base.filter((c) => c.type === "number" || c.type === "percentage");

  const dynCols: GriTableColumn[] = dynamicColumns.map((lbl, i) => ({
    key: `dyn_${i}`,
    label: lbl,
    type: "number" as const,
  }));

  return [
    ...(labelC ? [labelC] : []),
    ...staticData,
    ...dynCols,
    ...(sumC ? [sumC] : []),
  ];
}

function initRows(config: GriTableConfig, dynCols: GriTableColumn[]): GriTableRow[] {
  const dkKeys = dynCols.filter((c) => c.type === "number" || c.type === "percentage").map((c) => c.key);
  return config.defaultRows.map((dr) => ({
    label: dr.label,
    cells: Object.fromEntries([
      ...dkKeys.map((k) => [k, dr.prefilled?.[k] ?? ""]),
    ]),
  }));
}

// ── Cell renderer ────────────────────────────────────────────────────────────

interface CellProps {
  col: GriTableColumn;
  row: GriTableRow;
  rowFixed: boolean;
  disabled: boolean;
  allDataRows: GriTableRow[];
  dataColKeys: string[];
  dynamicCols: GriTableColumn[];
  onChange: (key: string, val: string) => void;
}

function Cell({ col, row, rowFixed, disabled, allDataRows, dataColKeys, dynamicCols, onChange }: CellProps) {
  const val = row.cells[col.key] ?? "";

  if (col.key === "label") {
    return rowFixed ? (
      <td className="border border-gray-2 bg-gray-1 px-2 py-1.5 text-xs font-medium text-gray-7 whitespace-nowrap">
        {row.label}
      </td>
    ) : (
      <td className="border border-gray-2 px-1.5 py-1">
        <input
          type="text"
          value={row.label}
          disabled={disabled}
          aria-label="Etiqueta de fila"
          placeholder="Etiqueta"
          className="w-full min-w-[80px] bg-transparent text-xs text-gray-8 outline-none placeholder-gray-3 disabled:cursor-not-allowed"
          onChange={(e) => onChange("label", e.target.value)}
        />
      </td>
    );
  }

  if (col.type === "text_fixed") {
    return (
      <td className="border border-gray-2 bg-gray-1 px-2 py-1.5 text-xs text-gray-6 italic">
        {val || (row.cells[col.key] ?? "")}
      </td>
    );
  }

  if (col.type === "sum_row") {
    const allKeys = col.sumKeys ?? [...dataColKeys, ...dynamicCols.map((c) => c.key)];
    const total = sumRowValues(row, allKeys);
    return (
      <td className="border border-gray-2 bg-gray-1 px-1.5 py-1">
        <div className="flex items-center gap-0.5">
          <span className="w-full min-w-[48px] text-right text-xs font-semibold text-gray-7">
            {total}
          </span>
        </div>
      </td>
    );
  }

  if (col.type === "sum_col") {
    const total = sumColValues(allDataRows, col.key);
    return (
      <td className="border border-gray-2 bg-gray-1 px-1.5 py-1">
        <div className="flex items-center gap-0.5">
          <span className="w-full min-w-[48px] text-right text-xs font-semibold text-gray-7">
            {total}
          </span>
        </div>
      </td>
    );
  }

  const isNum = col.type === "number" || col.type === "percentage";
  return (
    <td className="border border-gray-2 px-1.5 py-1">
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          step={col.type === "percentage" ? "0.01" : "any"}
          max={col.type === "percentage" ? 100 : undefined}
          value={val}
          disabled={disabled}
          placeholder="0"
          className={`w-full min-w-[48px] bg-transparent text-right text-xs text-gray-8 outline-none placeholder-gray-3 disabled:cursor-not-allowed ${!isNum ? "text-left" : ""}`}
          onChange={(e) => onChange(col.key, e.target.value)}
        />
        {col.type === "percentage" && !disabled && (
          <span className="shrink-0 text-[10px] text-gray-4">%</span>
        )}
      </div>
    </td>
  );
}

// ── Total row ────────────────────────────────────────────────────────────────

function TotalRow({
  cols,
  rows,
  label,
  dynamicCols,
  dataColKeys,
  hasTotalCol,
}: {
  cols: GriTableColumn[];
  rows: GriTableRow[];
  label: string;
  dynamicCols: GriTableColumn[];
  dataColKeys: string[];
  hasTotalCol: boolean;
}) {
  const allDataKeys = [...dataColKeys, ...dynamicCols.map((c) => c.key)];

  return (
    <tr className="bg-gray-2">
      {cols.map((col, ci) => {
        if (col.key === "label") {
          return (
            <td key={ci} className="border border-gray-2 px-1.5 py-1 text-xs font-bold text-gray-8 whitespace-nowrap">
              {label}
            </td>
          );
        }
        if (col.type === "text_fixed") {
          return <td key={ci} className="border border-gray-2 bg-gray-2" />;
        }
        if (col.type === "sum_row") {
          const grandTotal = rows.reduce(
            (acc, r) => acc + parseNum(sumRowValues(r, allDataKeys)),
            0
          );
          return (
            <td key={ci} className="border border-gray-2 px-1.5 py-1">
              <div className="flex items-center gap-0.5">
                <span className="w-full min-w-[48px] text-right text-xs font-bold text-gray-8">
                  {fmtNum(grandTotal)}
                </span>
              </div>
            </td>
          );
        }
        if (col.type === "sum_col") {
          if (hasTotalCol) {
            const grandTotal = rows.reduce(
              (acc, r) => acc + parseNum(sumRowValues(r, allDataKeys)),
              0
            );
            return (
              <td key={ci} className="border border-gray-2 px-1.5 py-1">
                <div className="flex items-center gap-0.5">
                  <span className="w-full min-w-[48px] text-right text-xs font-bold text-gray-8">
                    {fmtNum(grandTotal)}
                  </span>
                </div>
              </td>
            );
          }
          return <td key={ci} className="border border-gray-2 bg-gray-2" />;
        }
        return (
          <td key={ci} className="border border-gray-2 px-1.5 py-1">
            <div className="flex items-center gap-0.5">
              <span className="w-full min-w-[48px] text-right text-xs font-bold text-gray-8">
                {sumColValues(rows, col.key)}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GriTableInput({ tableId, value, onChange, disabled }: Props) {
  const config = useMemo(() => getTablaConfig(tableId), [tableId]);
  const extraConfig = useMemo(
    () => (config?.extraTableId ? getTablaConfig(config.extraTableId) : null),
    [config]
  );

  const dynamicColumns: string[] = value.dynamicColumns ?? [];

  // Columnas flat (con dinámicas en Pattern G)
  const cols = useMemo<GriTableColumn[]>(() => {
    if (!config) return [];
    if (config.addCols) {
      return buildPatternGCols(config, dynamicColumns);
    }
    return getFlatColumns(config);
  }, [config, dynamicColumns]);

  // Columnas de datos (number/percentage, no sum)
  const dKeys = useMemo(() => dataKeys(cols), [cols]);

  // Columnas dinámicas como GriTableColumn[]
  const dynColObjs = useMemo<GriTableColumn[]>(
    () => dynamicColumns.map((lbl, i) => ({ key: `dyn_${i}`, label: lbl, type: "number" as const })),
    [dynamicColumns]
  );

  // Inicializar filas desde config si value.rows vacío
  const rows: GriTableRow[] = useMemo(() => {
    if (!config) return [];
    if (value.rows.length > 0) return value.rows;
    const allCols = config.addCols ? buildPatternGCols(config, dynamicColumns) : getFlatColumns(config);
    return initRows(config, allCols);
  }, [config, value.rows, dynamicColumns]);

  // ── Mutadores ────────────────────────────────────────────────────────────

  const setRows = useCallback(
    (next: GriTableRow[]) => onChange({ ...value, rows: next }),
    [value, onChange]
  );

  const setCellValue = useCallback(
    (rowIdx: number, key: string, val: string) => {
      const next = rows.map((r, i) => {
        if (i !== rowIdx) return r;
        if (key === "label") return { ...r, label: val };
        return { ...r, cells: { ...r.cells, [key]: val } };
      });
      setRows(next);
    },
    [rows, setRows]
  );

  const addRow = useCallback(() => {
    if (!config) return;
    const allKeys = cols.filter((c) => c.type === "number" || c.type === "percentage").map((c) => c.key);
    const newRow: GriTableRow = {
      label: config.rowLabelPlaceholder ?? "Nuevo",
      cells: Object.fromEntries(allKeys.map((k) => [k, ""])),
    };
    setRows([...rows, newRow]);
  }, [config, cols, rows, setRows]);

  const removeRow = useCallback(
    (idx: number) => setRows(rows.filter((_, i) => i !== idx)),
    [rows, setRows]
  );

  const addDynCol = useCallback(() => {
    if (!config) return;
    const label = config.colLabelPlaceholder ?? "Columna";
    const newDynCols = [...dynamicColumns, `${label} ${dynamicColumns.length + 1}`];
    const newKey = `dyn_${dynamicColumns.length}`;
    const newRows = rows.map((r) => ({ ...r, cells: { ...r.cells, [newKey]: "" } }));
    onChange({ rows: newRows, dynamicColumns: newDynCols });
  }, [config, dynamicColumns, rows, onChange]);

  const removeDynCol = useCallback(
    (dynIdx: number) => {
      const keyToRemove = `dyn_${dynIdx}`;
      const newDynCols = dynamicColumns.filter((_, i) => i !== dynIdx);
      // Re-key: dyn_0, dyn_1, ... (shift after removed)
      const newRows = rows.map((r) => {
        const cells: Record<string, string> = {};
        for (const [k, v] of Object.entries(r.cells)) {
          if (k === keyToRemove) continue;
          if (k.startsWith("dyn_")) {
            const idx = parseInt(k.replace("dyn_", ""), 10);
            if (idx > dynIdx) {
              cells[`dyn_${idx - 1}`] = v;
              continue;
            }
          }
          cells[k] = v;
        }
        return { ...r, cells };
      });
      onChange({ rows: newRows, dynamicColumns: newDynCols });
    },
    [dynamicColumns, rows, onChange]
  );

  const renameDynCol = useCallback(
    (dynIdx: number, label: string) => {
      const newDynCols = dynamicColumns.map((l, i) => (i === dynIdx ? label : l));
      onChange({ ...value, dynamicColumns: newDynCols });
    },
    [dynamicColumns, value, onChange]
  );

  // ── Sin config ───────────────────────────────────────────────────────────

  if (!config) {
    return (
      <div className="rounded-lg border border-dashed border-gray-2 bg-gray-1 px-4 py-3 text-xs text-gray-5">
        Tabla no configurada: <span className="font-mono">{tableId}</span>
      </div>
    );
  }

  // ── Helpers de render ────────────────────────────────────────────────────

  const isPatternG = config.addCols;
  const hasSectionHeaders = (config.sectionHeaders ?? []).length > 0;
  const totalRowLabel = config.totalRowLabel ?? "Total";
  const colCount = cols.length + (config.addCols && !disabled ? 1 : 0) + (!disabled && config.addRows ? 1 : 0);

  // sectionHeaders: mapa rowIndex → label
  const sectionHeaderMap = new Map<number, string>(
    (config.sectionHeaders ?? []).map((sh) => [sh.beforeRowIndex, sh.label])
  );

  // Separar columnas fijas de dinámicas para Pattern G
  const staticDataCols = cols.filter((c) => c.type === "number" || c.type === "percentage" && !c.key.startsWith("dyn_"));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {config.unit && (
        <span className="self-start rounded-full border border-info-3 bg-info-1 px-2 py-0.5 text-[11px] font-medium text-info-7">
          {config.unit}
        </span>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-2">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-1">
            {/* Fila 1: grupos (Pattern C) */}
            {config.headerGroups && (
              <tr>
                {/* label col */}
                <th aria-label="Etiqueta" className="border border-gray-2 px-2 py-1.5 text-left" rowSpan={2} />
                {config.headerGroups.map((grp, gi) => (
                  <th
                    key={gi}
                    colSpan={grp.columns.length}
                    className="border border-gray-2 bg-primary-1 px-2 py-1.5 text-center text-[11px] font-bold text-primary-7"
                  >
                    {grp.label}
                  </th>
                ))}
                {!disabled && config.addRows && <th aria-label="Acciones" className="border border-gray-2" rowSpan={2} />}
              </tr>
            )}

            {/* Fila de sub-columnas (siempre) */}
            <tr>
              {cols.map((col, ci) => {
                // Pattern G: columnas dinámicas en el header tienen input para renombrar
                if (isPatternG && col.key.startsWith("dyn_")) {
                  const dynIdx = parseInt(col.key.replace("dyn_", ""), 10);
                  return (
                    <th key={ci} className="border border-gray-2 px-1.5 py-1 text-center text-[11px]">
                      <div className="flex items-center gap-1 justify-center">
                        {disabled ? (
                          <span className="font-semibold text-gray-7">{col.label}</span>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={col.label}
                              aria-label="Nombre de columna"
                              placeholder="Columna"
                              onChange={(e) => renameDynCol(dynIdx, e.target.value)}
                              className="w-20 bg-transparent text-center text-[11px] font-semibold text-gray-7 outline-none"
                            />
                            <button
                              type="button"
                              aria-label="Eliminar columna"
                              onClick={() => removeDynCol(dynIdx)}
                              className="shrink-0 text-gray-3 hover:text-critique-6"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </th>
                  );
                }
                // Pattern C: skip label col (already in rowSpan)
                if (config.headerGroups && col.key === "label") return null;
                return (
                  <th
                    key={ci}
                    className="border border-gray-2 px-2 py-1.5 text-center text-[11px] font-semibold text-gray-6 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                );
              })}
              {/* Botón +col (Pattern G) */}
              {isPatternG && !disabled && (
                <th className="border border-gray-2 px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={addDynCol}
                    title={`Añadir ${config.colLabelPlaceholder ?? "columna"}`}
                    className="text-gray-4 hover:text-primary-6"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </th>
              )}
              {/* Placeholder columna × (Pattern G disabled) */}
              {isPatternG && disabled && <th className="border border-gray-2" />}
              {/* Columna × filas (addRows) */}
              {!config.headerGroups && !disabled && config.addRows && (
                <th className="border border-gray-2 w-6" />
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => {
              const isFixed = config.defaultRows[ri]?.fixed ?? false;
              const isDynRow = ri >= config.defaultRows.length;
              const canDelete = config.addRows && (isDynRow || !isFixed);
              const sectionHeader = sectionHeaderMap.get(ri);

              return (
                <React.Fragment key={`row-${ri}`}>
                  {sectionHeader && (
                    <tr key={`sh-${ri}`}>
                      <td
                        colSpan={cols.length + (isPatternG ? 1 : 0) + (!disabled && config.addRows ? 1 : 0)}
                        className="border border-gray-2 bg-primary-1 px-3 py-1.5 text-xs font-bold text-primary-8"
                      >
                        {sectionHeader}
                      </td>
                    </tr>
                  )}
                  <tr className="even:bg-gray-1 hover:bg-primary-1/30 transition-colors">
                    {cols.map((col, ci) => (
                      <Cell
                        key={`${ri}-${ci}`}
                        col={col}
                        row={row}
                        rowFixed={isFixed}
                        disabled={disabled}
                        allDataRows={rows}
                        dataColKeys={dKeys}
                        dynamicCols={dynColObjs}
                        onChange={(k, v) => setCellValue(ri, k, v)}
                      />
                    ))}
                    {/* Botón + columna vacía (Pattern G) */}
                    {isPatternG && <td className="border border-gray-2" />}
                    {/* Botón × borrar fila */}
                    {!disabled && config.addRows && (
                      <td className="border border-gray-2 px-1 text-center">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => removeRow(ri)}
                            title="Eliminar fila"
                            className="text-gray-3 hover:text-critique-6"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                </React.Fragment>
              );
            })}

            {/* Total row */}
            {config.totalRow && rows.length > 0 && (
              <TotalRow
                cols={cols}
                rows={rows}
                label={totalRowLabel}
                dynamicCols={dynColObjs}
                dataColKeys={dKeys}
                hasTotalCol={config.totalCol}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Botón + fila */}
      {!disabled && config.addRows && (
        <button
          type="button"
          onClick={addRow}
          className="self-start rounded-md border border-dashed border-gray-3 px-3 py-1.5 text-xs text-gray-5 transition-colors hover:border-primary-4 hover:text-primary-6"
        >
          + {config.rowLabelPlaceholder ?? "Fila"}
        </button>
      )}

      {/* Tabla secundaria: misma respuesta, data bajo value.extra */}
      {config.extraTableId && (
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-2 pt-4">
          {extraConfig?.title && (
            <p className="text-sm font-semibold text-gray-8">{extraConfig.title}</p>
          )}
          <GriTableInput
            tableId={config.extraTableId}
            value={value.extra ?? { rows: [] }}
            onChange={(next) => onChange({ ...value, extra: next })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

// ── Serialización ─────────────────────────────────────────────────────────────

export function parseGriTableData(
  raw: string,
  tableId: string
): GriTableData {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "rows" in parsed &&
      Array.isArray((parsed as GriTableData).rows)
    ) {
      return parsed as GriTableData;
    }
  } catch {
    // fall through
  }
  // Fallback: inicializar desde config
  const config = getTablaConfig(tableId);
  if (!config) return { rows: [] };
  const allCols = getFlatColumns(config);
  return { rows: initRows(config, allCols) };
}
