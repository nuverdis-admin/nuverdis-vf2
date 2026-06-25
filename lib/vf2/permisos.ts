// lib/vf2/permisos.ts — Matriz de permisos rol×estado para el módulo vf2_
// Espejo client-side de las validaciones del RPC en la BD.

import type { Vf2TareaEstado, Vf2TareaRol } from './types'

type AppRol = 'administrador' | 'encargado' | 'revisor' | 'superadmin'

// ¿Puede este rol editar celdas de la tarea en este estado?
export function vf2CanEditarCeldas(
  rolApp: AppRol,
  rolTarea: Vf2TareaRol | null,
  estado: Vf2TareaEstado
): boolean {
  if (estado === 'aprobada') return false
  if (rolApp === 'administrador' || rolApp === 'superadmin') return true
  if (rolTarea === 'preparer' && (estado === 'en_preparacion' || estado === 'devuelta')) return true
  return false
}

// ¿Puede enviar a revisión?
export function vf2CanEnviarRevision(
  rolApp: AppRol,
  rolTarea: Vf2TareaRol | null,
  estado: Vf2TareaEstado
): boolean {
  if (estado !== 'en_preparacion') return false
  if (rolApp === 'administrador' || rolApp === 'superadmin') return true
  return rolTarea === 'preparer'
}

// ¿Puede enviar a aprobación?
export function vf2CanEnviarAprobacion(
  rolApp: AppRol,
  rolTarea: Vf2TareaRol | null,
  estado: Vf2TareaEstado
): boolean {
  if (estado !== 'en_revision') return false
  if (rolApp === 'administrador' || rolApp === 'superadmin') return true
  return rolTarea === 'reviewer'
}

// ¿Puede aprobar?
export function vf2CanAprobar(
  rolApp: AppRol,
  rolTarea: Vf2TareaRol | null,
  estado: Vf2TareaEstado
): boolean {
  if (!['en_aprobacion', 'en_revision'].includes(estado)) return false
  if (rolApp === 'administrador' || rolApp === 'superadmin') return true
  return rolTarea === 'approver'
}

// ¿Puede devolver?
export function vf2CanDevolver(
  rolApp: AppRol,
  rolTarea: Vf2TareaRol | null,
  estado: Vf2TareaEstado
): boolean {
  if (!['en_revision', 'en_aprobacion'].includes(estado)) return false
  if (rolApp === 'administrador' || rolApp === 'superadmin') return true
  return rolTarea === 'reviewer' || rolTarea === 'approver'
}

// ¿Puede asignar roles?
export function vf2CanAsignarRoles(rolApp: AppRol): boolean {
  return rolApp === 'administrador' || rolApp === 'superadmin'
}

// Transiciones válidas desde un estado dado
export const VF2_TRANSICIONES: Record<Vf2TareaEstado, Vf2TareaEstado[]> = {
  borrador:       ['en_preparacion'],
  en_preparacion: ['en_revision'],
  en_revision:    ['en_aprobacion', 'devuelta'],
  en_aprobacion:  ['aprobada', 'devuelta'],
  aprobada:       [],
  devuelta:       ['en_preparacion'],
}

// Colores de estado para badges/pills (reutiliza el sistema de diseño)
export const VF2_ESTADO_BADGE: Record<Vf2TareaEstado, string> = {
  borrador:       'bg-gray-2 text-gray-6',
  en_preparacion: 'bg-secondary-2 text-secondary-7',
  en_revision:    'text-success-7 border border-success-7 bg-success-1/30',
  en_aprobacion:  'bg-warning-1 text-warning-9',
  aprobada:       'bg-success-1 text-success-7',
  devuelta:       'bg-warning-1 text-warning-9',
}

export const VF2_ESTADO_LABEL: Record<Vf2TareaEstado, string> = {
  borrador:       'Borrador',
  en_preparacion: 'En preparación',
  en_revision:    'En revisión',
  en_aprobacion:  'En aprobación',
  aprobada:       'Aprobada',
  devuelta:       'Devuelta',
}
