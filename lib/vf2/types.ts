// lib/vf2/types.ts — Tipos TypeScript para el módulo Fact Graph (vf2_)

export type Vf2ValueKind = 'num' | 'text' | 'json'
export type Vf2PeriodoTipo = 'anual' | 'semestral' | 'trimestral' | 'mensual' | 'custom'
export type Vf2RevisionStatus = 'draft' | 'in_review' | 'approved' | 'superseded' | 'rejected'
export type Vf2SourceKind = 'manual' | 'import' | 'formula' | 'api'
export type Vf2BindingMode = 'live' | 'pinned'
export type Vf2ConsumerKind = 'grid_cell' | 'doc_node' | 'chart_series'
export type Vf2TareaEstado =
  | 'borrador'
  | 'en_preparacion'
  | 'en_revision'
  | 'en_aprobacion'
  | 'aprobada'
  | 'devuelta'
export type Vf2TareaRol = 'preparer' | 'reviewer' | 'approver'
export type Vf2CellKind = 'input' | 'formula' | 'fact_ref' | 'locked'
export type Vf2EstadoCelda = 'vacio' | 'borrador' | 'aprobada'
export type Vf2ComentarioTipo = 'general' | 'varianza' | 'devolucion'
export type Vf2Estandar = 'GRI' | 'NCG' | 'SASB'

// ─── Entidades principales ────────────────────────────────────────────────────

export interface Vf2Metric {
  metric_id: number
  empresa_id: number
  public_id: string
  codigo: string
  nombre: string
  descripcion: string | null
  value_kind: Vf2ValueKind
  unidad: string | null
  data_type_meta: Record<string, unknown>
  gri_item_id: number | null
  gri_requerimiento_id: number | null
  ncg_item_id: number | null
  ncg_requerimiento_id: number | null
  gri_tabla_template: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Vf2Fact {
  fact_id: string
  empresa_id: number
  public_id: string
  proyecto_id: number
  metric_id: number
  periodo_inicio: string
  periodo_fin: string
  periodo_tipo: Vf2PeriodoTipo
  dims: Record<string, string>
  dims_hash: string
  current_revision_id: string | null
  created_at: string
  updated_at: string
}

export interface Vf2FactRevision {
  revision_id: string
  fact_id: string
  empresa_id: number
  status: Vf2RevisionStatus
  value_num: number | null
  value_text: string | null
  value_json: unknown | null
  unidad: string | null
  prev_revision_id: string | null
  is_current: boolean
  source_kind: Vf2SourceKind
  source_cell_id: number | null
  actor_uid: string
  nota: string | null
  created_at: string
}

export interface Vf2FactActual extends Vf2Fact {
  current_revision_id: string | null
  revision_status: Vf2RevisionStatus | null
  value_num: number | null
  value_text: string | null
  value_json: unknown | null
  unidad: string | null
  aprobado_por_uid: string | null
  aprobado_en: string | null
  nota: string | null
}

export interface Vf2Binding {
  binding_id: number
  empresa_id: number
  fact_id: string
  consumer_kind: Vf2ConsumerKind
  consumer_ref: Record<string, unknown>
  binding_mode: Vf2BindingMode
  pinned_revision_id: string | null
  created_at: string
  updated_at: string
}

export interface Vf2Coleccion {
  coleccion_id: number
  empresa_id: number
  public_id: string
  proyecto_id: number
  estandar: Vf2Estandar
  nombre: string
  descripcion: string | null
  estado: 'activa' | 'cerrada'
  created_at: string
  updated_at: string
}

export interface Vf2Tarea {
  tarea_id: number
  empresa_id: number
  public_id: string
  coleccion_id: number
  gri_item_id: number | null
  gri_requerimiento_id: number | null
  ncg_item_id: number | null
  ncg_requerimiento_id: number | null
  estado: Vf2TareaEstado
  version: number
  titulo: string
  instruccion: string | null
  fecha_limite: string | null
  created_at: string
  updated_at: string
}

export interface Vf2TareaRolRow {
  tarea_rol_id: number
  empresa_id: number
  tarea_id: number
  rol: Vf2TareaRol
  asignado_user_id: string | null
  asignado_equipo_id: number | null
  activo: boolean
  created_at: string
}

export interface Vf2Sheet {
  sheet_id: number
  empresa_id: number
  public_id: string
  tarea_id: number
  template_id: string | null
  yjs_doc_name: string
  orden: number
  nombre: string
  created_at: string
  updated_at: string
}

export interface Vf2Cell {
  cell_id: number
  empresa_id: number
  sheet_id: number
  row_key: string
  col_key: string
  cell_kind: Vf2CellKind
  value_num: number | null
  value_text: string | null
  value_json: unknown | null
  fact_ref_id: string | null
  formula: string | null
  validation: Vf2CellValidation
  estado_celda: Vf2EstadoCelda
  created_at: string
  updated_at: string
}

export interface Vf2CellValidation {
  required?: boolean
  min?: number
  max?: number
  unidad?: string
  dims?: Record<string, string>
  periodo_inicio?: string
  periodo_fin?: string
  metric_id?: number
}

export interface Vf2Evidencia {
  evidencia_id: number
  empresa_id: number
  public_id: string
  tarea_id: number
  storage_path: string
  nombre_archivo: string
  mime_type: string | null
  tamano_bytes: number | null
  subido_por_uid: string
  eliminado: boolean
  created_at: string
}

export interface Vf2Comentario {
  comentario_id: number
  empresa_id: number
  tarea_id: number
  revision_id: string | null
  tipo: Vf2ComentarioTipo
  contenido: string
  delta: unknown | null
  autor_uid: string
  eliminado: boolean
  created_at: string
}

// ─── Tipos para el editor de grid ─────────────────────────────────────────────

export interface Vf2GridRow {
  rowKey: string
  label: string
  cells: Record<string, Vf2GridCell>
}

export interface Vf2GridCell {
  colKey: string
  cellKind: Vf2CellKind
  valueNum: number | null
  valueText: string | null
  valueJson: unknown | null
  estadoCelda: Vf2EstadoCelda
  factRefId: string | null
  validation: Vf2CellValidation
  isDirty?: boolean
}

// ─── Token de co-edición ──────────────────────────────────────────────────────

export interface Vf2ColabToken {
  empresaId: number
  uid: string
  sheetId: number
  docName: string
  canEdit: boolean
  iat: number
  exp: number
}

// ─── Respuestas de RPCs ───────────────────────────────────────────────────────

export interface Vf2AprobarTareaResult {
  ok: boolean
  cells_materialized: number
  bindings_live: Array<{
    binding_id: number
    fact_id: string
    consumer_kind: Vf2ConsumerKind
    consumer_ref: Record<string, unknown>
  }>
}

export interface Vf2CambiarEstadoResult {
  ok: boolean
  nuevo_estado: Vf2TareaEstado
}

export interface Vf2CrearColeccionResult {
  ok: boolean
  coleccion_id: number
  public_id: string
}
