/**
 * NCG Tables Configuration — 12 table templates
 * Based on "tabla reporte NCG.md"
 *
 * IDs use "NCG-" prefix to avoid collision with GRI table IDs (T1..T28).
 * DB column ncg_items_requerimientos_reporte.tabla stores these prefixed IDs.
 *
 * Patterns used:
 * C: 2-level grouped headers + fixed rows
 * D: Fixed rows + simple columns + optional total row
 * F: Section headers + mixed columns (Pattern F-like)
 */

import type { GriTableConfig, GriTableColumn } from './gri-tablas-config';

// ─── Re-export helpers (same as gri-tablas-config) ───────────────────────────

const labelCol = (colLabel = ''): GriTableColumn => ({
  key: 'label', label: colLabel, type: 'label', fixed: true,
});

const numCol = (key: string, label: string): GriTableColumn => ({
  key, label, type: 'number',
});

const sumRowCol = (key: string, label = 'Total'): GriTableColumn => ({
  key, label, type: 'sum_row',
});

const sumRowPartial = (key: string, label: string, sumKeys: string[]): GriTableColumn => ({
  key, label, type: 'sum_row', sumKeys,
});

const textFixedCol = (key: string, label: string): GriTableColumn => ({
  key, label, type: 'text_fixed', fixed: true,
});

const fixedRows = (labels: string[]) =>
  labels.map((label) => ({ label, fixed: true }));

// Shared category list used in most tables
const CATEGORIAS_LABORALES = [
  'Alta gerencia',
  'Gerencia',
  'Jefatura',
  'Operario',
  'Fuerza de Venta',
  'Administrativo',
  'Auxiliar',
  'Otros profesionales',
  'Otros técnicos',
];

// ─── CONFIG ──────────────────────────────────────────────────────────────────

export const NCG_TABLAS_CONFIG: Record<string, GriTableConfig> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T1-T2: Criterio de Reporte / Demografía — Directorio
  // Letra xiii (secciones a–e de la norma NCG)
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T1-T2': {
    id: 'NCG-T1-T2',
    gri: 'NCG Sección 5.1',
    letra: 'xiii',
    title: 'Criterio de Reporte / Demografía — Directorio',
    headerGroups: [
      {
        label: 'Titulares',
        columns: [
          numCol('tit_h', 'Hombres'),
          numCol('tit_m', 'Mujeres'),
          sumRowPartial('tit_total', 'Total Titulares', ['tit_h', 'tit_m']),
        ],
      },
      {
        label: 'Suplentes',
        columns: [
          numCol('sup_h', 'Hombres'),
          numCol('sup_m', 'Mujeres'),
          sumRowPartial('sup_total', 'Total Suplentes', ['sup_h', 'sup_m']),
        ],
      },
      {
        label: 'Totales',
        columns: [
          sumRowPartial('tot_h', 'Total Hombres', ['tit_h', 'sup_h']),
          sumRowPartial('tot_m', 'Total Mujeres', ['tit_m', 'sup_m']),
          sumRowPartial('tot_total', 'TOTAL GENERAL', ['tit_h', 'tit_m', 'sup_h', 'sup_m']),
        ],
      },
    ],
    sectionHeaders: [
      { beforeRowIndex: 1, label: 'b. Nacionalidad' },
      { beforeRowIndex: 3, label: 'c. Rango de Edad (Según Sección 5.1.3)' },
      { beforeRowIndex: 9, label: 'd. Antigüedad en la Organización (Según Sección 5.1.4)' },
      { beforeRowIndex: 14, label: 'e. Situación de Discapacidad' },
    ],
    defaultRows: fixedRows([
      'a. TOTAL DIRECTORES (General)',
      'Chilena',
      'Extranjeros',
      'Menos de 30 años',
      'Entre 30 y 40 años',
      'Entre 41 y 50',
      'Entre 51 y 60',
      'Entre 61 y 70',
      'Más de 70 años',
      'Menos de 3 años',
      'Entre 3 y 6 años',
      'Más de 6 y menos de 9',
      'Entre 9 y 12',
      'Más de 12 años',
      'Con Discapacidad',
      'Sin Discapacidad',
    ]),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
    // Sección f de la letra xiii: tabla con encabezados distintos, se renderiza
    // debajo de la a–e dentro de la misma respuesta.
    extraTableId: 'NCG-T1-T2-F',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T1-T2-F: Brecha Salarial por Sexo — Directorio (Sección 5.4.2)
  // Tabla secundaria de la letra xiii (sección f). NO es una letra/requerimiento
  // propio: se adjunta a NCG-T1-T2 vía extraTableId.
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T1-T2-F': {
    id: 'NCG-T1-T2-F',
    gri: 'NCG Sección 5.4.2',
    letra: 'xiii',
    title: 'f. Brecha Salarial por Sexo (Sección 5.4.2)',
    columns: [
      labelCol('Órgano del Directorio'),
      numCol('media_h', 'Media Salario Bruto por Hora H ($)'),
      numCol('media_m', 'Media Salario Bruto por Hora M ($)'),
      numCol('media_brecha', 'Media de Brecha Salarial (%)'),
      numCol('mediana_h', 'Mediana Salario Bruto por Hora H ($)'),
      numCol('mediana_m', 'Mediana Salario Bruto por Hora M ($)'),
      numCol('mediana_brecha', 'Mediana de Brecha Salarial (%)'),
    ],
    defaultRows: fixedRows([
      'Directores Titulares',
      'Directores Suplentes',
    ]),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T3: Categorías de Funciones / Tipo de Cargo
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T3': {
    id: 'NCG-T3',
    gri: 'NCG Sección 5',
    letra: 'i',
    title: 'Categoría de Funciones / Tipo de Cargo',
    columns: [
      labelCol('Categoría de Funciones / Tipo de Cargo'),
      numCol('h', 'Total Hombres'),
      numCol('m', 'Total Mujeres'),
      sumRowCol('total', 'TOTAL GENERAL'),
    ],
    defaultRows: fixedRows(CATEGORIAS_LABORALES),
    addRows: false,
    addCols: false,
    totalRow: true,
    totalRowLabel: 'TOTAL DOTACIÓN EMPRESA',
    totalCol: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T4: Diversidad por Categoría y Nacionalidad
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T4': {
    id: 'NCG-T4',
    gri: 'NCG Sección 5.1.2',
    letra: 'i',
    title: 'Diversidad por Categoría y Nacionalidad',
    headerGroups: [
      {
        label: 'Nacionalidad Chilena',
        columns: [
          numCol('chil_h', 'Hombres'),
          numCol('chil_m', 'Mujeres'),
          sumRowPartial('chil_tot', 'Total Chilena', ['chil_h', 'chil_m']),
        ],
      },
      {
        label: 'Nacionalidad Extranjera',
        columns: [
          numCol('ext_h', 'Hombres'),
          numCol('ext_m', 'Mujeres'),
          sumRowPartial('ext_tot', 'Total Extranjera', ['ext_h', 'ext_m']),
        ],
      },
      {
        label: 'Total',
        columns: [
          sumRowPartial('total_gen', 'TOTAL GENERAL', ['chil_h', 'chil_m', 'ext_h', 'ext_m']),
        ],
      },
    ],
    defaultRows: fixedRows([...CATEGORIAS_LABORALES, 'TOTAL DOTACIÓN']),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T5: Diversidad por Categoría y Edad
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T5': {
    id: 'NCG-T5',
    gri: 'NCG Sección 5.1.3',
    letra: 'i',
    title: 'Diversidad por Categoría y Rango de Edad',
    headerGroups: [
      {
        label: 'Menos de 30 años',
        columns: [numCol('m30_h', 'H'), numCol('m30_m', 'M')],
      },
      {
        label: 'Entre 30 y 40 años',
        columns: [numCol('a30_40_h', 'H'), numCol('a30_40_m', 'M')],
      },
      {
        label: 'Entre 41 y 50 años',
        columns: [numCol('a41_50_h', 'H'), numCol('a41_50_m', 'M')],
      },
      {
        label: 'Entre 51 y 60 años',
        columns: [numCol('a51_60_h', 'H'), numCol('a51_60_m', 'M')],
      },
      {
        label: 'Entre 61 y 70 años',
        columns: [numCol('a61_70_h', 'H'), numCol('a61_70_m', 'M')],
      },
      {
        label: 'Más de 70 años',
        columns: [numCol('m70_h', 'H'), numCol('m70_m', 'M')],
      },
      {
        label: 'Total',
        columns: [sumRowPartial('total_gen', 'TOTAL GENERAL', ['m30_h', 'm30_m', 'a30_40_h', 'a30_40_m', 'a41_50_h', 'a41_50_m', 'a51_60_h', 'a51_60_m', 'a61_70_h', 'a61_70_m', 'm70_h', 'm70_m'])],
      },
    ],
    defaultRows: fixedRows([...CATEGORIAS_LABORALES, 'TOTALES EMPRESA']),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T6: Diversidad por Categoría y Antigüedad
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T6': {
    id: 'NCG-T6',
    gri: 'NCG Sección 5.1.4',
    letra: 'i',
    title: 'Diversidad por Categoría y Antigüedad en la Organización',
    headerGroups: [
      {
        label: 'Menos de 3 años',
        columns: [numCol('m3_h', 'H'), numCol('m3_m', 'M')],
      },
      {
        label: 'Entre 3 y 6 años',
        columns: [numCol('a3_6_h', 'H'), numCol('a3_6_m', 'M')],
      },
      {
        label: 'Más de 6 y menos de 9',
        columns: [numCol('a6_9_h', 'H'), numCol('a6_9_m', 'M')],
      },
      {
        label: 'Entre 9 y 12 años',
        columns: [numCol('a9_12_h', 'H'), numCol('a9_12_m', 'M')],
      },
      {
        label: 'Más de 12 años',
        columns: [numCol('m12_h', 'H'), numCol('m12_m', 'M')],
      },
      {
        label: 'Total',
        columns: [sumRowPartial('total_gen', 'TOTAL GENERAL', ['m3_h', 'm3_m', 'a3_6_h', 'a3_6_m', 'a6_9_h', 'a6_9_m', 'a9_12_h', 'a9_12_m', 'm12_h', 'm12_m'])],
      },
    ],
    defaultRows: fixedRows([...CATEGORIAS_LABORALES, 'TOTALES EMPRESA']),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T7: Personas con Discapacidad por Categoría
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T7': {
    id: 'NCG-T7',
    gri: 'NCG Sección 5.1.5',
    letra: 'i',
    title: 'Personas con Discapacidad por Categoría',
    columns: [
      labelCol('Categoría de Funciones'),
      numCol('h_disc', 'Personas con Discapacidad — Hombres'),
      numCol('m_disc', 'Personas con Discapacidad — Mujeres'),
    ],
    defaultRows: fixedRows(CATEGORIAS_LABORALES),
    addRows: false,
    addCols: false,
    totalRow: true,
    totalRowLabel: 'TOTALES EMPRESA',
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T8: Modalidades de Contrato / Vínculo Laboral
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T8': {
    id: 'NCG-T8',
    gri: 'NCG Sección 5.2.1',
    letra: 'i',
    title: 'Modalidades de Contrato / Vínculo Laboral',
    columns: [
      labelCol('Modalidad de Contrato / Vínculo Laboral'),
      numCol('h_num', 'Hombres'),
      numCol('m_num', 'Mujeres'),
      sumRowPartial('tot_num', 'Total Número', ['h_num', 'm_num']),
      numCol('h_pct', 'Hombres (%)'),
      numCol('m_pct', 'Mujeres (%)'),
      numCol('tot_pct', 'Total General (%)'),
    ],
    defaultRows: fixedRows([
      'Contrato a Plazo Indefinido',
      'Contrato a Plazo Fijo',
      'Contrato por Obra o Faena',
      'Prestación de Servicios a Honorarios',
      'TOTAL VÍNCULOS LABORALES',
    ]),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T9: Modalidades de Jornada / Pactos de Adaptabilidad
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T9': {
    id: 'NCG-T9',
    gri: 'NCG Sección 5.2.2',
    letra: 'i',
    title: 'Modalidades de Jornada / Pactos de Adaptabilidad',
    columns: [
      labelCol('Modalidad de Jornada / Pactos de Adaptabilidad'),
      numCol('h_num', 'Hombres'),
      numCol('m_num', 'Mujeres'),
      sumRowPartial('tot_num', 'Total Número', ['h_num', 'm_num']),
      numCol('h_pct', 'Hombres (%)'),
      numCol('m_pct', 'Mujeres (%)'),
      numCol('tot_pct', 'Total General'),
    ],
    defaultRows: fixedRows([
      'Jornada ordinaria de trabajo',
      'Jornada a tiempo parcial',
      'Teletrabajo parcial',
      'Teletrabajo completo',
      'Pactos de adaptabilidad para trabajadores con responsabilidades familiares',
      'Bandas de horas para personas con cuidado de niños/as de hasta 12 años',
      'TOTAL TRABAJADORES DE LA ENTIDAD (Base de Cálculo)',
    ]),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T10: Brecha Salarial por Categoría de Funciones
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T10': {
    id: 'NCG-T10',
    gri: 'NCG Sección 5.4.2',
    letra: 'i',
    title: 'Brecha Salarial por Categoría de Funciones',
    columns: [
      labelCol('Categoría de Funciones'),
      numCol('media_brecha', 'Brecha Salarial — Media de Brecha (%)'),
      numCol('mediana_brecha', 'Brecha Salarial — Mediana de Brecha'),
    ],
    defaultRows: fixedRows(CATEGORIAS_LABORALES),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T11: Indicadores de Seguridad Laboral
  // Usa sectionHeaders para separar "Datos Base" de "Indicadores Calculados"
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T11': {
    id: 'NCG-T11',
    gri: 'NCG Sección 5.3',
    letra: 'i',
    title: 'Indicadores de Seguridad Laboral',
    columns: [
      labelCol('Concepto / Indicador de Seguridad'),
      textFixedCol('formula', 'Fórmula'),
      numCol('resultado', 'Resultado Real del Año'),
    ],
    sectionHeaders: [
      { beforeRowIndex: 0, label: '1. Datos Base (Variables del Período)' },
      { beforeRowIndex: 5, label: '2. Indicadores de Seguridad Laboral (Tasas Calculadas)' },
    ],
    defaultRows: [
      { label: 'Promedio mensual de trabajadores contratados', fixed: true, prefilled: { formula: '' } },
      { label: 'Número de accidentes de trabajo durante el año', fixed: true, prefilled: { formula: '' } },
      { label: 'Número de fatalidades por accidentes de trabajo', fixed: true, prefilled: { formula: '' } },
      { label: 'Número de enfermedades profesionales durante el año', fixed: true, prefilled: { formula: '' } },
      { label: 'Días perdidos por accidentes de trabajo', fixed: true, prefilled: { formula: '' } },
      {
        label: 'Tasa de Accidentabilidad',
        fixed: true,
        prefilled: { formula: '(Nº Accidentes / Nº Trabajadores) x 100' },
      },
      {
        label: 'Tasa de Fatalidad',
        fixed: true,
        prefilled: { formula: '(Nº Fatalidades / Nº Trabajadores) x 100.000' },
      },
      {
        label: 'Tasa de Enfermedades Profesionales',
        fixed: true,
        prefilled: { formula: '(Nº Enf. Profesionales / Nº Trabajadores) x 100' },
      },
      {
        label: 'Promedio de Días Perdidos por Accidente',
        fixed: true,
        prefilled: { formula: 'Días Perdidos / Nº Accidentes de Trabajo' },
      },
    ],
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T12: Capacitación por Categoría y Género
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T12': {
    id: 'NCG-T12',
    gri: 'NCG Sección 5.5.1',
    letra: 'ii',
    title: 'Capacitación por Categoría y Género',
    headerGroups: [
      {
        label: 'Personal Masculino',
        columns: [
          numCol('m_dot', 'Dotación Total'),
          numCol('m_cap', 'Nº Personal Capacitado'),
          numCol('m_cob', '% Cobertura Capacitación'),
        ],
      },
      {
        label: 'Personal Femenino',
        columns: [
          numCol('f_dot', 'Dotación Total'),
          numCol('f_cap', 'Nº Personal Capacitado'),
          numCol('f_cob', '% Cobertura Capacitación'),
        ],
      },
      {
        label: 'Total General',
        columns: [
          sumRowPartial('tot_dot', 'Dotación Total General', ['m_dot', 'f_dot']),
          sumRowPartial('tot_cap', 'Total Personal Capacitado', ['m_cap', 'f_cap']),
          numCol('tot_cob', '% Cobertura General'),
        ],
      },
    ],
    defaultRows: fixedRows([...CATEGORIAS_LABORALES, 'TOTAL CONSOLIDADO EMPRESA']),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NCG-T13: Horas de Formación por Categoría
  // ═══════════════════════════════════════════════════════════════════════════
  'NCG-T13': {
    id: 'NCG-T13',
    gri: 'NCG Sección 5.5.2',
    letra: 'iii',
    title: 'Horas de Formación por Categoría',
    headerGroups: [
      {
        label: 'Personal Masculino',
        columns: [
          numCol('m_horas', 'Total Horas'),
          numCol('m_dot', 'Dotación'),
          numCol('m_prom', 'Promedio Horas'),
        ],
      },
      {
        label: 'Personal Femenino',
        columns: [
          numCol('f_horas', 'Total Horas'),
          numCol('f_dot', 'Dotación'),
          numCol('f_prom', 'Promedio'),
        ],
      },
      {
        label: 'Total',
        columns: [
          sumRowPartial('tot_horas', 'Total Horas', ['m_horas', 'f_horas']),
          sumRowPartial('tot_dot', 'Dotación Total', ['m_dot', 'f_dot']),
          numCol('tot_prom', 'Promedio Horas'),
        ],
      },
    ],
    defaultRows: fixedRows([...CATEGORIAS_LABORALES, 'TOTAL CONSOLIDADO EMPRESA']),
    addRows: false,
    addCols: false,
    totalRow: false,
    totalCol: false,
  },
};

// ─── Lookup helper ────────────────────────────────────────────────────────────

export function getNcgTablaConfig(id: string): GriTableConfig | null {
  return NCG_TABLAS_CONFIG[id] ?? null;
}
