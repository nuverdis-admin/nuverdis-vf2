/**
 * GRI Tables Configuration — 28 table templates
 * Generated from GRI_PRS_2_0.xlsx
 *
 * 7 PATTERNS:
 * A: Simple headers + dynamic rows + total row
 * B: Multi-col fixed headers + dynamic rows + total row
 * C: 2-level grouped headers + dynamic rows
 * D: Fixed rows (no +ADD) + fixed cols + total row
 * E: Fixed rows + special formatting (GEI/Alcance)
 * F: Section headers + fixed description + editable col
 * G: Dynamic rows AND dynamic cols + total row + total col
 */

// ─── Types ───────────────────────────────────────────

export interface GriTableColumn {
  key: string;
  label: string;
  type: 'label' | 'number' | 'percentage' | 'text' | 'text_fixed' | 'sum_row' | 'sum_col';
  fixed?: boolean;       // true = no editable (label, descripción fija, etc.)
  note?: string;         // ej: "—" en celdas de total que no aplican
  sumKeys?: string[];    // sum_row parcial: suma solo estas keys en vez de todas las numéricas
}

export interface GriTableHeaderGroup {
  label: string;
  columns: GriTableColumn[];
}

export interface GriTableSectionHeader {
  label: string;
  beforeRowIndex: number;  // se inserta antes de esta fila (0-based sobre defaultRows)
}

export interface GriTableConfig {
  id: string;             // 'T1', 'T2', etc.
  gri: string;            // '2-7', '405-1', etc.
  letra: string;          // 'a', 'b', etc.
  title?: string;         // Título descriptivo opcional

  // Headers: usar headerGroups para 2 niveles, columns para 1 nivel
  headerGroups?: GriTableHeaderGroup[];
  columns?: GriTableColumn[];

  // Rows
  defaultRows: GriTableDefaultRow[];
  addRows: boolean;
  rowLabelPlaceholder?: string;  // 'País', 'Categoría', 'Zona', etc.

  // Columns dinámicas
  addCols: boolean;
  colLabelPlaceholder?: string;

  // Totals
  totalRow: boolean;
  totalRowLabel?: string;       // default: 'Total'
  totalCol: boolean;

  // Special
  sectionHeaders?: GriTableSectionHeader[];
  unit?: string;                // 'en ML', 'tCO2e', etc.

  // Tabla secundaria: se renderiza debajo de la principal, dentro de la MISMA
  // respuesta (mismo JSON de contenido, bajo la clave `extra`). Usado cuando un
  // requerimiento exige dos tablas con encabezados distintos (ej. NCG letra xiii
  // sección a–e + sección f Brecha Salarial). Debe ser un ID registrado.
  extraTableId?: string;
}

export interface GriTableDefaultRow {
  label: string;
  fixed: boolean;          // true = no se puede borrar ni renombrar
  prefilled?: Record<string, string>;  // celdas pre-rellenadas (ej: descripción en T28)
}

// ─── Helpers ─────────────────────────────────────────

const labelCol = (colLabel = ''): GriTableColumn => ({
  key: 'label', label: colLabel, type: 'label', fixed: true,
});

const numCol = (key: string, label: string): GriTableColumn => ({
  key, label, type: 'number',
});

const pctCol = (key: string, label: string): GriTableColumn => ({
  key, label, type: 'percentage',
});

const sumRowCol = (key: string, label = 'Total'): GriTableColumn => ({
  key, label, type: 'sum_row',
});

const textFixedCol = (key: string, label: string): GriTableColumn => ({
  key, label, type: 'text_fixed', fixed: true,
});

const dynRows = (labels: string[], fixed = false): GriTableDefaultRow[] =>
  labels.map((label) => ({ label, fixed }));

const fixedRows = (labels: string[]): GriTableDefaultRow[] =>
  labels.map((label) => ({ label, fixed: true }));

// ─── CONFIG ──────────────────────────────────────────

export const GRI_TABLAS_CONFIG: Record<string, GriTableConfig> = {

  // ═══════════════════════════════════════════════════
  // PATTERN A: Simple headers + dynamic rows + total row
  // ═══════════════════════════════════════════════════

  T1: {
    id: 'T1', gri: '2-7', letra: 'a',
    title: 'Empleados por país y género',
    columns: [
      labelCol(),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['PAÍS 1', 'PAÍS 2', 'PAÍS 3', 'PAÍS 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'País',
  },

  T6: {
    id: 'T6', gri: '404-1', letra: 'a',
    title: 'Horas de formación por categoría y género',
    columns: [
      labelCol(),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3', 'Categoría 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  T7: {
    id: 'T7', gri: '205-2', letra: 'd',
    title: 'Incidentes de corrupción por categoría',
    columns: [
      labelCol(),
      pctCol('porcentaje', 'Porcentaje'),
      numCol('total_val', 'Total'),
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3', 'Categoría 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  T22: {
    id: 'T22', gri: '102-3', letra: 'a',
    title: 'Nuevos empleados contratados',
    columns: [
      labelCol('Nuevos empleados contratados'),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  T23: {
    id: 'T23', gri: '102-3', letra: 'b',
    title: 'Empleados rescindidos',
    columns: [
      labelCol('Empleados rescindidos'),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  T24: {
    id: 'T24', gri: '102-3', letra: 'c',
    title: 'Empleados reubicados',
    columns: [
      labelCol('Empleados reubicados'),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  T25: {
    id: 'T25', gri: '102-3', letra: 'd',
    title: 'Formación de empleados',
    columns: [
      labelCol('Formación de empleados'),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  // ═══════════════════════════════════════════════════
  // PATTERN B: Multi-col fixed headers + dynamic rows + total
  // ═══════════════════════════════════════════════════

  T8: {
    id: 'T8', gri: '303-3', letra: 'a',
    title: 'Extracción de agua por fuente y área',
    columns: [
      labelCol(),
      numCol('superficiales', 'Aguas superficiales'),
      numCol('subterraneas', 'Aguas subterráneas'),
      numCol('marinas', 'Aguas marinas'),
      numCol('producida', 'Agua producida'),
      numCol('terceros', 'Agua de terceros'),
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['Área 1', 'Área 2', 'Área 3', 'Área 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Área',
  },

  T9: {
    id: 'T9', gri: '303-3', letra: 'b',
    title: 'Extracción de agua con estrés hídrico',
    unit: 'en ML',
    columns: [
      labelCol(),
      numCol('superficiales', 'Aguas superficiales'),
      numCol('subterraneas', 'Aguas subterráneas'),
      numCol('marinas', 'Aguas marinas'),
      numCol('producida', 'Agua producida'),
      numCol('terceros', 'Agua de terceros'),
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Zona',
  },

  T11: {
    id: 'T11', gri: '303-4', letra: 'a',
    title: 'Vertido de agua por destino',
    columns: [
      labelCol(),
      numCol('superficiales', 'Aguas superficiales'),
      numCol('subterraneas', 'Aguas subterráneas'),
      numCol('marinas', 'Aguas marinas'),
      numCol('terceros_total', 'Agua de terceros (total)'),
      numCol('terceros_trasvasada', 'Agua de terceros trasvasada para uso por parte de otras organizaciones'),
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Zona',
  },

  T14: {
    id: 'T14', gri: '303-5', letra: 'a',
    title: 'Consumo de agua por zona',
    columns: [
      labelCol(),
      numCol('consumo', 'Consumo de agua'),
    ],
    defaultRows: dynRows(['Zona 1', 'Zona 2', 'Zona 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Zona',
  },

  T14b: {
    id: 'T14b', gri: '303-5', letra: 'b',
    title: 'Consumo de agua con estrés hídrico',
    columns: [
      labelCol(),
      numCol('consumo_estres', 'Consumo de agua con estrés hídrico'),
    ],
    defaultRows: dynRows(['Zona 1', 'Zona 2', 'Zona 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Zona',
  },

  T15: {
    id: 'T15', gri: '306-3', letra: 'a',
    title: 'Residuos generados por composición',
    columns: [
      labelCol(),
      numCol('peso', 'Peso total en toneladas métricas'),
    ],
    defaultRows: dynRows(['Composición residuos 1', 'Composición residuos 2', 'Composición residuos 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Composición',
  },

  T16: {
    id: 'T16', gri: '306-4', letra: 'a',
    title: 'Residuos no destinados a eliminación',
    columns: [
      labelCol(),
      numCol('peso', 'Peso total en toneladas métricas'),
    ],
    defaultRows: dynRows(['Composición residuos 1', 'Composición residuos 2', 'Composición residuos 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Composición',
  },

  T17: {
    id: 'T17', gri: '306-5', letra: 'a',
    title: 'Residuos destinados a eliminación',
    columns: [
      labelCol(),
      numCol('peso', 'Peso total en toneladas métricas'),
    ],
    defaultRows: dynRows(['Composición residuos 1', 'Composición residuos 2', 'Composición residuos 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Composición',
  },

  // ═══════════════════════════════════════════════════
  // PATTERN C: 2-level grouped headers + dynamic rows
  // ═══════════════════════════════════════════════════

  T2: {
    id: 'T2', gri: '2-7', letra: 'b',
    title: 'Empleados por tipo de contrato/jornada, país y género',
    headerGroups: [
      {
        label: 'Mujeres',
        columns: [
          numCol('m_indef', 'Contrato indefinido'),
          numCol('m_plazo', 'Contrato plazo fijo'),
          numCol('m_honor', 'Honorarios'),
          sumRowCol('m_total_contrato', 'Total'),
          numCol('m_ordinaria', 'Jornada ordinaria'),
          numCol('m_parcial', 'Tiempo parcial'),
          numCol('m_otra', 'Otra jornada'),
          sumRowCol('m_total_jornada', 'Total'),
        ],
      },
      {
        label: 'Hombres',
        columns: [
          numCol('h_indef', 'Contrato indefinido'),
          numCol('h_plazo', 'Contrato plazo fijo'),
          numCol('h_honor', 'Honorarios'),
          sumRowCol('h_total_contrato', 'Total'),
          numCol('h_ordinaria', 'Jornada ordinaria'),
          numCol('h_parcial', 'Tiempo parcial'),
          numCol('h_otra', 'Otra jornada'),
          sumRowCol('h_total_jornada', 'Total'),
        ],
      },
    ],
    defaultRows: dynRows(['PAÍS 1', 'PAÍS 2', 'PAÍS 3', 'PAÍS 4']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'País',
  },

  T5: {
    id: 'T5', gri: '405-1', letra: 'b',
    title: 'Diversidad por categoría laboral y género',
    headerGroups: [
      {
        label: 'Mujeres',
        columns: [
          numCol('m_30', 'Menores de 30 años'),
          numCol('m_30_50', 'Entre 30 y 50 años'),
          numCol('m_50', 'Mayores de 50 años'),
          sumRowCol('m_total', 'Total'),
        ],
      },
      {
        label: 'Hombres',
        columns: [
          numCol('h_30', 'Menores de 30 años'),
          numCol('h_30_50', 'Entre 30 y 50 años'),
          numCol('h_50', 'Mayores de 50 años'),
          sumRowCol('h_total', 'Total'),
        ],
      },
    ],
    defaultRows: dynRows(['Categoría 1', 'Categoría 2', 'Categoría 3']),
    addRows: true, addCols: false,
    totalRow: false, totalCol: false,
    rowLabelPlaceholder: 'Categoría',
  },

  T18: {
    id: 'T18', gri: '401-1', letra: 'a',
    title: 'Nuevas contrataciones por región, edad y género',
    headerGroups: [
      {
        label: 'Mujeres',
        columns: [
          numCol('m_30', 'Menores de 30 años'),
          numCol('m_30_50', 'Entre 30 y 50 años'),
          numCol('m_50', 'Mayores de 50 años'),
          sumRowCol('m_total', 'Total'),
        ],
      },
      {
        label: 'Hombres',
        columns: [
          numCol('h_30', 'Menores de 30 años'),
          numCol('h_30_50', 'Entre 30 y 50 años'),
          numCol('h_50', 'Mayores de 50 años'),
          sumRowCol('h_total', 'Total'),
        ],
      },
    ],
    defaultRows: dynRows(['Región 1', 'Región 2', 'Región 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Región',
  },

  T19: {
    id: 'T19', gri: '401-1', letra: 'b',
    title: 'Rotación de personal por región, edad y género',
    headerGroups: [
      {
        label: 'Mujeres',
        columns: [
          numCol('m_30', 'Menores de 30 años'),
          numCol('m_30_50', 'Entre 30 y 50 años'),
          numCol('m_50', 'Mayores de 50 años'),
          sumRowCol('m_total', 'Total'),
        ],
      },
      {
        label: 'Hombres',
        columns: [
          numCol('h_30', 'Menores de 30 años'),
          numCol('h_30_50', 'Entre 30 y 50 años'),
          numCol('h_50', 'Mayores de 50 años'),
          sumRowCol('h_total', 'Total'),
        ],
      },
    ],
    defaultRows: dynRows(['Región 1', 'Región 2', 'Región 3']),
    addRows: true, addCols: false,
    totalRow: true, totalCol: false,
    rowLabelPlaceholder: 'Región',
  },

  // ═══════════════════════════════════════════════════
  // PATTERN D: Fixed rows (no +ADD) + fixed cols + total
  // ═══════════════════════════════════════════════════

  T4: {
    id: 'T4', gri: '405-1', letra: 'a',
    title: 'Diversidad de órganos de gobierno por edad y género',
    columns: [
      labelCol(),
      numCol('mujeres', 'Mujeres'),
      numCol('hombres', 'Hombres'),
      sumRowCol('total'),
    ],
    defaultRows: fixedRows(['Menores de 30 años', 'Entre 30 y 50 años', 'Mayores de 50 años']),
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
  },

  T10: {
    id: 'T10', gri: '303-3', letra: 'c',
    title: 'Extracción de agua por calidad',
    columns: [
      labelCol(),
      numCol('agua_dulce', 'Agua dulce (total de sólidos disueltos ≤ 1000 mg/l)'),
      numCol('otras_aguas', 'Otras aguas (total de sólidos disueltos > 1000 mg/l)'),
    ],
    defaultRows: fixedRows(['Aguas superficiales', 'Aguas subterráneas', 'Aguas marinas', 'Agua de terceros']),
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
  },

  T12: {
    id: 'T12', gri: '303-4', letra: 'b',
    title: 'Vertido de agua por calidad',
    columns: [
      labelCol(),
      numCol('agua_dulce', 'Agua dulce (total de sólidos disueltos ≤ 1000 mg/l)'),
      numCol('otras_aguas', 'Otras aguas (total de sólidos disueltos > 1000 mg/l)'),
    ],
    defaultRows: fixedRows([
      'Aguas superficiales', 'Aguas subterráneas',
      'Agua de terceros (total)',
      'Agua de terceros trasvasada para uso por parte de otras organizaciones',
    ]),
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
  },

  T13: {
    id: 'T13', gri: '303-4', letra: 'c',
    title: 'Vertido de agua por calidad (zonas estrés hídrico)',
    columns: [
      labelCol(),
      numCol('agua_dulce', 'Agua dulce (total de sólidos disueltos ≤ 1000 mg/l)'),
      numCol('otras_aguas', 'Otras aguas (total de sólidos disueltos > 1000 mg/l)'),
    ],
    defaultRows: fixedRows([
      'Aguas superficiales', 'Aguas subterráneas',
      'Agua de terceros (total)',
      'Agua de terceros trasvasada para uso por parte de otras organizaciones',
    ]),
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
  },

  // ═══════════════════════════════════════════════════
  // PATTERN E: Fixed rows + special (GEI/Alcance)
  // ═══════════════════════════════════════════════════

  T26: {
    id: 'T26', gri: '102-5', letra: 'b',
    title: 'Emisiones GEI — Alcance 1',
    columns: [
      labelCol('Gas de Efecto Invernadero (GEI)'),
      numCol('emisiones_tm', 'Emisiones Brutas (Toneladas Métricas)'),
      numCol('emisiones_co2e', 'Emisiones Brutas (tCO2e)'),
    ],
    defaultRows: fixedRows([
      'Dióxido de Carbono (CO2)',
      'Metano (CH4)',
      'Óxido Nitroso (N2O)',
      'Hidrofluorocarbonos (HFC)',
      'Perfluorocarbonos (PFC)',
      'Hexafluoruro de Azufre (SF6)',
      'Trifluoruro de Nitrógeno (NF3)',
    ]),
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
    totalRowLabel: 'TOTAL ALCANCE 1',
  },

  T27: {
    id: 'T27', gri: '102-6', letra: 'b',
    title: 'Emisiones GEI — Alcance 2',
    columns: [
      labelCol('Gas de Efecto Invernadero (GEI)'),
      numCol('emisiones_tm', 'Emisiones Brutas (Toneladas Métricas)'),
      numCol('emisiones_co2e', 'Emisiones Brutas (tCO2e)'),
    ],
    defaultRows: fixedRows([
      'Dióxido de Carbono (CO2)',
      'Metano (CH4)',
      'Óxido Nitroso (N2O)',
    ]),
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
    totalRowLabel: 'TOTAL ALCANCE 2',
  },

  // ═══════════════════════════════════════════════════
  // PATTERN F: Section headers + fixed description
  // ═══════════════════════════════════════════════════

  T28: {
    id: 'T28', gri: '102-7', letra: 'b',
    title: 'Emisiones GEI — Alcance 3',
    columns: [
      labelCol('Categoría de Alcance 3'),
      textFixedCol('descripcion', 'Descripción de la Actividad'),
      numCol('emisiones', 'Emisiones (tCO2e)'),
    ],
    sectionHeaders: [
      { label: 'Actividades Upstream', beforeRowIndex: 0 },
      { label: 'Actividades Downstream', beforeRowIndex: 8 },
    ],
    defaultRows: [
      { label: '1. Bienes y servicios comprados', fixed: true, prefilled: { descripcion: 'Producción de insumos y servicios adquiridos.' } },
      { label: '2. Bienes de capital', fixed: true, prefilled: { descripcion: 'Fabricación de activos fijos (maquinaria, edificios).' } },
      { label: '3. Combustibles y energía', fixed: true, prefilled: { descripcion: 'Extracción y transporte de energía (no en Alcance 1 o 2).' } },
      { label: '4. Transporte y distribución', fixed: true, prefilled: { descripcion: 'Logística de proveedores a la organización.' } },
      { label: '5. Residuos generados', fixed: true, prefilled: { descripcion: 'Tratamiento y disposición de residuos operativos.' } },
      { label: '6. Viajes de negocios', fixed: true, prefilled: { descripcion: 'Traslados aéreos, terrestres o marítimos de empleados.' } },
      { label: '7. Desplazamiento de empleados', fixed: true, prefilled: { descripcion: 'Trayecto casa-trabajo (commuting).' } },
      { label: '8. Activos arrendados', fixed: true, prefilled: { descripcion: 'Operación de activos alquilados (upstream).' } },
      { label: '9. Transporte y distribución', fixed: true, prefilled: { descripcion: 'Logística de productos vendidos hacia el cliente.' } },
      { label: '10. Procesamiento de productos', fixed: true, prefilled: { descripcion: 'Transformación posterior de productos vendidos.' } },
      { label: '11. Uso de productos vendidos', fixed: true, prefilled: { descripcion: 'Emisiones durante el uso del producto por el cliente.' } },
      { label: '12. Fin de vida de productos', fixed: true, prefilled: { descripcion: 'Tratamiento de residuos de productos vendidos.' } },
      { label: '13. Activos arrendados', fixed: true, prefilled: { descripcion: 'Operación de activos propiedad de la empresa (alquilados a otros).' } },
      { label: '14. Franquicias', fixed: true, prefilled: { descripcion: 'Operación de franquicias de la organización.' } },
      { label: '15. Inversiones', fixed: true, prefilled: { descripcion: 'Emisiones asociadas a la cartera de inversiones.' } },
    ],
    addRows: false, addCols: false,
    totalRow: true, totalCol: false,
    totalRowLabel: 'TOTAL ALCANCE 3',
  },

  // ═══════════════════════════════════════════════════
  // PATTERN G: Dynamic rows AND dynamic cols + total row + col
  // ═══════════════════════════════════════════════════

  T20: {
    id: 'T20', gri: '205-2', letra: 'b',
    title: 'Incidentes de corrupción por zona y categoría',
    columns: [
      labelCol(),
      numCol('cat_1', 'Categoría 1'),
      numCol('cat_2', 'Categoría 2'),
      numCol('cat_3', 'Categoría 3'),
      numCol('cat_4', 'Categoría 4'),
      // +ADD cols aquí
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4']),
    addRows: true, addCols: true,
    totalRow: true, totalCol: true,
    rowLabelPlaceholder: 'Zona',
    colLabelPlaceholder: 'Categoría',
  },

  T21: {
    id: 'T21', gri: '205-2', letra: 'e',
    title: 'Acciones legales por zona y categoría',
    columns: [
      labelCol(),
      numCol('cat_1', 'Categoría 1'),
      numCol('cat_2', 'Categoría 2'),
      numCol('cat_3', 'Categoría 3'),
      numCol('cat_4', 'Categoría 4'),
      // +ADD cols aquí
      sumRowCol('total'),
    ],
    defaultRows: dynRows(['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4']),
    addRows: true, addCols: true,
    totalRow: true, totalCol: true,
    rowLabelPlaceholder: 'Zona',
    colLabelPlaceholder: 'Categoría',
  },
};

// ─── Lookup helper ───────────────────────────────────

/** Obtener config por ID de tabla (ej: 'T1', 'T28') */
export function getGriTablaConfig(tableId: string): GriTableConfig | undefined {
  return GRI_TABLAS_CONFIG[tableId];
}

/** Obtener todas las columnas flat (incluyendo de headerGroups) */
export function getFlatColumns(config: GriTableConfig): GriTableColumn[] {
  if (config.columns) return config.columns;
  if (config.headerGroups) {
    return [
      labelCol(),
      ...config.headerGroups.flatMap((g) => g.columns),
    ];
  }
  return [labelCol()];
}
