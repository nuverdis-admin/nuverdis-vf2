// lib/vf2/templates/index.ts
// Plantillas predefinidas de grids vf2_ para estándares GRI y NCG.
// Cada "row" = una métrica de la empresa. Columnas = años (el usuario elige el período).
// Para tablas con filas dinámicas (países, categorías) se definen métricas de los
// tipos de medición (Mujeres/Hombres, etc.) que el usuario asigna a cada fila.
// Los códigos de métrica son globales por empresa: ON CONFLICT DO NOTHING en BD.

export interface Vf2TemplateRow {
  codigo: string
  nombre: string
  unidad?: string
  value_kind: 'num' | 'text'
}

export interface Vf2Template {
  id: string
  estandar: 'GRI' | 'NCG'
  griCode?: string   // ej. '305-1' — debe coincidir con el inicio de jerarquia_2_nombre
  ncgCode?: string   // ej. '5.3'
  titulo: string
  rows: Vf2TemplateRow[]
  note?: string
}

// ── GRI ──────────────────────────────────────────────────────────────────────

const VF2_GRI_TEMPLATES: Vf2Template[] = [

  // ─── GRI 2 — Información general ────────────────────────────────────────────

  {
    id: 'gri-2-7',
    estandar: 'GRI',
    griCode: '2-7',
    titulo: 'Empleados por país y tipo de contrato',
    note: 'Filas dinámicas: agregar una fila por cada combinación país × género',
    rows: [
      { codigo: 'GRI-2-7-M-INDEF',   nombre: 'Mujeres — Contrato indefinido',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-M-PLAZO',   nombre: 'Mujeres — Contrato plazo fijo',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-M-HON',     nombre: 'Mujeres — Honorarios',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-H-INDEF',   nombre: 'Hombres — Contrato indefinido',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-H-PLAZO',   nombre: 'Hombres — Contrato plazo fijo',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-H-HON',     nombre: 'Hombres — Honorarios',              unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-M-JORNADA', nombre: 'Mujeres — Jornada ordinaria',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-M-PARCIAL', nombre: 'Mujeres — Tiempo parcial',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-H-JORNADA', nombre: 'Hombres — Jornada ordinaria',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-2-7-H-PARCIAL', nombre: 'Hombres — Tiempo parcial',          unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── GRI 102-3 — Movimiento de empleados ────────────────────────────────────

  {
    id: 'gri-102-3',
    estandar: 'GRI',
    griCode: '102-3',
    titulo: 'Movimiento de empleados (contrataciones, bajas, reubicaciones, formación)',
    rows: [
      { codigo: 'GRI-102-3-NC-M',   nombre: 'Nuevas contrataciones — Mujeres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-NC-H',   nombre: 'Nuevas contrataciones — Hombres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-BAJA-M', nombre: 'Empleados rescindidos — Mujeres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-BAJA-H', nombre: 'Empleados rescindidos — Hombres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-REUB-M', nombre: 'Empleados reubicados — Mujeres',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-REUB-H', nombre: 'Empleados reubicados — Hombres',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-FORM-M', nombre: 'Formación de empleados — Mujeres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-102-3-FORM-H', nombre: 'Formación de empleados — Hombres',   unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── GRI 205-2 — Corrupción ────────────────────────────────────────────────

  {
    id: 'gri-205-2',
    estandar: 'GRI',
    griCode: '205-2',
    titulo: 'Incidentes de corrupción y acciones legales',
    rows: [
      { codigo: 'GRI-205-2-INC-CAT1',  nombre: 'Incidentes corrupción — Categoría 1', unidad: 'nº', value_kind: 'num' },
      { codigo: 'GRI-205-2-INC-CAT2',  nombre: 'Incidentes corrupción — Categoría 2', unidad: 'nº', value_kind: 'num' },
      { codigo: 'GRI-205-2-INC-CAT3',  nombre: 'Incidentes corrupción — Categoría 3', unidad: 'nº', value_kind: 'num' },
      { codigo: 'GRI-205-2-INC-PCT',   nombre: 'Incidentes corrupción — Porcentaje',  unidad: '%',  value_kind: 'num' },
      { codigo: 'GRI-205-2-LEG-CAT1',  nombre: 'Acciones legales — Categoría 1',      unidad: 'nº', value_kind: 'num' },
      { codigo: 'GRI-205-2-LEG-CAT2',  nombre: 'Acciones legales — Categoría 2',      unidad: 'nº', value_kind: 'num' },
      { codigo: 'GRI-205-2-LEG-CAT3',  nombre: 'Acciones legales — Categoría 3',      unidad: 'nº', value_kind: 'num' },
    ],
  },

  // ─── GRI 303-3 — Extracción de agua ─────────────────────────────────────────

  {
    id: 'gri-303-3',
    estandar: 'GRI',
    griCode: '303-3',
    titulo: 'Extracción de agua por fuente y calidad',
    rows: [
      { codigo: 'GRI-303-3-SUP-DULCE', nombre: 'Aguas superficiales — Agua dulce (TDS ≤ 1.000 mg/l)',  unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-SUP-OTRAS', nombre: 'Aguas superficiales — Otras aguas (TDS > 1.000 mg/l)', unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-SUB-DULCE', nombre: 'Aguas subterráneas — Agua dulce',                       unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-SUB-OTRAS', nombre: 'Aguas subterráneas — Otras aguas',                      unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-MAR-DULCE', nombre: 'Aguas marinas — Agua dulce',                            unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-MAR-OTRAS', nombre: 'Aguas marinas — Otras aguas',                           unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-TER-DULCE', nombre: 'Agua de terceros — Agua dulce',                         unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-TER-OTRAS', nombre: 'Agua de terceros — Otras aguas',                        unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-3-PROD',      nombre: 'Agua producida',                                         unidad: 'ML', value_kind: 'num' },
    ],
  },

  // ─── GRI 303-4 — Vertido de agua ────────────────────────────────────────────

  {
    id: 'gri-303-4',
    estandar: 'GRI',
    griCode: '303-4',
    titulo: 'Vertido de agua por destino y calidad',
    rows: [
      { codigo: 'GRI-303-4-SUP',        nombre: 'Vertido — Aguas superficiales',                                         unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-SUB',        nombre: 'Vertido — Aguas subterráneas',                                          unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-MAR',        nombre: 'Vertido — Aguas marinas',                                               unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-TER-TOT',    nombre: 'Vertido — Agua de terceros (total)',                                    unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-TER-TRAS',   nombre: 'Vertido — Agua de terceros trasvasada',                                 unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-C-DULCE',    nombre: 'Calidad — Agua dulce (TDS ≤ 1.000 mg/l)',                              unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-C-OTRAS',    nombre: 'Calidad — Otras aguas (TDS > 1.000 mg/l)',                             unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-CE-DULCE',   nombre: 'Zonas con estrés hídrico — Agua dulce',                                unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-4-CE-OTRAS',   nombre: 'Zonas con estrés hídrico — Otras aguas',                               unidad: 'ML', value_kind: 'num' },
    ],
  },

  // ─── GRI 303-5 — Consumo de agua ────────────────────────────────────────────

  {
    id: 'gri-303-5',
    estandar: 'GRI',
    griCode: '303-5',
    titulo: 'Consumo de agua por zona',
    note: 'Filas dinámicas: agregar una fila por zona o área',
    rows: [
      { codigo: 'GRI-303-5-CONSUMO',        nombre: 'Consumo de agua (total)',                  unidad: 'ML', value_kind: 'num' },
      { codigo: 'GRI-303-5-CONSUMO-ESTRES', nombre: 'Consumo de agua — zonas estrés hídrico',  unidad: 'ML', value_kind: 'num' },
    ],
  },

  // ─── GRI 305 — Emisiones GEI ────────────────────────────────────────────────

  {
    id: 'gri-305-1',
    estandar: 'GRI',
    griCode: '305-1',
    titulo: 'Emisiones GEI — Alcance 1',
    note: 'Emisiones directas por gas, en tCO₂e',
    rows: [
      { codigo: 'GRI-305-1-CO2', nombre: 'Dióxido de Carbono (CO₂)',         unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-CH4', nombre: 'Metano (CH₄)',                      unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-N2O', nombre: 'Óxido Nitroso (N₂O)',               unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-HFC', nombre: 'Hidrofluorocarbonos (HFC)',         unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-PFC', nombre: 'Perfluorocarbonos (PFC)',           unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-SF6', nombre: 'Hexafluoruro de Azufre (SF₆)',     unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-1-NF3', nombre: 'Trifluoruro de Nitrógeno (NF₃)',   unidad: 'tCO₂e', value_kind: 'num' },
    ],
  },

  {
    id: 'gri-305-2',
    estandar: 'GRI',
    griCode: '305-2',
    titulo: 'Emisiones GEI — Alcance 2',
    note: 'Emisiones indirectas por energía, en tCO₂e',
    rows: [
      { codigo: 'GRI-305-2-CO2', nombre: 'Dióxido de Carbono (CO₂)',  unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-2-CH4', nombre: 'Metano (CH₄)',               unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-2-N2O', nombre: 'Óxido Nitroso (N₂O)',        unidad: 'tCO₂e', value_kind: 'num' },
    ],
  },

  {
    id: 'gri-305-3',
    estandar: 'GRI',
    griCode: '305-3',
    titulo: 'Emisiones GEI — Alcance 3',
    note: '15 categorías de cadena de valor, en tCO₂e',
    rows: [
      { codigo: 'GRI-305-3-C01', nombre: '1. Bienes y servicios comprados',                  unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C02', nombre: '2. Bienes de capital',                              unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C03', nombre: '3. Combustibles y energía',                         unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C04', nombre: '4. Transporte y distribución (upstream)',           unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C05', nombre: '5. Residuos generados en operaciones',             unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C06', nombre: '6. Viajes de negocios',                             unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C07', nombre: '7. Desplazamiento de empleados (commuting)',        unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C08', nombre: '8. Activos arrendados (upstream)',                  unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C09', nombre: '9. Transporte y distribución (downstream)',         unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C10', nombre: '10. Procesamiento de productos vendidos',          unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C11', nombre: '11. Uso de productos vendidos',                    unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C12', nombre: '12. Fin de vida de productos vendidos',            unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C13', nombre: '13. Activos arrendados (downstream)',              unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C14', nombre: '14. Franquicias',                                   unidad: 'tCO₂e', value_kind: 'num' },
      { codigo: 'GRI-305-3-C15', nombre: '15. Inversiones',                                   unidad: 'tCO₂e', value_kind: 'num' },
    ],
  },

  // ─── GRI 306 — Residuos ─────────────────────────────────────────────────────

  {
    id: 'gri-306-3',
    estandar: 'GRI',
    griCode: '306-3',
    titulo: 'Residuos generados por composición',
    note: 'Filas dinámicas: agregar una fila por tipo de composición de residuo',
    rows: [
      { codigo: 'GRI-306-3-RES1', nombre: 'Composición residuos 1', unidad: 'ton', value_kind: 'num' },
      { codigo: 'GRI-306-3-RES2', nombre: 'Composición residuos 2', unidad: 'ton', value_kind: 'num' },
      { codigo: 'GRI-306-3-RES3', nombre: 'Composición residuos 3', unidad: 'ton', value_kind: 'num' },
    ],
  },

  {
    id: 'gri-306-4',
    estandar: 'GRI',
    griCode: '306-4',
    titulo: 'Residuos no destinados a eliminación',
    note: 'Filas dinámicas: agregar una fila por tipo de composición',
    rows: [
      { codigo: 'GRI-306-4-RES1', nombre: 'Residuos no eliminados — Composición 1', unidad: 'ton', value_kind: 'num' },
      { codigo: 'GRI-306-4-RES2', nombre: 'Residuos no eliminados — Composición 2', unidad: 'ton', value_kind: 'num' },
      { codigo: 'GRI-306-4-RES3', nombre: 'Residuos no eliminados — Composición 3', unidad: 'ton', value_kind: 'num' },
    ],
  },

  {
    id: 'gri-306-5',
    estandar: 'GRI',
    griCode: '306-5',
    titulo: 'Residuos destinados a eliminación',
    note: 'Filas dinámicas: agregar una fila por tipo de composición',
    rows: [
      { codigo: 'GRI-306-5-RES1', nombre: 'Residuos eliminados — Composición 1', unidad: 'ton', value_kind: 'num' },
      { codigo: 'GRI-306-5-RES2', nombre: 'Residuos eliminados — Composición 2', unidad: 'ton', value_kind: 'num' },
      { codigo: 'GRI-306-5-RES3', nombre: 'Residuos eliminados — Composición 3', unidad: 'ton', value_kind: 'num' },
    ],
  },

  // ─── GRI 401-1 — Nuevas contrataciones y rotación ───────────────────────────

  {
    id: 'gri-401-1',
    estandar: 'GRI',
    griCode: '401-1',
    titulo: 'Nuevas contrataciones y rotación de personal por edad y género',
    rows: [
      { codigo: 'GRI-401-1-NC-M-30M',  nombre: 'Nuevas contrataciones — Mujeres < 30 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-H-30M',  nombre: 'Nuevas contrataciones — Hombres < 30 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-M-3050', nombre: 'Nuevas contrataciones — Mujeres 30-50 años',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-H-3050', nombre: 'Nuevas contrataciones — Hombres 30-50 años',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-M-50P',  nombre: 'Nuevas contrataciones — Mujeres > 50 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-NC-H-50P',  nombre: 'Nuevas contrataciones — Hombres > 50 años',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-ROT-M-30M', nombre: 'Rotación — Mujeres < 30 años',                unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-ROT-H-30M', nombre: 'Rotación — Hombres < 30 años',                unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-ROT-M-3050',nombre: 'Rotación — Mujeres 30-50 años',               unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-401-1-ROT-H-3050',nombre: 'Rotación — Hombres 30-50 años',               unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── GRI 404-1 — Formación ──────────────────────────────────────────────────

  {
    id: 'gri-404-1',
    estandar: 'GRI',
    griCode: '404-1',
    titulo: 'Horas de formación por categoría y género',
    note: 'Filas dinámicas: agregar una fila por categoría laboral',
    rows: [
      { codigo: 'GRI-404-1-M-C1', nombre: 'Horas formación — Mujeres Categoría 1', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-H-C1', nombre: 'Horas formación — Hombres Categoría 1', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-M-C2', nombre: 'Horas formación — Mujeres Categoría 2', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-H-C2', nombre: 'Horas formación — Hombres Categoría 2', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-M-C3', nombre: 'Horas formación — Mujeres Categoría 3', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-H-C3', nombre: 'Horas formación — Hombres Categoría 3', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-M-C4', nombre: 'Horas formación — Mujeres Categoría 4', unidad: 'horas', value_kind: 'num' },
      { codigo: 'GRI-404-1-H-C4', nombre: 'Horas formación — Hombres Categoría 4', unidad: 'horas', value_kind: 'num' },
    ],
  },

  // ─── GRI 405-1 — Diversidad ─────────────────────────────────────────────────

  {
    id: 'gri-405-1',
    estandar: 'GRI',
    griCode: '405-1',
    titulo: 'Diversidad de órganos de gobierno y empleados por edad y género',
    rows: [
      { codigo: 'GRI-405-1-GOB-M-30M',  nombre: 'Directores — Mujeres < 30 años',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-H-30M',  nombre: 'Directores — Hombres < 30 años',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-M-3050', nombre: 'Directores — Mujeres 30-50 años',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-H-3050', nombre: 'Directores — Hombres 30-50 años',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-M-50P',  nombre: 'Directores — Mujeres > 50 años',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-GOB-H-50P',  nombre: 'Directores — Hombres > 50 años',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-EMP-M-30M',  nombre: 'Empleados — Mujeres < 30 años',           unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-EMP-H-30M',  nombre: 'Empleados — Hombres < 30 años',           unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-EMP-M-3050', nombre: 'Empleados — Mujeres 30-50 años',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-EMP-H-3050', nombre: 'Empleados — Hombres 30-50 años',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-EMP-M-50P',  nombre: 'Empleados — Mujeres > 50 años',           unidad: 'personas', value_kind: 'num' },
      { codigo: 'GRI-405-1-EMP-H-50P',  nombre: 'Empleados — Hombres > 50 años',           unidad: 'personas', value_kind: 'num' },
    ],
  },
]

// ── NCG ──────────────────────────────────────────────────────────────────────

const VF2_NCG_TEMPLATES: Vf2Template[] = [

  // ─── NCG Sección 5 — Dotación general ──────────────────────────────────────

  {
    id: 'ncg-5-dotacion',
    estandar: 'NCG',
    ncgCode: '5',
    titulo: 'Dotación por Categoría Laboral y Género (NCG Sec. 5)',
    rows: [
      { codigo: 'NCG-5-ALTA-H',  nombre: 'Alta gerencia — Hombres',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-ALTA-M',  nombre: 'Alta gerencia — Mujeres',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-GER-H',   nombre: 'Gerencia — Hombres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-GER-M',   nombre: 'Gerencia — Mujeres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-JEF-H',   nombre: 'Jefatura — Hombres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-JEF-M',   nombre: 'Jefatura — Mujeres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPE-H',   nombre: 'Operario — Hombres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPE-M',   nombre: 'Operario — Mujeres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-VEN-H',   nombre: 'Fuerza de Venta — Hombres',      unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-VEN-M',   nombre: 'Fuerza de Venta — Mujeres',      unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-ADM-H',   nombre: 'Administrativo — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-ADM-M',   nombre: 'Administrativo — Mujeres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-AUX-H',   nombre: 'Auxiliar — Hombres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-AUX-M',   nombre: 'Auxiliar — Mujeres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPRO-H',  nombre: 'Otros profesionales — Hombres',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OPRO-M',  nombre: 'Otros profesionales — Mujeres',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OTEC-H',  nombre: 'Otros técnicos — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-5-OTEC-M',  nombre: 'Otros técnicos — Mujeres',       unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.1.1 — Directorio ─────────────────────────────────────────────────

  {
    id: 'ncg-5-directorio',
    estandar: 'NCG',
    ncgCode: '5.1.1',
    titulo: 'Directorio — Titulares y Suplentes por Género',
    rows: [
      { codigo: 'NCG-DIR-TIT-H',  nombre: 'Titulares — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-TIT-M',  nombre: 'Titulares — Mujeres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-SUP-H',  nombre: 'Suplentes — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-SUP-M',  nombre: 'Suplentes — Mujeres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-NAC-CH', nombre: 'Nacionalidad chilena',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-NAC-EX', nombre: 'Nacionalidad extranjera',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-AGE-30M',nombre: 'Menores de 30 años',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-AGE-3040',nombre: 'Entre 30 y 40 años',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-AGE-4150',nombre: 'Entre 41 y 50 años',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-AGE-5160',nombre: 'Entre 51 y 60 años',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-AGE-6170',nombre: 'Entre 61 y 70 años',        unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-AGE-70P', nombre: 'Más de 70 años',            unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-DISC-SI', nombre: 'Con discapacidad',           unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DIR-DISC-NO', nombre: 'Sin discapacidad',           unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.1.2 — Diversidad por nacionalidad ────────────────────────────────

  {
    id: 'ncg-5-1-2-nacionalidad',
    estandar: 'NCG',
    ncgCode: '5.1.2',
    titulo: 'Diversidad por Categoría y Nacionalidad (NCG 5.1.2)',
    rows: [
      { codigo: 'NCG-NAC-ALTA-CH-H',   nombre: 'Alta gerencia — Chilena — Hombres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-ALTA-CH-M',   nombre: 'Alta gerencia — Chilena — Mujeres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-ALTA-EX-H',   nombre: 'Alta gerencia — Extranjera — Hombres',unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-ALTA-EX-M',   nombre: 'Alta gerencia — Extranjera — Mujeres',unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-GER-CH-H',    nombre: 'Gerencia — Chilena — Hombres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-GER-CH-M',    nombre: 'Gerencia — Chilena — Mujeres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-GER-EX-H',    nombre: 'Gerencia — Extranjera — Hombres',      unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-GER-EX-M',    nombre: 'Gerencia — Extranjera — Mujeres',      unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-OPE-CH-H',    nombre: 'Operario — Chilena — Hombres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-NAC-OPE-CH-M',    nombre: 'Operario — Chilena — Mujeres',         unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.1.3 — Diversidad por edad ────────────────────────────────────────

  {
    id: 'ncg-5-1-3-edad',
    estandar: 'NCG',
    ncgCode: '5.1.3',
    titulo: 'Diversidad por Categoría y Rango de Edad (NCG 5.1.3)',
    rows: [
      { codigo: 'NCG-EDAD-ALTA-30M-H',   nombre: 'Alta gerencia — < 30 años — Hombres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-ALTA-30M-M',   nombre: 'Alta gerencia — < 30 años — Mujeres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-ALTA-3040-H',  nombre: 'Alta gerencia — 30-40 años — Hombres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-ALTA-3040-M',  nombre: 'Alta gerencia — 30-40 años — Mujeres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-GER-30M-H',    nombre: 'Gerencia — < 30 años — Hombres',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-GER-30M-M',    nombre: 'Gerencia — < 30 años — Mujeres',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-GER-3040-H',   nombre: 'Gerencia — 30-40 años — Hombres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-GER-3040-M',   nombre: 'Gerencia — 30-40 años — Mujeres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-OPE-30M-H',    nombre: 'Operario — < 30 años — Hombres',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-EDAD-OPE-30M-M',    nombre: 'Operario — < 30 años — Mujeres',          unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.1.4 — Diversidad por antigüedad ──────────────────────────────────

  {
    id: 'ncg-5-1-4-antiguedad',
    estandar: 'NCG',
    ncgCode: '5.1.4',
    titulo: 'Diversidad por Categoría y Antigüedad (NCG 5.1.4)',
    rows: [
      { codigo: 'NCG-ANT-ALTA-3M-H',   nombre: 'Alta gerencia — < 3 años — Hombres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-ALTA-3M-M',   nombre: 'Alta gerencia — < 3 años — Mujeres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-ALTA-36-H',   nombre: 'Alta gerencia — 3-6 años — Hombres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-ALTA-36-M',   nombre: 'Alta gerencia — 3-6 años — Mujeres',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-ALTA-12P-H',  nombre: 'Alta gerencia — > 12 años — Hombres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-ALTA-12P-M',  nombre: 'Alta gerencia — > 12 años — Mujeres',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-GER-3M-H',    nombre: 'Gerencia — < 3 años — Hombres',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-GER-3M-M',    nombre: 'Gerencia — < 3 años — Mujeres',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-OPE-3M-H',    nombre: 'Operario — < 3 años — Hombres',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-ANT-OPE-3M-M',    nombre: 'Operario — < 3 años — Mujeres',          unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.1.5 — Discapacidad ────────────────────────────────────────────────

  {
    id: 'ncg-5-discapacidad',
    estandar: 'NCG',
    ncgCode: '5.1.5',
    titulo: 'Personas con Discapacidad por Categoría (NCG 5.1.5)',
    rows: [
      { codigo: 'NCG-DISC-ALTA-H',  nombre: 'Alta gerencia — Con discapacidad H',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-ALTA-M',  nombre: 'Alta gerencia — Con discapacidad M',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-GER-H',   nombre: 'Gerencia — Con discapacidad H',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-GER-M',   nombre: 'Gerencia — Con discapacidad M',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-JEF-H',   nombre: 'Jefatura — Con discapacidad H',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-JEF-M',   nombre: 'Jefatura — Con discapacidad M',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-OPE-H',   nombre: 'Operario — Con discapacidad H',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-OPE-M',   nombre: 'Operario — Con discapacidad M',          unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-VEN-H',   nombre: 'Fuerza de Venta — Con discapacidad H',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-VEN-M',   nombre: 'Fuerza de Venta — Con discapacidad M',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-ADM-H',   nombre: 'Administrativo — Con discapacidad H',    unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-DISC-ADM-M',   nombre: 'Administrativo — Con discapacidad M',    unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.2.1 — Modalidades de contrato ────────────────────────────────────

  {
    id: 'ncg-5-contrato',
    estandar: 'NCG',
    ncgCode: '5.2.1',
    titulo: 'Modalidades de Contrato / Vínculo Laboral (NCG 5.2.1)',
    rows: [
      { codigo: 'NCG-CONT-INDEF-H', nombre: 'Contrato indefinido — Hombres (nº)',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-INDEF-M', nombre: 'Contrato indefinido — Mujeres (nº)',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-PLAZO-H', nombre: 'Contrato a plazo fijo — Hombres (nº)',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-PLAZO-M', nombre: 'Contrato a plazo fijo — Mujeres (nº)',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-OBRA-H',  nombre: 'Contrato por obra o faena — Hombres (nº)', unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-OBRA-M',  nombre: 'Contrato por obra o faena — Mujeres (nº)', unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-HON-H',   nombre: 'Honorarios — Hombres (nº)',                unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-HON-M',   nombre: 'Honorarios — Mujeres (nº)',                unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CONT-INDEF-PCT-H', nombre: 'Contrato indefinido — Hombres (%)',    unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-CONT-INDEF-PCT-M', nombre: 'Contrato indefinido — Mujeres (%)',    unidad: '%',        value_kind: 'num' },
    ],
  },

  // ─── NCG 5.2.2 — Modalidades de jornada ─────────────────────────────────────

  {
    id: 'ncg-5-jornada',
    estandar: 'NCG',
    ncgCode: '5.2.2',
    titulo: 'Modalidades de Jornada / Pactos de Adaptabilidad (NCG 5.2.2)',
    rows: [
      { codigo: 'NCG-JOR-ORD-H',   nombre: 'Jornada ordinaria — Hombres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-ORD-M',   nombre: 'Jornada ordinaria — Mujeres',         unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-PARC-H',  nombre: 'Jornada a tiempo parcial — Hombres',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-PARC-M',  nombre: 'Jornada a tiempo parcial — Mujeres',  unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-TELE-H',  nombre: 'Teletrabajo parcial — Hombres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-TELE-M',  nombre: 'Teletrabajo parcial — Mujeres',       unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-TELEC-H', nombre: 'Teletrabajo completo — Hombres',      unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-JOR-TELEC-M', nombre: 'Teletrabajo completo — Mujeres',      unidad: 'personas', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.3 — Seguridad laboral ─────────────────────────────────────────────

  {
    id: 'ncg-5-seguridad',
    estandar: 'NCG',
    ncgCode: '5.3',
    titulo: 'Indicadores de Seguridad Laboral (NCG 5.3)',
    rows: [
      { codigo: 'NCG-SEG-TRAB-PROM',   nombre: 'Promedio mensual de trabajadores contratados',   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-SEG-ACC',          nombre: 'Número de accidentes de trabajo',                unidad: 'nº',       value_kind: 'num' },
      { codigo: 'NCG-SEG-FAT',          nombre: 'Número de fatalidades por accidentes',           unidad: 'nº',       value_kind: 'num' },
      { codigo: 'NCG-SEG-ENF',          nombre: 'Número de enfermedades profesionales',           unidad: 'nº',       value_kind: 'num' },
      { codigo: 'NCG-SEG-DIAS',         nombre: 'Días perdidos por accidentes de trabajo',        unidad: 'días',     value_kind: 'num' },
      { codigo: 'NCG-SEG-TASA-ACC',     nombre: 'Tasa de accidentabilidad',                       unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-SEG-TASA-FAT',     nombre: 'Tasa de fatalidad (por 100.000)',                unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-SEG-TASA-ENF',     nombre: 'Tasa de enfermedades profesionales',             unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-SEG-PROM-DIAS',    nombre: 'Promedio de días perdidos por accidente',        unidad: 'días',     value_kind: 'num' },
    ],
  },

  // ─── NCG 5.4.2 — Brecha salarial ──────────────────────────────────────────────

  {
    id: 'ncg-5-brecha',
    estandar: 'NCG',
    ncgCode: '5.4.2',
    titulo: 'Brecha Salarial por Categoría Laboral (NCG 5.4.2)',
    rows: [
      { codigo: 'NCG-BRECHA-ALTA-MED',   nombre: 'Alta gerencia — Media de brecha salarial',    unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-ALTA-MEDN',  nombre: 'Alta gerencia — Mediana de brecha salarial',  unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-GER-MED',    nombre: 'Gerencia — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-GER-MEDN',   nombre: 'Gerencia — Mediana de brecha salarial',        unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-JEF-MED',    nombre: 'Jefatura — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-JEF-MEDN',   nombre: 'Jefatura — Mediana de brecha salarial',        unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-OPE-MED',    nombre: 'Operario — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-OPE-MEDN',   nombre: 'Operario — Mediana de brecha salarial',        unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-VEN-MED',    nombre: 'Fuerza de Venta — Media de brecha salarial',   unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-ADM-MED',    nombre: 'Administrativo — Media de brecha salarial',    unidad: '%', value_kind: 'num' },
      { codigo: 'NCG-BRECHA-AUX-MED',    nombre: 'Auxiliar — Media de brecha salarial',          unidad: '%', value_kind: 'num' },
    ],
  },

  // ─── NCG 5.5.1 — Capacitación ────────────────────────────────────────────────

  {
    id: 'ncg-5-capacitacion',
    estandar: 'NCG',
    ncgCode: '5.5.1',
    titulo: 'Capacitación por Categoría y Género (NCG 5.5.1)',
    rows: [
      { codigo: 'NCG-CAP-ALTA-H-DOT',  nombre: 'Alta gerencia — Dotación Hombres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-ALTA-H-CAP',  nombre: 'Alta gerencia — Nº Personal capacitado H',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-ALTA-M-DOT',  nombre: 'Alta gerencia — Dotación Mujeres',             unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-ALTA-M-CAP',  nombre: 'Alta gerencia — Nº Personal capacitado M',     unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-ALTA-COB',    nombre: 'Alta gerencia — % Cobertura capacitación',     unidad: '%',        value_kind: 'num' },
      { codigo: 'NCG-CAP-GER-H-DOT',   nombre: 'Gerencia — Dotación Hombres',                   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-GER-H-CAP',   nombre: 'Gerencia — Nº Personal capacitado H',           unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-GER-M-DOT',   nombre: 'Gerencia — Dotación Mujeres',                   unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-GER-M-CAP',   nombre: 'Gerencia — Nº Personal capacitado M',           unidad: 'personas', value_kind: 'num' },
      { codigo: 'NCG-CAP-GER-COB',     nombre: 'Gerencia — % Cobertura capacitación',           unidad: '%',        value_kind: 'num' },
    ],
  },

  // ─── NCG 5.5.2 — Horas de formación ─────────────────────────────────────────

  {
    id: 'ncg-5-horas-formacion',
    estandar: 'NCG',
    ncgCode: '5.5.2',
    titulo: 'Horas de Formación por Categoría (NCG 5.5.2)',
    rows: [
      { codigo: 'NCG-HOR-ALTA-H',    nombre: 'Alta gerencia — Total horas H',      unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-ALTA-M',    nombre: 'Alta gerencia — Total horas M',      unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-ALTA-PROM', nombre: 'Alta gerencia — Promedio horas',     unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-GER-H',     nombre: 'Gerencia — Total horas H',            unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-GER-M',     nombre: 'Gerencia — Total horas M',            unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-GER-PROM',  nombre: 'Gerencia — Promedio horas',           unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-JEF-H',     nombre: 'Jefatura — Total horas H',            unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-JEF-M',     nombre: 'Jefatura — Total horas M',            unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-JEF-PROM',  nombre: 'Jefatura — Promedio horas',           unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-OPE-H',     nombre: 'Operario — Total horas H',            unidad: 'horas', value_kind: 'num' },
      { codigo: 'NCG-HOR-OPE-M',     nombre: 'Operario — Total horas M',            unidad: 'horas', value_kind: 'num' },
    ],
  },
]

// ── Índice combinado ─────────────────────────────────────────────────────────

export const VF2_TEMPLATES: Vf2Template[] = [...VF2_GRI_TEMPLATES, ...VF2_NCG_TEMPLATES]

export function findTemplateByGriCode(code: string): Vf2Template | null {
  return VF2_GRI_TEMPLATES.find(t => t.griCode === code) ?? null
}

export function findTemplateByNcgCode(code: string): Vf2Template | null {
  return VF2_NCG_TEMPLATES.find(t => t.ncgCode === code) ?? null
}

/**
 * Extrae el código numérico del inicio de un nombre de ítem.
 * "305-1 Emisiones..." → "305-1"   |   "5.3 Seguridad..." → "5.3"   |   "2-7 Empleados..." → "2-7"
 */
export function extractItemCode(itemName: string): string | null {
  const match = itemName.match(/^(\d[\d\-.]*)/)
  return match ? match[1] : null
}

/**
 * Mapeo del identificador de tabla de vf1 (columna `tabla` de
 * `*_items_requerimientos_reporte`) → id de plantilla vf2. Esta es la fuente de
 * verdad para cargar plantillas: la misma columna `tabla` que marca la "(T)" en
 * el modal de crear tarea. Un mismo indicador puede tener varias sub-tablas
 * (ej. extracción de agua = T8/T9/T10) que apuntan a la misma plantilla.
 */
const TABLA_CODE_TO_TEMPLATE_ID: Record<string, string> = {
  // GRI
  T1: 'gri-2-7', T2: 'gri-2-7',
  T22: 'gri-102-3', T23: 'gri-102-3', T24: 'gri-102-3', T25: 'gri-102-3',
  T7: 'gri-205-2', T20: 'gri-205-2', T21: 'gri-205-2',
  T8: 'gri-303-3', T9: 'gri-303-3', T10: 'gri-303-3',
  T11: 'gri-303-4', T12: 'gri-303-4', T13: 'gri-303-4',
  T14: 'gri-303-5', T14b: 'gri-303-5',
  T26: 'gri-305-1', T27: 'gri-305-2', T28: 'gri-305-3',
  T15: 'gri-306-3', T16: 'gri-306-4', T17: 'gri-306-5',
  T18: 'gri-401-1', T19: 'gri-401-1',
  T6: 'gri-404-1',
  T4: 'gri-405-1', T5: 'gri-405-1',
  // NCG
  'NCG-T1-T2': 'ncg-5-directorio',
  'NCG-T3': 'ncg-5-dotacion',
  'NCG-T4': 'ncg-5-1-2-nacionalidad',
  'NCG-T5': 'ncg-5-1-3-edad',
  'NCG-T6': 'ncg-5-1-4-antiguedad',
  'NCG-T7': 'ncg-5-discapacidad',
  'NCG-T8': 'ncg-5-contrato',
  'NCG-T9': 'ncg-5-jornada',
  'NCG-T10': 'ncg-5-brecha',
  'NCG-T11': 'ncg-5-seguridad',
  'NCG-T12': 'ncg-5-capacitacion',
  'NCG-T13': 'ncg-5-horas-formacion',
}

/**
 * Encuentra la plantilla vf2 a partir de uno o varios códigos de tabla vf1.
 * Devuelve la primera coincidencia (un ítem = un indicador = una plantilla).
 */
export function findTemplateByTablaCodes(codes: string[]): Vf2Template | null {
  for (const code of codes) {
    const id = TABLA_CODE_TO_TEMPLATE_ID[code]
    if (id) {
      const tpl = VF2_TEMPLATES.find(t => t.id === id)
      if (tpl) return tpl
    }
  }
  return null
}
