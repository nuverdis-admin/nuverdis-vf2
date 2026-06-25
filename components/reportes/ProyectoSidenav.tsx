"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";
import { TIPOS_REPORTE, type TipoReporte } from "@/lib/reportes";
import type { ProyectoServer, ReporteHabilitado } from "@/lib/proyecto/data";

interface AddReporteResult {
  ok: boolean;
  tipo_reporte: string;
  tareas_creadas: number;
}

function NavItem({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-1 text-primary-7"
          : "text-gray-6 hover:bg-gray-1 hover:text-gray-9"
      }`}
    >
      <span>{children}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active ? "bg-primary-2 text-primary-8" : "bg-gray-2 text-gray-5"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function ProyectoSidenav({
  empresaRef,
  empresaNombre,
  proyecto,
  reportesHabilitados,
  conteos,
}: {
  empresaRef: string;
  empresaNombre: string;
  proyecto: ProyectoServer;
  reportesHabilitados: ReporteHabilitado[];
  conteos: Record<string, number>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const rol = useAuthStore((s) => s.usuarioActual?.rol);
  const esAdmin = rol === "administrador";
  const [reporteToAdd, setReporteToAdd] = useState<TipoReporte | null>(null);
  const [adding, setAdding] = useState(false);

  const baseProyecto = `/dashboard/proyecto/${proyecto.ref}`;
  const activeOverview = pathname === baseProyecto;

  function isTipoActive(tipo: string) {
    return pathname?.startsWith(`${baseProyecto}/${tipo.toLowerCase()}`);
  }

  async function handleAddReporte() {
    if (!reporteToAdd) return;
    setAdding(true);
    const supabase = createClient();

    const { data, error } = await supabase.rpc("add_reporte_to_proyecto", {
      p_proyecto_id: proyecto.proyecto_id,
      p_tipo_reporte: reporteToAdd,
    });

    if (error) {
      toast.error(`Error al habilitar ${reporteToAdd}: ${error.message}`);
      setAdding(false);
      return;
    }

    const result = data as AddReporteResult | null;
    const tareasMsg = result?.tareas_creadas
      ? ` · ${result.tareas_creadas} tareas creadas`
      : "";
    toast.success(`${reporteToAdd} habilitado${tareasMsg}`);

    const tipoLower = reporteToAdd.toLowerCase();
    setReporteToAdd(null);
    setAdding(false);
    // Re-fetch del layout server + navegar al nuevo reporte
    router.push(`${baseProyecto}/${tipoLower}/seguimiento`);
    router.refresh();
  }

  const estaArchivado = !!proyecto.archivado_at;

  const estadoColor = proyecto.estado === "activo"
    ? "text-success-6"
    : estaArchivado
    ? "text-warning-6"
    : proyecto.estado === "cerrado"
    ? "text-critique-6"
    : "text-warning-6";

  const estadoLabel = estaArchivado
    ? "Archivado"
    : proyecto.estado.charAt(0).toUpperCase() + proyecto.estado.slice(1);

  return (
    <>
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-gray-2 bg-white z-30 md:flex">
        {/* Cabecera */}
        <div className="border-b border-gray-2 p-4 shrink-0">
          <nav className="mb-2 flex items-center gap-1 text-xs text-gray-4">
            <Link
              href={`/dashboard/org/${empresaRef}`}
              className="hover:text-primary-6 transition-colors truncate max-w-[80px]"
            >
              {empresaNombre || "Org"}
            </Link>
            <svg
              className="h-3 w-3 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-5 truncate">Proyecto</span>
          </nav>

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-9 leading-tight" title={proyecto.nombre_proyecto}>
                {proyecto.nombre_proyecto ?? proyecto.ref}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${estadoColor}`}>
                {proyecto.anio_reporte} ·{" "}
                {estadoLabel}
              </p>
            </div>
            {esAdmin && (
              <Link
                href={`${baseProyecto}/configuracion`}
                title="Configuración del proyecto"
                className={`mt-0.5 shrink-0 rounded-lg p-1.5 transition-colors ${
                  pathname === `${baseProyecto}/configuracion`
                    ? "bg-primary-1 text-primary-6"
                    : "text-gray-4 hover:bg-gray-1 hover:text-gray-7"
                }`}
              >
                <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
              </Link>
            )}
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {/* Overview */}
          <NavItem href={baseProyecto} active={activeOverview}>
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 opacity-70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Overview
            </span>
          </NavItem>

          <div className="my-2 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-4">
              Reportes
            </p>
          </div>

          {TIPOS_REPORTE.map((tipo) => {
            const habilitado = reportesHabilitados.some((r) => r.tipo_reporte === tipo);
            const tipoLower = tipo.toLowerCase();

            if (habilitado) {
              return (
                <NavItem
                  key={tipo}
                  href={`${baseProyecto}/${tipoLower}/seguimiento`}
                  active={isTipoActive(tipo)}
                  badge={conteos[tipo]}
                >
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 opacity-70"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    {tipo}
                  </span>
                </NavItem>
              );
            }

            // No habilitado → botón Añadir
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setReporteToAdd(tipo)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-4 transition-colors hover:bg-gray-1 hover:text-gray-7"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {tipo}
                </span>
                <span className="text-[10px] font-medium text-gray-3 border border-gray-2 rounded px-1 py-0.5">
                  + Añadir
                
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Modal: Añadir reporte */}
      {reporteToAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-9">Añadir {reporteToAdd}</h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setReporteToAdd(null)}
                disabled={adding}
                className="rounded-md p-1 text-gray-5 transition-colors hover:bg-gray-1 hover:text-gray-8"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mb-6 text-sm text-gray-6">
              ¿Añadir <span className="font-semibold text-gray-9">{reporteToAdd}</span> al proyecto{" "}
              <span className="font-semibold text-gray-9">{proyecto.nombre_proyecto}</span>? Se
              generarán todas las tareas correspondientes.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReporteToAdd(null)}
                disabled={adding}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddReporte}
                disabled={adding}
                className="btn btn-primary gap-2 disabled:opacity-60"
              >
                {adding ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Habilitando…
                  </>
                ) : (
                  `Confirmar`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
