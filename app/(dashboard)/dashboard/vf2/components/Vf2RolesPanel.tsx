'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2RolesPanel.tsx
// Panel lateral para asignar/ver roles preparer/reviewer/approver en una tarea vf2_

import { useState, useTransition } from 'react'
import { Users, UserCheck, Check, ChevronDown } from 'lucide-react'
import { vf2AsignarRol } from '@/app/actions/vf2-tareas'
import type { Vf2TareaRolRow, Vf2TareaRol } from '@/lib/vf2/types'

interface UsuarioItem {
  uid: string
  nombre_completo: string
  rol: string
}

interface EquipoItem {
  equipo_id: number
  nombre: string
}

interface Props {
  tareaPublicId: string
  roles: Vf2TareaRolRow[]
  usuarios: UsuarioItem[]
  equipos: EquipoItem[]
  esAdmin: boolean
  tareaAprobada: boolean
  onRolesUpdated: (newRoles: Vf2TareaRolRow[]) => void
}

const ROL_LABELS: Record<Vf2TareaRol, string> = {
  preparer: 'Preparer',
  reviewer: 'Reviewer',
  approver: 'Approver',
}

const ROL_DESC: Record<Vf2TareaRol, string> = {
  preparer: 'Ingresa los datos',
  reviewer: 'Revisa y valida',
  approver: 'Aprueba y publica',
}

const ROLES_ORDER: Vf2TareaRol[] = ['preparer', 'reviewer', 'approver']

type AsignacionTipo = 'usuario' | 'equipo'

interface AsignacionState {
  tipo: AsignacionTipo
  userId: string
  equipoId: string
}

export default function Vf2RolesPanel({
  tareaPublicId,
  roles,
  usuarios,
  equipos,
  esAdmin,
  tareaAprobada,
  onRolesUpdated,
}: Props) {
  const [editingRol, setEditingRol] = useState<Vf2TareaRol | null>(null)
  const [asignacion, setAsignacion] = useState<AsignacionState>({
    tipo: 'usuario',
    userId: '',
    equipoId: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Obtener el rol asignado actualmente para un rol dado
  function getRolActual(rol: Vf2TareaRol): Vf2TareaRolRow | undefined {
    return roles.find(r => r.rol === rol && r.activo)
  }

  function iniciarEdicion(rol: Vf2TareaRol) {
    const actual = getRolActual(rol)
    setEditingRol(rol)
    setError(null)
    if (actual?.asignado_user_id) {
      setAsignacion({ tipo: 'usuario', userId: actual.asignado_user_id, equipoId: '' })
    } else if (actual?.asignado_equipo_id) {
      setAsignacion({ tipo: 'equipo', userId: '', equipoId: String(actual.asignado_equipo_id) })
    } else {
      setAsignacion({ tipo: 'usuario', userId: '', equipoId: '' })
    }
  }

  function cancelar() {
    setEditingRol(null)
    setError(null)
  }

  function guardar(rol: Vf2TareaRol) {
    const tieneAsignacion =
      (asignacion.tipo === 'usuario' && asignacion.userId !== '') ||
      (asignacion.tipo === 'equipo' && asignacion.equipoId !== '')

    if (!tieneAsignacion) {
      setError('Selecciona un usuario o equipo')
      return
    }

    setError(null)
    startTransition(async () => {
      const input =
        asignacion.tipo === 'usuario'
          ? { tareaPublicId, rol, asignadoUserId: asignacion.userId }
          : { tareaPublicId, rol, asignadoEquipoId: Number(asignacion.equipoId) }

      const res = await vf2AsignarRol(input)
      if (res.ok) {
        // Actualizar roles localmente
        const newRol: Vf2TareaRolRow = {
          tarea_rol_id: getRolActual(rol)?.tarea_rol_id ?? 0,
          empresa_id: 0,
          tarea_id: 0,
          rol,
          asignado_user_id: asignacion.tipo === 'usuario' ? asignacion.userId : null,
          asignado_equipo_id: asignacion.tipo === 'equipo' ? Number(asignacion.equipoId) : null,
          activo: true,
          created_at: new Date().toISOString(),
        }
        onRolesUpdated(roles.filter(r => r.rol !== rol).concat(newRol))
        setEditingRol(null)
      } else {
        setError(res.error)
      }
    })
  }

  function getNombreAsignado(rol: Vf2TareaRolRow): string {
    if (rol.asignado_user_id) {
      const u = usuarios.find(u => u.uid === rol.asignado_user_id)
      return u ? u.nombre_completo : `uid:${rol.asignado_user_id.slice(0, 8)}…`
    }
    if (rol.asignado_equipo_id) {
      const e = equipos.find(e => e.equipo_id === rol.asignado_equipo_id)
      return e ? `Equipo: ${e.nombre}` : `equipo:${rol.asignado_equipo_id}`
    }
    return '—'
  }

  return (
    <div className="border-t border-gray-3 bg-gray-1">
      <div className="px-4 md:px-8 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-gray-4" />
          <span className="text-xs font-semibold text-gray-6 uppercase tracking-wide">Roles</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {ROLES_ORDER.map(rol => {
            const asignado = getRolActual(rol)
            const estaEditando = editingRol === rol

            return (
              <div key={rol} className="min-w-[200px] flex-1">
                {!estaEditando ? (
                  // Vista compacta
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {asignado ? (
                          <UserCheck className="h-3.5 w-3.5 text-success-7" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-gray-3 bg-white" />
                        )}
                        <span className="text-xs font-semibold text-gray-7">
                          {ROL_LABELS[rol]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-4 mb-1 ml-5">{ROL_DESC[rol]}</p>
                      {asignado ? (
                        <p className="text-xs text-gray-6 ml-5 font-medium">
                          {getNombreAsignado(asignado)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-3 ml-5 italic">Sin asignar</p>
                      )}
                    </div>
                    {esAdmin && !tareaAprobada && (
                      <button
                        onClick={() => iniciarEdicion(rol)}
                        className="text-xs text-primary-6 hover:text-primary-7 shrink-0 mt-0.5"
                      >
                        {asignado ? 'Cambiar' : 'Asignar'}
                      </button>
                    )}
                  </div>
                ) : (
                  // Formulario de asignación
                  <div className="bg-white rounded-lg border border-gray-3 p-3 shadow-sm">
                    <p className="text-xs font-semibold text-gray-7 mb-2">
                      Asignar {ROL_LABELS[rol]}
                    </p>

                    {/* Tabs usuario/equipo */}
                    <div className="flex rounded-lg border border-gray-2 overflow-hidden mb-2 text-xs">
                      {(['usuario', 'equipo'] as AsignacionTipo[]).map(tipo => (
                        <button
                          key={tipo}
                          onClick={() => setAsignacion(p => ({ ...p, tipo, userId: '', equipoId: '' }))}
                          className={`flex-1 py-1.5 capitalize transition-colors ${
                            asignacion.tipo === tipo
                              ? 'bg-primary-5 text-white font-medium'
                              : 'bg-white text-gray-5 hover:bg-gray-1'
                          }`}
                        >
                          {tipo}
                        </button>
                      ))}
                    </div>

                    {asignacion.tipo === 'usuario' ? (
                      <div className="relative">
                        <select
                          value={asignacion.userId}
                          onChange={e => setAsignacion(p => ({ ...p, userId: e.target.value }))}
                          className="w-full text-xs border border-gray-3 rounded-lg px-2 py-1.5 appearance-none pr-6 focus:outline-none focus:border-primary-4"
                        >
                          <option value="">Seleccionar usuario…</option>
                          {usuarios.map(u => (
                            <option key={u.uid} value={u.uid}>
                              {u.nombre_completo} ({u.rol})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="h-3 w-3 text-gray-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={asignacion.equipoId}
                          onChange={e => setAsignacion(p => ({ ...p, equipoId: e.target.value }))}
                          className="w-full text-xs border border-gray-3 rounded-lg px-2 py-1.5 appearance-none pr-6 focus:outline-none focus:border-primary-4"
                        >
                          <option value="">Seleccionar equipo…</option>
                          {equipos.map(e => (
                            <option key={e.equipo_id} value={e.equipo_id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="h-3 w-3 text-gray-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}

                    {error && <p className="text-xs text-critique-7 mt-1">{error}</p>}

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => guardar(rol)}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-1 bg-primary-5 text-white text-xs py-1.5 rounded-lg hover:bg-primary-6 disabled:opacity-50 transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        Guardar
                      </button>
                      <button
                        onClick={cancelar}
                        disabled={isPending}
                        className="flex-1 text-xs text-gray-5 py-1.5 rounded-lg border border-gray-3 hover:bg-gray-1 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
