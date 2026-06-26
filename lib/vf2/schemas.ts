// lib/vf2/schemas.ts — Schemas Zod para validar input de Server Actions vf2_
import { z } from 'zod'

export const vf2PublicId = z.string().min(1).max(50)
export const vf2EstandarSchema = z.enum(['GRI', 'NCG', 'SASB'])
export const vf2TareaEstadoSchema = z.enum([
  'borrador', 'en_preparacion', 'en_revision', 'en_aprobacion', 'aprobada', 'devuelta'
])
export const vf2TareaRolSchema = z.enum(['preparer', 'reviewer', 'approver'])
export const vf2CellKindSchema = z.enum(['input', 'formula', 'fact_ref', 'locked'])
export const vf2ValueKindSchema = z.enum(['num', 'text', 'json'])

// Crear colección
export const vf2CrearColeccionSchema = z.object({
  proyectoId: z.number().int().positive(),
  estandar: vf2EstandarSchema,
  nombre: z.string().min(1).max(200),
})

// Crear tarea
export const vf2CrearTareaSchema = z.object({
  coleccionPublicId: vf2PublicId,
  titulo: z.string().min(1).max(300),
  instruccion: z.string().max(2000).optional(),
  fechaLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  griItemId: z.number().int().positive().optional(),
  griRequerimientoId: z.number().int().positive().optional(),
  ncgItemId: z.number().int().positive().optional(),
  ncgRequerimientoId: z.number().int().positive().optional(),
})

// Asignar rol a tarea
export const vf2AsignarRolSchema = z.object({
  tareaPublicId: vf2PublicId,
  rol: vf2TareaRolSchema,
  asignadoUserId: z.string().uuid().optional(),
  asignadoEquipoId: z.number().int().positive().optional(),
}).refine(
  d => (d.asignadoUserId !== undefined) !== (d.asignadoEquipoId !== undefined),
  { message: 'Debe asignarse a usuario O equipo, no ambos' }
)

// Coordenada de una celda (se guarda en vf2_cell.validation)
export const vf2CellValidationInputSchema = z.object({
  metric_id: z.number().int().positive().optional(),
  periodo_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodo_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dims: z.record(z.string(), z.string()).optional(),
}).optional()

// Guardar celdas (autosave desde el grid)
export const vf2CellValueSchema = z.object({
  rowKey: z.string().min(1).max(100),
  colKey: z.string().min(1).max(100),
  valueNum: z.number().nullable().optional(),
  valueText: z.string().max(10000).nullable().optional(),
  valueJson: z.unknown().optional(),
  validation: vf2CellValidationInputSchema,
})

export const vf2GuardarCeldasSchema = z.object({
  sheetPublicId: vf2PublicId,
  cells: z.array(vf2CellValueSchema).min(1).max(500),
})

// Cambiar estado
export const vf2CambiarEstadoSchema = z.object({
  tareaPublicId: vf2PublicId,
  nuevoEstado: vf2TareaEstadoSchema,
  nota: z.string().max(2000).optional(),
})

// Aprobar tarea
export const vf2AprobarSchema = z.object({
  tareaPublicId: vf2PublicId,
  notas: z.string().max(2000).optional(),
})

// Emitir token de co-edición
export const vf2EmitirTokenSchema = z.object({
  sheetPublicId: vf2PublicId,
})

// Crear binding
export const vf2CrearBindingSchema = z.object({
  factId: z.string().uuid(),
  consumerKind: z.enum(['grid_cell', 'doc_node', 'chart_series']),
  consumerRef: z.record(z.string(), z.unknown()),
  bindingMode: z.enum(['live', 'pinned']).optional(),
  pinnedRevisionId: z.string().uuid().optional(),
})

// Crear métrica
export const vf2CrearMetricaSchema = z.object({
  codigo: z.string().min(1).max(100),
  nombre: z.string().min(1).max(300),
  valueKind: vf2ValueKindSchema,
  unidad: z.string().max(50).optional(),
  griItemId: z.number().int().positive().optional(),
  ncgItemId: z.number().int().positive().optional(),
})

// Agregar comentario
export const vf2AgregarComentarioSchema = z.object({
  tareaPublicId: vf2PublicId,
  tipo: z.enum(['general', 'varianza', 'devolucion']),
  contenido: z.string().min(1).max(5000),
  revisionId: z.string().uuid().optional(),
})
