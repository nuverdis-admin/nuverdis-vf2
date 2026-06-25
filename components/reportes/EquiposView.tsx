"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Ban,
} from "lucide-react";
import { getReporteConfig, getEstadoBadge } from "@/lib/reportes/index";
import type { EquipoConTareas, TareaEquipoRow } from "@/lib/proyecto/equipos-tab";

interface EquiposViewProps {
  equipos: EquipoConTareas[];
  esAdmin: boolean;
  proyectoRef: string;
  tipo: string;
}

function TareaFila({
  tarea,
  proyectoRef,
  tipo,
  estadoBadge,
}: {
  tarea: TareaEquipoRow;
  proyectoRef: string;
  tipo: string;
  estadoBadge: { label: string; badgeClass: string };
}) {
  const href = `/dashboard/proyecto/${proyectoRef}/${tipo}/seguimiento/${tarea.tarea_public_id}`;

  const contenido = (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-xs text-gray-4 font-mono shrink-0 w-16">
        {tarea.estandar}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">
          {tarea.jerarquia_1_nombre}
        </span>
        <span className="block text-xs text-gray-5 truncate">
          {tarea.jerarquia_2_nombre}
        </span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {tarea.situacion === "excluido" && (
          <span className="flex items-center gap-1 rounded-full border border-gray-2 bg-gray-1 px-2 py-0.5 text-xs text-gray-4">
            <Ban className="h-3 w-3" />
            Excluido
          </span>
        )}
        {tarea.situacion === "derivado_solo_tarea" && (
          <span className="flex items-center gap-1 rounded-full border border-info-3 bg-info-1 px-2 py-0.5 text-xs text-info-7">
            <AlertCircle className="h-3 w-3" />
            Derivado
          </span>
        )}
        <span className={`${estadoBadge.badgeClass} text-xs`}>
          {estadoBadge.label}
        </span>
      </div>
    </div>
  );

  if (tarea.situacion === "excluido") {
    return (
      <div className="border-b border-gray-2 bg-gray-1 cursor-not-allowed opacity-75 last:border-b-0">
        {contenido}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`block border-b last:border-b-0 transition-colors ${
        tarea.situacion === "derivado_solo_tarea"
          ? "border-info-2 bg-info-1 hover:bg-info-2"
          : "border-gray-2 hover:bg-gray-1"
      }`}
    >
      {contenido}
    </Link>
  );
}

function EquipoCard({
  equipo,
  proyectoRef,
  tipo,
  config,
}: {
  equipo: EquipoConTareas;
  proyectoRef: string;
  tipo: string;
  config: ReturnType<typeof getReporteConfig>;
}) {
  const [abierto, setAbierto] = useState(false);
  const esDerivedoSinEquipo = equipo.tieneTareaDerivadaSinEquipo && !equipo.esMiembro;

  return (
    <div
      className={`shrink-0 rounded-lg border overflow-hidden transition-all duration-200 ${
        // 1. Lógica de borde: 
        // Si está abierto, usamos border-primary-5 (verde), si no, borde base
        abierto 
          ? "border-primary-5 shadow-sm" 
          : "border-gray-2 bg-white"
      } ${
        // 2. Mantenemos la lógica de alerta de derivación si existe
        esDerivedoSinEquipo ? "border-l-4 border-info-5" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          abierto ? "bg-primary-5/5" : "hover:bg-gray-1"
        }`}
      >
        <Users className="h-4 w-4 text-gray-5 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-gray-8 text-sm">
            {equipo.equipo_nombre}
          </span>
          {esDerivedoSinEquipo && (
            <span className="block text-xs text-info-6 mt-0.5">
              No perteneces a este equipo, pero tienes una tarea derivada
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {esDerivedoSinEquipo && (
            <span className="flex items-center gap-1 rounded-full border border-info-3 bg-info-1 px-2 py-0.5 text-xs text-info-7">
              <AlertCircle className="h-3 w-3" />
              Tarea derivada
            </span>
          )}
          <span className="rounded-full bg-gray-2 px-2.5 py-0.5 text-xs font-medium text-gray-6">
            {equipo.tareas.length}
          </span>
          {abierto ? (
            <ChevronUp className="h-4 w-4 text-gray-4" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-4" />
          )}
        </div>
      </button>

      {/* El contenido del acordeón hereda el borde del contenedor padre */}
      {abierto && (
        <div className="border-t border-primary-2 bg-white">
          {equipo.tareas.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-4 text-center">
              Sin tareas asignadas
            </p>
          ) : (
            equipo.tareas.map((tarea) => (
              <TareaFila
                key={tarea.tarea_id}
                tarea={tarea}
                proyectoRef={proyectoRef}
                tipo={tipo}
                estadoBadge={config ? getEstadoBadge(config, tarea.estado) : { label: tarea.estado, badgeClass: "badge" }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function EquiposView({
  equipos,
  esAdmin,
  proyectoRef,
  tipo,
}: EquiposViewProps) {
  const config = getReporteConfig(tipo);

  if (equipos.length === 0) {
    return (
      // ✅ AÑADIDO: Contenedor con altura fija y overflow-hidden para igualar AsignacionesView
      <div className="flex h-[calc(100vh-240px)] w-full overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-1">
                <Users className="h-7 w-7 text-gray-4" />
              </div>
              <p className="text-sm font-medium text-gray-6">
                {esAdmin
                  ? "No hay equipos configurados en este proyecto"
                  : "No perteneces a ningún equipo en este proyecto"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // ✅ AÑADIDO: Contenedor estricto que obliga al flex-1 interno a usar su propio scroll
    <div className="flex h-[calc(100vh-240px)] w-full overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Este overflow-y-auto ahora sí funcionará porque su abuelo tiene altura límite */}
        <div className="flex-1 overflow-y-auto pb-4 pr-1">
          <div className="flex flex-col gap-3">
            {equipos.map((equipo) => (
              <EquipoCard
                key={equipo.equipo_id}
                equipo={equipo}
                proyectoRef={proyectoRef}
                tipo={tipo}
                config={config}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
