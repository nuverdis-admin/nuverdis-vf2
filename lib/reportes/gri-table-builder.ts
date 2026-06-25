import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from "docx";
import type { GriTableConfig, GriTableColumn } from "./gri-tablas-config";
import { getFlatColumns } from "./gri-tablas-config";
import type { GriTableData } from "@/lib/tareas/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BORDER_GRAY = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDERS = { top: BORDER_GRAY, bottom: BORDER_GRAY, left: BORDER_GRAY, right: BORDER_GRAY };
const SHADING_HEADER = { fill: "E8E8E8", type: ShadingType.CLEAR, color: "auto" };
const SHADING_TOTAL = { fill: "F0F0F0", type: ShadingType.CLEAR, color: "auto" };
const SHADING_SECTION = { fill: "D9EAD3", type: ShadingType.CLEAR, color: "auto" };

function cell(text: string, opts?: { bold?: boolean; shading?: typeof SHADING_HEADER; colSpan?: number; italics?: boolean }): TableCell {
  return new TableCell({
    borders: BORDERS,
    shading: opts?.shading,
    columnSpan: opts?.colSpan,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: opts?.bold ?? false, italics: opts?.italics ?? false, size: 18 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

function numericSum(values: string[]): string {
  const sum = values.reduce((acc, v) => {
    const n = parseFloat(v.replace(/,/g, "").trim());
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
  return sum === 0 ? "" : String(sum);
}

// ─── Header builders ──────────────────────────────────────────────────────────

function buildSimpleHeaderRow(cols: GriTableColumn[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c) => cell(c.label, { bold: true, shading: SHADING_HEADER })),
  });
}

function buildGroupedHeaderRows(config: GriTableConfig): TableRow[] {
  const groups = config.headerGroups!;
  // Row 1: label cell (rowspan via empty) + group labels with colspan
  const row1Cells: TableCell[] = [cell("", { bold: true, shading: SHADING_HEADER })];
  for (const g of groups) {
    row1Cells.push(cell(g.label, { bold: true, shading: SHADING_HEADER, colSpan: g.columns.length }));
  }
  const row1 = new TableRow({ tableHeader: true, children: row1Cells });

  // Row 2: label placeholder + each column sub-header
  const row2Cells: TableCell[] = [cell("", { bold: true, shading: SHADING_HEADER })];
  for (const g of groups) {
    for (const c of g.columns) {
      row2Cells.push(cell(c.label, { bold: true, shading: SHADING_HEADER }));
    }
  }
  const row2 = new TableRow({ tableHeader: true, children: row2Cells });
  return [row1, row2];
}

// ─── Data row builder ─────────────────────────────────────────────────────────

function buildDataRow(
  rowLabel: string,
  flatCols: GriTableColumn[],
  rowData: Record<string, string>,
  opts?: { bold?: boolean; shading?: typeof SHADING_TOTAL }
): TableRow {
  const cells = flatCols.map((col) => {
    if (col.type === "label") {
      return cell(rowLabel, { bold: opts?.bold, shading: opts?.shading });
    }
    const val = rowData[col.key] ?? "";
    return cell(val, { bold: opts?.bold, shading: opts?.shading });
  });
  return new TableRow({ children: cells });
}

// ─── Section header row (full-width merge) ───────────────────────────────────

function buildSectionHeaderRow(label: string, colCount: number): TableRow {
  return new TableRow({
    children: [
      cell(label, { bold: true, shading: SHADING_SECTION, colSpan: colCount }),
    ],
  });
}

// ─── Total row calculator ─────────────────────────────────────────────────────

function buildTotalRow(
  flatCols: GriTableColumn[],
  allRowsData: Array<Record<string, string>>,
  label: string
): TableRow {
  const cells = flatCols.map((col) => {
    if (col.type === "label") return cell(label, { bold: true, shading: SHADING_TOTAL });
    if (col.type === "sum_row" || col.type === "number" || col.type === "percentage") {
      const vals = allRowsData.map((r) => r[col.key] ?? "");
      return cell(numericSum(vals), { bold: true, shading: SHADING_TOTAL });
    }
    if (col.type === "text_fixed") return cell("", { shading: SHADING_TOTAL });
    return cell("", { bold: true, shading: SHADING_TOTAL });
  });
  return new TableRow({ children: cells });
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildGriTable(config: GriTableConfig, data: GriTableData): Table {
  const flatCols = getFlatColumns(config);

  // For Pattern G (addCols=true): inject dynamic columns before sum_row col
  let activeCols = [...flatCols];
  if (config.addCols && data.dynamicColumns && data.dynamicColumns.length > 0) {
    const sumIdx = activeCols.findIndex((c) => c.type === "sum_row");
    const dynCols: GriTableColumn[] = data.dynamicColumns.map((dc) => ({
      key: dc,
      label: dc,
      type: "number" as const,
    }));
    if (sumIdx >= 0) {
      activeCols = [...activeCols.slice(0, sumIdx), ...dynCols, ...activeCols.slice(sumIdx)];
    } else {
      activeCols = [...activeCols, ...dynCols];
    }
  }

  const colCount = activeCols.length;

  // Resolve rows: merge defaultRows + data.rows (use data.rows labels when present)
  const resolvedRows: Array<{ label: string; cells: Record<string, string> }> = data.rows.map((r) => ({
    label: r.label,
    cells: r.cells,
  }));

  const rows: TableRow[] = [];

  // Headers
  if (config.headerGroups) {
    rows.push(...buildGroupedHeaderRows(config));
  } else {
    rows.push(buildSimpleHeaderRow(activeCols));
  }

  // Section headers + data rows (Pattern F uses sectionHeaders)
  const sectionHeaderMap = new Map<number, string>();
  if (config.sectionHeaders) {
    for (const sh of config.sectionHeaders) {
      sectionHeaderMap.set(sh.beforeRowIndex, sh.label);
    }
  }

  const dataRowsForTotal: Array<Record<string, string>> = [];

  for (let i = 0; i < resolvedRows.length; i++) {
    const sectionLabel = sectionHeaderMap.get(i);
    if (sectionLabel !== undefined) {
      rows.push(buildSectionHeaderRow(sectionLabel, colCount));
    }

    const row = resolvedRows[i];
    const rowData: Record<string, string> = { ...row.cells };

    // Compute sum_row cells on the fly
    for (const col of activeCols) {
      if (col.type === "sum_row") {
        const numericCols = activeCols.filter((c) => c.type === "number" || c.type === "percentage");
        rowData[col.key] = numericSum(numericCols.map((c) => rowData[c.key] ?? ""));
      }
    }

    // sum_col (Pattern G): last column totals all numeric cols in the row
    if (config.totalCol) {
      const sumColKey = activeCols.find((c) => c.type === "sum_col")?.key;
      if (sumColKey) {
        const numericCols = activeCols.filter((c) => c.type === "number");
        rowData[sumColKey] = numericSum(numericCols.map((c) => rowData[c.key] ?? ""));
      }
    }

    dataRowsForTotal.push(rowData);
    rows.push(buildDataRow(row.label, activeCols, rowData));
  }

  // Total row
  if (config.totalRow) {
    rows.push(buildTotalRow(activeCols, dataRowsForTotal, config.totalRowLabel ?? "Total"));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}
