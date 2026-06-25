"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEstadoBadge, type ReporteConfig } from "@/lib/reportes";
import type { PresenciaUser, TareaDetalle } from "@/lib/tareas/types";
import { AdminModeSwitch } from "./AdminModeSwitch";
import { PresenciaPills } from "./PresenciaPills";

interface Props {
  config: ReporteConfig;
  tarea: TareaDetalle;
  esAdmin: boolean;
  adminModoEdicion: boolean;
  onToggleAdminModo: (next: boolean) => void;
  onAbrirDetalles?: () => void;
  showDetallesButton?: boolean;
  noLeidos?: number;
  proyectoRef: string;
  tipo: string;
  presentes?: PresenciaUser[];
  versionRemota?: number | null;
  onRecargar?: () => void;
}

export function TareaHeader({
  config,
  tarea,
  esAdmin,
  adminModoEdicion,
  onToggleAdminModo,
  onAbrirDetalles,
  showDetallesButton,
  noLeidos = 0,
  proyectoRef,
  tipo,
  presentes = [],
  versionRemota,
  onRecargar,
}: Props) {
  const router = useRouter();
  const { label, badgeClass } = getEstadoBadge(config, tarea.estado);
  const backHref = `/dashboard/proyecto/${proyectoRef}/${tipo.toLowerCase()}/seguimiento`;
  const readOnlyForAdmin = esAdmin && !adminModoEdicion;
  const hayActualizacion = versionRemota !== null && versionRemota !== undefined;

  return (
    <header className="flex flex-col gap-3 rounded-xl border border-gray-2 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:flex-1">
          <Link
            href={backHref}
            className="mt-0.5 shrink-0 rounded-md p-1 text-gray-5 hover:bg-gray-1 hover:text-gray-8"
            title="Volver a tareas"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-4">
              {tarea.estandar} · {tarea.jerarquia_1}-{tarea.jerarquia_2} · {tarea.jerarquia_1_nombre}
            </p>
            <h1 className="mt-0.5 truncate text-lg font-bold text-gray-9">
              {tarea.jerarquia_2_nombre}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <span className={badgeClass}>{label}</span>
          {readOnlyForAdmin && (
            <span className="badge bg-gray-2 text-gray-6">Solo lectura</span>
          )}

          {showDetallesButton && onAbrirDetalles && (
            <button
              type="button"
              onClick={onAbrirDetalles}
              className="btn btn-outline relative h-8 rounded-lg px-3 text-xs"
            >
              Detalles
              {noLeidos > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-critique-6 text-[9px] font-bold text-white">
                  {noLeidos > 9 ? "9+" : noLeidos}
                </span>
              )}
            </button>
          )}
          {esAdmin && (
            <AdminModeSwitch
              modoEdicion={adminModoEdicion}
              onToggle={onToggleAdminModo}
              bloqueado={tarea.estado === "en_revision"}
            />
          )}
        </div>
      </div>

      {presentes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-4">También en esta tarea:</span>
          <PresenciaPills presentes={presentes} adminModoEdicion={adminModoEdicion} />
        </div>
      )}

      {hayActualizacion && (
        <div className="flex items-center justify-between rounded-lg border border-warning-3 bg-warning-1 px-3 py-2">
          <p className="text-sm text-warning-7">
            Esta tarea fue actualizada por otro usuario.
          </p>
          <button
            type="button"
            onClick={onRecargar ?? (() => router.refresh())}
            className="ml-3 shrink-0 rounded-md bg-warning-5 px-3 py-1 text-xs font-semibold text-white hover:bg-warning-6"
          >
            Recargar
          </button>
        </div>
      )}

      {tarea.motivo_rechazo && tarea.estado === "retornada" && (
        <div className="rounded-lg border border-critique-3 bg-critique-1 px-3 py-2 text-sm">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-critique-7">
            Motivo de rechazo
          </p>
          <p className="text-critique-7">{tarea.motivo_rechazo}</p>
        </div>
      )}

      {tarea.instruccion && (
        <div className="rounded-lg bg-gray-1 px-3 py-2 text-sm">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-5">
            Instrucciones
          </p>
          <p className="text-gray-7">{tarea.instruccion}</p>
        </div>
      )}
    </header>
  );
}
