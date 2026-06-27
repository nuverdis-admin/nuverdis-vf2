// lib/vf2/templates/index.ts
// Plantillas predefinidas de grids vf2_ para estándares GRI y NCG.
// Cada "row" de la plantilla se convierte en una métrica de la empresa.
// Las columnas son siempre años (el usuario elige el período).

export interface Vf2TemplateRow {
  codigo: string    // código corto único por empresa para ON CONFLICT
  nombre: string    // nombre completo de la métrica
  unidad?: string
  value_kind: 'num' | 'text'
}

export interface Vf2Template {
  id: string
  estandar: 'GRI' | 'NCG'
  griCode?: string   // ej. '305-1'
  ncgCode?: string   // ej. '5.3'
  titulo: string
  rows: Vf2TemplateRow[]
  note?: string
}

// ── GRI ──────────────────────────────────────────────────────────────────────

const VF2_GRI_TEMPLATES: Vf2Template[] = [
  {
    id: 'gri-305-1',
    estandar: 'GRI',
    griCode: '305-1',
    titulo: 'Emisiones GEI — Alcance 1',
    note: 'Gases de efecto invernadero directos, en tCO₂e',
    rows: [
      { codigo: 'GRI-305-1-CO2',  nombre: 'Dióxido de Carbono (CO₂)',              unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-CH4',  nombre: 'Metano (CH₄)',                           unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-N2O',  nombre: 'Óxido Nitroso (N₂O)',                    unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-HFC',  nombre: 'Hidrofluorocarbonos (HFC)',              unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-PFC',  nombre: 'Perfluorocarbonos (PFC)',                unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-SF6',  nombre: 'Hexafluoruro de Azufre (SF₆)',          unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-NF3',  nombre: 'Trifluoruro de Nitrógeno (NF₃)',        unidad: 'tCO₂e', value_kind: 'num' },
    ],
  },
  {
    id: 'gri-305-2',
    estandar: 'GRI',
    griCode: '305-2',
    titulo: 'Emisiones GEI — Alcance 2',
    note: 'Emisiones indirectas por consumo de energía, en tCO₂e',
    rows: [
      { codigo: 'GRI-305-2-CO2',  nombre: 'Dióxido de Carbono (CO₂)',  unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-2-CH4',  nombre: 'Metano (CH₄)',               unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-2-N2O',  nombre: 'Óxido Nitroso (N₂O)',        unidad: 'tCO₂e', value_kind: 'num' },
    ],
  },
  {
    id: 'gri-305-3',
    estandar: 'GRI',
    griCode: '305-3',
    titulo: 'Emisiones GEI — Alcance 3',
    note: '15 categorías de emisiones indirectas de la cadena de valor, en tCO₂e',
    rows: [
      { codigo: 'GRI-305-3-C01', nombre: '1. Bienes y servicios comprados',                       unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C02', nombre: '2. Bienes de capital',                                   unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C03', nombre: '3. Combustibles y energía',                              unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C04', nombre: '4. Transporte y distribución (upstream)',                unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C05', nombre: '5. Residuos generados en operaciones',                  unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C06', nombre: '6. Viajes de negocios',                                  unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C07', nombre: '7. Desplazamiento de empleados (commuting)',             unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C08', nombre: '8. Activos arrendados (upstream)',                       unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C09', nombre: '9. Transporte y distribución (downstream)',              unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C10', nombre: '10. Procesamiento de productos vendidos',               unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C11', nombre: '11. Uso de productos vendidos',                         unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C12', nombre: '12. Fin de vida de productos vendidos',                 unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C13', nombre: '13. Activos arrendados (downstream)',                   unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C14', nombre: '14. Franquicias',                                        unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C15', nombre: '15. Inversiones',                                        unidad: 'tCO₂e', value_kind: 'num' },
    ],
  },
  {
    id: 'gri-303-3c',
    estandar: 'GRI',
    griCode: '303-3',
    titulo: 'Extracción de agua por fuente y calidad',
    note: 'Agua dulce y otras aguas por tipo de fuente',
    rows: [
      { codigo: 'GRI-303-3-SUP-DULCE',   nombre: 'Aguas superficiales — Agua dulce (TDS ≤ 1.000 mg/l)',    unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-SUP-OTRAS',   nombre: 'Aguas superficiales — Otras aguas (TDS > 1.000 mg/l)',   unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-SUB-DULCE',   nombre: 'Aguas subterráneas — Agua dulce',                        unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-SUB-OTRAS',   nombre: 'Aguas subterráneas — Otras aguas',                       unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-MAR-DULCE',   nombre: 'Aguas marinas — Agua dulce',                             unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-MAR-OTRAS',   nombre: 'Aguas marinas — Otras aguas',                            unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-TER-DULCE',   nombre: 'Agua de terceros — Agua dulce',                          unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-TER-OTRAS',   nombre: 'Agua de terceros — Otras aguas',                         unidad: 'ML', value_kind: 'num' },
    ],
  },
  {
    id: 'gri-405-1a',
    estandar: 'GRI',
    griCode: '405-1',
    titulo: 'Diversidad de órganos de gobierno por edad y género',
    rows: [
      { codigo: 'GRI-405-1-GOB-M-30M',    nombre: 'Directores — Mujeres menores de 30 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-H-30M',    nombre: 'Directores — Hombres menores de 30 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-M-3050',   nombre: 'Directores — Mujeres entre 30 y 50 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-H-3050',   nombre: 'Directores — Hombres entre 30 y 50 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-M-50P',    nombre: 'Directores — Mujeres mayores de 50 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-H-50P',    nombre: 'Directores — Hombres mayores de 50 años',   unidad: 'personas', value_kind: 'num' },
    ],
  },
  {
    id: 'gri-401-1a',
    estandar: 'GRI',
    griCode: '401-1',
    titulo: 'Nuevas contrataciones y rotación de personal',
    note: 'Por rango de edad y género — agregar filas por región si aplica',
    rows: [
      { codigo: 'GRI-401-1-NC-M-30M',  nombre: 'Nuevas contrataciones — Mujeres < 30 años',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-H-30M',  nombre: 'Nuevas contrataciones — Hombres < 30 años',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-M-3050', nombre: 'Nuevas contrataciones — Mujeres 30-50 años', unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-H-3050', nombre: 'Nuevas contrataciones — Hombres 30-50 años', unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-M-50P',  nombre: 'Nuevas contrataciones — Mujeres > 50 años',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-H-50P',  nombre: 'Nuevas contrataciones — Hombres > 50 años',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-ROT-M',     nombre: 'Rotación — Total Mujeres',                    unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-ROT-H',     nombre: 'Rotación — Total Hombres',                    unidad: 'personas', value_kind: 'num' },
    ],
  },
]

// ── NCG ──────────────────────────────────────────────────────────────────────

const VF2_NCG_TEMPLATES: Vf2Template[] = [
  {
    id: 'ncg-5-dotacion',
    estandar: 'NCG',
    ncgCode: '5',
    titulo: 'Dotación por Categoría Laboral y Género',
    rows: [
      { codigo: 'NCG-5-ALTA-H',    nombre: 'Alta gerencia — Hombres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-ALTA-M',    nombre: 'Alta gerencia — Mujeres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-GER-H',     nombre: 'Gerencia — Hombres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-GER-M',     nombre: 'Gerencia — Mujeres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-JEF-H',     nombre: 'Jefatura — Hombres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-JEF-M',     nombre: 'Jefatura — Mujeres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPE-H',     nombre: 'Operario — Hombres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPE-M',     nombre: 'Operario — Mujeres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-VEN-H',     nombre: 'Fuerza de Venta — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-VEN-M',     nombre: 'Fuerza de Venta — Mujeres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-ADM-H',     nombre: 'Administrativo — Hombres',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-ADM-M',     nombre: 'Administrativo — Mujeres',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-AUX-H',     nombre: 'Auxiliar — Hombres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-AUX-M',     nombre: 'Auxiliar — Mujeres',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPRO-H',    nombre: 'Otros profesionales — Hombres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPRO-M',    nombre: 'Otros profesionales — Mujeres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OTEC-H',    nombre: 'Otros técnicos — Hombres',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OTEC-M',    nombre: 'Otros técnicos — Mujeres',        unidad: 'personas', value_kind: 'num' },
    ],
  },
  {
    id: 'ncg-5-discapacidad',
    estandar: 'NCG',
    ncgCode: '5.1.5',
    titulo: 'Personas con Discapacidad por Categoría Laboral',
    rows: [
      { codigo: 'NCG-DISC-ALTA-H',  nombre: 'Alta gerencia — Con discapacidad H',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-ALTA-M',  nombre: 'Alta gerencia — Con discapacidad M',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-GER-H',   nombre: 'Gerencia — Con discapacidad H',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-GER-M',   nombre: 'Gerencia — Con discapacidad M',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-JEF-H',   nombre: 'Jefatura — Con discapacidad H',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-JEF-M',   nombre: 'Jefatura — Con discapacidad M',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-OPE-H',   nombre: 'Operario — Con discapacidad H',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-OPE-M',   nombre: 'Operario — Con discapacidad M',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-ADM-H',   nombre: 'Administrativo — Con discapacidad H',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-ADM-M',   nombre: 'Administrativo — Con discapacidad M',  unidad: 'personas', value_kind: 'num' },
    ],
  },
  {
    id: 'ncg-5-contrato',
    estandar: 'NCG',
    ncgCode: '5.2.1',
    titulo: 'Modalidades de Contrato / Vínculo Laboral',
    rows: [
      { codigo: 'NCG-CONT-INDEF-H', nombre: 'Contrato indefinido — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-INDEF-M', nombre: 'Contrato indefinido — Mujeres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-PLAZO-H', nombre: 'Contrato a plazo fijo — Hombres',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-PLAZO-M', nombre: 'Contrato a plazo fijo — Mujeres',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-OBRA-H',  nombre: 'Contrato por obra o faena — Hombres', unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-OBRA-M',  nombre: 'Contrato por obra o faena — Mujeres', unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-HON-H',   nombre: 'Honorarios — Hombres',                 unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-HON-M',   nombre: 'Honorarios — Mujeres',                 unidad: 'personas', value_kind: 'num' },
    ],
  },
  {
    id: 'ncg-5-brecha',
    estandar: 'NCG',
    ncgCode: '5.4.2',
    titulo: 'Brecha Salarial por Categoría Laboral',
    note: 'Valores en porcentaje (%)',
    rows: [
      { codigo: 'NCG-BRECHA-ALTA',   nombre: 'Alta gerencia — Media de brecha salarial',    unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-GER',    nombre: 'Gerencia — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-JEF',    nombre: 'Jefatura — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-OPE',    nombre: 'Operario — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-VEN',    nombre: 'Fuerza de Venta — Media de brecha salarial',   unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-ADM',    nombre: 'Administrativo — Media de brecha salarial',    unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-AUX',    nombre: 'Auxiliar — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-OPRO',   nombre: 'Otros profesionales — Media de brecha',        unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-OTEC',   nombre: 'Otros técnicos — Media de brecha',             unidad: '%', value_kind: 'num' },
    ],
  },
  {
    id: 'ncg-5-seguridad',
    estandar: 'NCG',
    ncgCode: '5.3',
    titulo: 'Indicadores de Seguridad Laboral',
    rows: [
      { codigo: 'NCG-SEG-TRAB-PROM',   nombre: 'Promedio mensual de trabajadores contratados',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-SEG-ACC',          nombre: 'Número de accidentes de trabajo',                     unidad: 'nº',       value_kind: 'num' },
      { codigo: 'NCG-SEG-FAT',          nombre: 'Número de fatalidades por accidentes',                unidad: 'nº',       value_kind: 'num' },
      { codigo: 'NCG-SEG-ENF',          nombre: 'Número de enfermedades profesionales',                unidad: 'nº',       value_kind: 'num' },
      { codigo: 'NCG-SEG-DIAS',         nombre: 'Días perdidos por accidentes de trabajo',             unidad: 'días',     value_kind: 'num' },
      { codigo: 'NCG-SEG-TASA-ACC',     nombre: 'Tasa de accidentabilidad (%)',                        unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-SEG-TASA-FAT',     nombre: 'Tasa de fatalidad (por 100.000)',                     unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-SEG-TASA-ENF',     nombre: 'Tasa de enfermedades profesionales (%)',              unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-SEG-PROM-DIAS',    nombre: 'Promedio de días perdidos por accidente',             unidad: 'días',     value_kind: 'num' },
    ],
  },
]

// ── Índice combinado ─────────────────────────────────────────────────────────

export const VF2_TEMPLATES: Vf2Template[] = [...VF2_GRI_TEMPLATES, ...VF2_NCG_TEMPLATES]

/**
 * Encuentra el template que mejor coincide con un código GRI extraído del nombre
 * del item (ej. "305-1 Emisiones directas..." → "305-1").
 */
export function findTemplateByGriCode(code: string): Vf2Template | null {
  return VF2_GRI_TEMPLATES.find(t => t.griCode === code) ?? null
}

/**
 * Encuentra el template que mejor coincide con un código NCG extraído del nombre
 * del item (ej. "5.3 Seguridad laboral" → "5.3").
 */
export function findTemplateByNcgCode(code: string): Vf2Template | null {
  return VF2_NCG_TEMPLATES.find(t => t.ncgCode === code) ?? null
}

/**
 * Extrae el código numérico del inicio de un nombre de item GRI/NCG.
 * "305-1 Emisiones..." → "305-1"
 * "5.3 Seguridad..." → "5.3"
 */
export function extractItemCode(itemName: string): string | null {
  const match = itemName.match(/^(\d[\d\-.]*)/)
  return match ? match[1] : null
}
