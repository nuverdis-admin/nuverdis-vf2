'use client'
// app/(dashboard)/vf2/components/Vf2TareaView.tsx — Orquestador cliente de la tarea vf2_

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  vf2CanEditarCeldas,
  vf2CanEnviarRevision,
  vf2CanEnviarAprobacion,
  vf2CanAprobar,
  vf2CanDevolver,
  VF2_ESTADO_BADGE,
  VF2_ESTADO_LABEL,
} from '@/lib/vf2/permisos'
import { vf2CambiarEstado, vf2Aprobar } from '@/app/actions/vf2-tareas'
import Vf2GridEditor from './Vf2GridEditor'
import Vf2AccionesBar from './Vf2AccionesBar'
import type {
  Vf2Tarea,
  Vf2TareaRolRow,
  Vf2Sheet,
  Vf2Cell,
  Vf2Coleccion,
  Vf2TareaEstado,
  Vf2TareaRol,
} from '@/lib/vf2/types'

interface Props {
  tarea: Vf2Tarea
  coleccion: Vf2Coleccion | null
  roles: Vf2TareaRolRow[]
  sheets: Vf2Sheet[]
  celdas: Vf2Cell[]
  actorUid: string
  actorRolApp: string
  actorRolTarea: Vf2TareaRol | null
}

export default function Vf2TareaView({
  tarea: tareaInit,
  coleccion,
  roles,
  sheets,
  celdas,
  actorRolApp,
  actorRolTarea,
}: Props) {
  const [tarea, setTarea] = useState(tareaInit)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const rolApp = actorRolApp as 'administrador' | 'encargado' | 'revisor' | 'superadmin'

  const puedeEditar = vf2CanEditarCeldas(rolApp, actorRolTarea, tarea.estado)
  const puedeEnviarRevision = vf2CanEnviarRevision(rolApp, actorRolTarea, tarea.estado)
  const puedeEnviarAprobacion = vf2CanEnviarAprobacion(rolApp, actorRolTarea, tarea.estado)
  const puedeAprobar = vf2CanAprobar(rolApp, actorRolTarea, tarea.estado)
  const puedeDevolver = vf2CanDevolver(rolApp, actorRolTarea, tarea.estado)

  function handleCambiarEstado(nuevoEstado: Vf2TareaEstado, nota?: string) {
    setError(null)
    startTransition(async () => {
      const res = await vf2CambiarEstado({
        tareaPublicId: tarea.public_id,
        nuevoEstado,
        nota,
      })
      if (res.ok) {
        setTarea(prev => ({ ...prev, estado: nuevoEstado }))
      } else {
        setError(res.error)
      }
    })
  }

  function handleAprobar(notas?: string) {
    setError(null)
    startTransition(async () => {
      const res = await vf2Aprobar({
        tareaPublicId: tarea.public_id,
        notas,
      })
      if (res.ok) {
        setTarea(prev => ({ ...prev, estado: 'aprobada' }))
      } else {
        setError(res.error)
      }
    })
  }

  const sheet = sheets[0] ?? null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-8 py-4 border-b border-gray-3 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-4 mb-2">
          <Link href="/dashboard/vf2" className="hover:text-gray-7">Colecciones</Link>
          <ChevronRight className="h-3 w-3" />
          {coleccion && (
            <>
              <Link
                href={`/dashboard/vf2/coleccion/${coleccion.public_id}`}
                className="hover:text-gray-7"
              >
                {coleccion.nombre}
              </Link>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <span className="text-gray-7 truncate max-w-[200px]">{tarea.titulo}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-9">{tarea.titulo}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${VF2_ESTADO_BADGE[tarea.estado]}`}>
              {VF2_ESTADO_LABEL[tarea.estado]}
            </span>
          </div>

          {/* Barra de acciones */}
          <Vf2AccionesBar
            estado={tarea.estado}
            isPending={isPending}
            puedeEnviarRevision={puedeEnviarRevision}
            puedeEnviarAprobacion={puedeEnviarAprobacion}
            puedeAprobar={puedeAprobar}
            puedeDevolver={puedeDevolver}
            onEnviarRevision={() => handleCambiarEstado('en_revision')}
            onEnviarAprobacion={() => handleCambiarEstado('en_aprobacion')}
            onAprobar={handleAprobar}
            onDevolver={(nota) => handleCambiarEstado('devuelta', nota)}
          />
        </div>

        {tarea.instruccion && (
          <p className="text-sm text-gray-5 mt-2">{tarea.instruccion}</p>
        )}

        {error && (
          <p className="text-xs text-critique-7 mt-2 bg-critique-1 px-3 py-1.5 rounded-lg">
            {error}
          </p>
        )}
      </div>

      {/* Grid editor */}
      <div className="flex-1 overflow-hidden">
        {sheet ? (
          <Vf2GridEditor
            sheet={sheet}
            celdas={celdas}
            puedeEditar={puedeEditar}
            tareaPublicId={tarea.public_id}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-4 text-sm">
              Esta tarea no tiene hojas de datos configuradas aún.
            </p>
          </div>
        )}
      </div>

      {/* Roles sidebar info */}
      {roles.length > 0 && (
        <div className="px-4 md:px-8 py-3 border-t border-gray-3 bg-gray-1 flex items-center gap-4 text-xs text-gray-5">
          {roles.map(r => (
            <span key={r.tarea_rol_id} className="capitalize">
              <span className="font-medium text-gray-7">{r.rol}:</span>{' '}
              {r.asignado_user_id ? `uid:${r.asignado_user_id.slice(0, 8)}…` : `equipo:${r.asignado_equipo_id}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
