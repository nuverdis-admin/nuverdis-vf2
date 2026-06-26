'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2TareaView.tsx — Orquestador cliente de la tarea vf2_

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
import Vf2RolesPanel from './Vf2RolesPanel'
import Vf2MetricaBadge from './Vf2MetricaBadge'
import Vf2EvidenciasPanel from './Vf2EvidenciasPanel'
import Vf2LinkedDataPanel from './Vf2LinkedDataPanel'
import type {
  Vf2Tarea,
  Vf2TareaRolRow,
  Vf2Sheet,
  Vf2Cell,
  Vf2Coleccion,
  Vf2TareaEstado,
  Vf2TareaRol,
  Vf2Metric,
  Vf2Evidencia,
} from '@/lib/vf2/types'

interface UsuarioItem {
  uid: string
  nombre_completo: string
  rol: string
}

interface EquipoItem {
  equipo_id: number
  nombre: string
}

interface ItemInfo {
  estandar: string
  etiqueta: string  // ej. "GRI 305-1 / Emisiones directas" o "NCG 2.1 / Misión y visión"
}

interface MetricaMin {
  metric_id: number
  public_id: string
  codigo: string
  nombre: string
  unidad: string | null
}

interface Props {
  tarea: Vf2Tarea
  coleccion: Vf2Coleccion | null
  roles: Vf2TareaRolRow[]
  sheets: Vf2Sheet[]
  celdas: Vf2Cell[]
  actorUid: string
  actorRolApp: string
  actorRolTarea: Vf2TareaRol | null
  proyectoRef: string
  colRef: string
  usuarios: UsuarioItem[]
  equipos: EquipoItem[]
  metrica: Vf2Metric | null
  metricas: MetricaMin[]
  evidencias: Vf2Evidencia[]
  actorEmpresaId: number
  itemInfo?: ItemInfo | null
}

export default function Vf2TareaView({
  tarea: tareaInit,
  coleccion,
  roles: rolesInit,
  sheets,
  celdas,
  actorUid,
  actorRolApp,
  actorRolTarea,
  proyectoRef,
  colRef,
  usuarios,
  equipos,
  metrica: metricaInit,
  metricas,
  evidencias: evidenciasInit,
  actorEmpresaId,
  itemInfo,
}: Props) {
  const [tarea, setTarea] = useState(tareaInit)
  const [roles, setRoles] = useState<Vf2TareaRolRow[]>(rolesInit)
  const [metrica, setMetrica] = useState<Vf2Metric | null>(metricaInit)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const rolApp = actorRolApp as 'administrador' | 'encargado' | 'revisor' | 'superadmin'
  const esAdmin = rolApp === 'administrador' || rolApp === 'superadmin'

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
          <Link href={`/dashboard/proyecto/${proyectoRef}`} className="hover:text-gray-7">
            Colecciones
          </Link>
          <ChevronRight className="h-3 w-3" />
          {coleccion && (
            <>
              <Link
                href={`/dashboard/proyecto/${proyectoRef}/coleccion/${colRef}`}
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

        {itemInfo && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              itemInfo.estandar === 'GRI' ? 'bg-success-1 text-success-7'
              : itemInfo.estandar === 'NCG' ? 'bg-secondary-2 text-secondary-7'
              : 'bg-gray-2 text-gray-6'
            }`}>
              {itemInfo.estandar}
            </span>
            <span className="text-xs text-gray-5">{itemInfo.etiqueta}</span>
          </div>
        )}

        {tarea.instruccion && (
          <p className="text-sm text-gray-5 mt-2">{tarea.instruccion}</p>
        )}

        {/* Métrica vinculada (necesaria para materializar Facts al aprobar) */}
        <div className="mt-2">
          <Vf2MetricaBadge
            metrica={metrica}
            griItemId={tarea.gri_item_id ?? null}
            ncgItemId={tarea.ncg_item_id ?? null}
            tareaPublicId={tarea.public_id}
            esAdmin={esAdmin}
            onMetricaCreada={setMetrica}
          />
        </div>

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
            metricas={metricas}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-4 text-sm">
              Esta tarea no tiene hojas de datos configuradas aún.
            </p>
          </div>
        )}
      </div>

      {/* Panel de evidencias */}
      <Vf2EvidenciasPanel
        tareaPublicId={tarea.public_id}
        empresaId={actorEmpresaId}
        evidenciasInit={evidenciasInit}
        puedeSubir={puedeEditar}
        actorUid={actorUid}
        esAdmin={esAdmin}
        tareaAprobada={tarea.estado === 'aprobada'}
      />

      {/* Panel Linked Data (solo si hay métrica) */}
      {metrica && (
        <Vf2LinkedDataPanel
          metricPublicId={metrica.public_id}
          metricCodigo={metrica.codigo}
          metricNombre={metrica.nombre}
          metricUnidad={metrica.unidad}
        />
      )}

      {/* Panel de roles */}
      <Vf2RolesPanel
        tareaPublicId={tarea.public_id}
        roles={roles}
        usuarios={usuarios}
        equipos={equipos}
        esAdmin={esAdmin}
        tareaAprobada={tarea.estado === 'aprobada'}
        onRolesUpdated={setRoles}
      />
    </div>
  )
}
