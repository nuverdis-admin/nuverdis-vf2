"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Proyecto } from "@/lib/store/auth";
import Image from "next/image";

interface Props {
  params: { empresaRef: string };
}

function estadoColor(estado: string, archivado_at: string | null): string {
  if (archivado_at) return "badge-warning";
  switch (estado.toLowerCase()) {
    case "activo":   return "badge-success";
    case "cerrado":  return "badge-critique";
    default:         return "badge";
  }
}

function estadoTexto(estado: string, archivado_at: string | null): string {
  if (archivado_at) return "Archivado";
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

const REPORTES_DISPONIBLES = ["GRI", "SASB", "NCG"] as const;

export default function OrgPage({ params }: Props) {
  const router = useRouter();
  const appConfig = useAuthStore((s) => s.appConfig);
  const rol = useAuthStore((s) => s.usuarioActual?.rol ?? "");
  const proyectos = useAuthStore((s) => s.proyectos);
  const setProyectos = useAuthStore((s) => s.setProyectos);

  const esAdmin = rol === "administrador";

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState("");
  const [reportesSeleccionados, setReportesSeleccionados] = useState<Set<string>>(
    new Set(["GRI"])
  );
  const [creating, setCreating] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  // Bloqueo creación: proyectos >1 año sin cerrar
  const [showBloqueoModal, setShowBloqueoModal] = useState(false);
  const [proyectosVencidos, setProyectosVencidos] = useState<
    { proyecto_id: number; ref: string; nombre_proyecto: string; anio_reporte: number; created_at: string }[]
  >([]);

  useEffect(() => {
    if (appConfig && appConfig.empresa.ref !== params.empresaRef) {
      router.replace(`/dashboard/org/${appConfig.empresa.ref}`);
    }
  }, [appConfig, params.empresaRef, router]);

  if (!appConfig) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-gray-5">Cargando…</span>
      </div>
    );
  }

  function toggleReporte(reporte: string) {
    setReportesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(reporte)) {
        next.delete(reporte);
      } else {
        next.add(reporte);
      }
      return next;
    });
  }

  function cerrarModal() {
    setShowModal(false);
    setNombre("");
    setReportesSeleccionados(new Set(["GRI"]));
  }

  async function handleNuevoProyecto() {
    const supabase = createClient();
    const { data } = await supabase.rpc("proyectos_vencidos_sin_cerrar");
    const vencidos = (data as { proyecto_id: number; ref: string; nombre_proyecto: string; anio_reporte: number; created_at: string }[]) ?? [];
    if (vencidos.length > 0) {
      setProyectosVencidos(vencidos);
      setShowBloqueoModal(true);
    } else {
      setShowModal(true);
    }
  }

  async function handleCrearProyecto(e: React.FormEvent) {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.error("El nombre del proyecto es requerido");
      return;
    }
    if (reportesSeleccionados.size === 0) {
      toast.error("Selecciona al menos un reporte (GRI, SASB o NCG)");
      return;
    }

    setCreating(true);
    const supabase = createClient();

    const { data: result, error } = await supabase.rpc("crear_proyecto", {
      p_nombre: nombre.trim(),
      p_reportes: Array.from(reportesSeleccionados),
    });

    if (error || result?.error) {
      toast.error(`Error al crear proyecto: ${error?.message ?? result?.error}`);
      setCreating(false);
      return;
    }

    // Re-fetch proyectos para actualizar el store
    const { data: updatedProyectos, error: fetchError } = await supabase
      .from("proyectos")
      .select("proyecto_id, ref, nombre_proyecto, anio_reporte, estado, archivado_at, empresa_id")
      .order("anio_reporte", { ascending: false });

    if (fetchError) {
      toast.error("Proyecto creado pero no se pudo actualizar la lista");
      setCreating(false);
      cerrarModal();
      return;
    }

    if (updatedProyectos) {
      setProyectos(updatedProyectos as Proyecto[]);
    }

    toast.success("Proyecto creado exitosamente");
    setCreating(false);
    cerrarModal();

    const ref = result?.ref as string | undefined;
    if (ref) {
      router.push(`/dashboard/vf2/proyecto/${ref}`);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-9">Proyectos</h1>
        <p className="mt-1 text-sm text-gray-5">
          Organización: {appConfig.empresa.nombre ?? "N/A"}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-2 pb-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Buscar por proyecto"
            className="h-10 w-full rounded-md border border-gray-3 bg-white px-4 text-sm outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 sm:w-[320px]"
          />
          <button type="button" className="flex h-10 items-center justify-center rounded-md border-2 border-dotted border-primary-4 px-4 text-sm font-semibold text-gray-8 transition-colors hover:bg-primary-0">
            Estados
          </button>
        </div>

        {esAdmin && (
          <button
            type="button"
            onClick={handleNuevoProyecto}
            className="btn btn-primary h-10 gap-2 shadow-sm"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nuevo proyecto
          </button>
        )}
      </div>

      {/* Grid o Empty State */}
      {proyectos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-2 bg-gray-1 py-12">
          <svg
            className="h-12 w-12 text-gray-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="font-medium text-gray-7">No hay proyectos aún</p>
          <p className="text-sm text-gray-5">
            Crea tu primer proyecto para comenzar
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((proyecto) => (
            <div key={proyecto.proyecto_id} className="group relative">
              <Link
                href={`/dashboard/vf2/proyecto/${proyecto.ref}`}
                className="relative flex min-h-[176px] cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-primary-3 bg-primary-1 p-5 shadow-sm transition-all hover:border-primary-4 hover:shadow-card block"
              >
                <div className="z-10 flex items-start justify-between">
                  <h2 className="text-lg font-bold text-gray-9 pr-8">
                    {proyecto.nombre_proyecto}
                  </h2>
                </div>

                <div className="z-10 mt-2 flex flex-col gap-1">
                  <p className="text-sm text-gray-8">
                    Año: {proyecto.anio_reporte}
                  </p>
                  <p className="text-xs text-gray-7">
                    Estado: {estadoTexto(proyecto.estado, proyecto.archivado_at ?? null)}
                  </p>
                </div>

                <div className="z-10 mt-4">
                  <span className={`badge ${estadoColor(proyecto.estado, proyecto.archivado_at ?? null)}`}>
                    {estadoTexto(proyecto.estado, proyecto.archivado_at ?? null)}
                  </span>
                </div>

                <div className="pointer-events-none absolute -bottom-6 -right-6 rotate-[-30deg] opacity-5 transition-transform group-hover:scale-110">
                  <Image
                    src={appConfig.empresa.icono}
                    alt=""
                    width={160}
                    height={160}
                    className="h-40 w-40 object-contain"
                  />
                </div>
              </Link>

              {/* Botón 3 puntos */}
              <div className="absolute right-3 top-3 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setMenuAbierto(menuAbierto === proyecto.proyecto_id ? null : proyecto.proyecto_id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-primary-7 transition-colors hover:bg-primary-2"
                  aria-label="Opciones del proyecto"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 -960 960 960">
                    <path d="M479.86-160Q460-160 446-174.14t-14-34Q432-228 446.14-242t34-14Q500-256 514-241.86t14 34Q528-188 513.86-174t-34 14Zm0-272Q460-432 446-446.14t-14-34Q432-500 446.14-514t34-14Q500-528 514-513.86t14 34Q528-460 513.86-446t-34 14Zm0-272Q460-704 446-718.14t-14-34Q432-772 446.14-786t34-14Q500-800 514-785.86t14 34Q528-732 513.86-718t-34 14Z" />
                  </svg>
                </button>

                {menuAbierto === proyecto.proyecto_id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuAbierto(null)}
                    />
                    <div className="absolute right-0 top-8 z-20 min-w-[148px] rounded-lg border border-gray-2 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(null);
                          router.push(`/dashboard/proyecto/${proyecto.ref}/configuracion`);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-8 transition-colors hover:bg-gray-1"
                      >
                        <svg className="h-4 w-4 text-gray-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Configuración
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear Proyecto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            {/* Título */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-9">Nuevo proyecto</h2>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={cerrarModal}
                disabled={creating}
                className="rounded-md p-1 text-gray-5 transition-colors hover:bg-gray-1 hover:text-gray-8"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCrearProyecto} className="flex flex-col gap-5">
              {/* Nombre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-8">
                  Nombre del proyecto <span className="text-critique-6">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Reporte de Sostenibilidad 2025"
                  maxLength={100}
                  disabled={creating}
                  className="h-10 rounded-md border border-gray-3 bg-white px-3 text-sm outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 disabled:opacity-60"
                />
              </div>

              {/* Reportes */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-8">
                  Marcos de reporte <span className="text-critique-6">*</span>
                </label>
                <p className="text-xs text-gray-5">Selecciona al menos uno</p>
                <div className="flex flex-col gap-2">
                  {REPORTES_DISPONIBLES.map((reporte) => {
                    const checked = reportesSeleccionados.has(reporte);
                    return (
                      <label
                        key={reporte}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                          checked
                            ? "border-primary-4 bg-primary-0"
                            : "border-gray-2 bg-white hover:border-gray-3"
                        } ${creating ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReporte(reporte)}
                          disabled={creating}
                          className="accent-primary-5 h-4 w-4 rounded"
                        />
                        <span className="text-sm font-medium text-gray-8">
                          {reporte}
                        </span>
                        {reporte === "GRI"}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={creating}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !nombre.trim() || reportesSeleccionados.size === 0}
                  className="btn btn-primary gap-2 disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creando…
                    </>
                  ) : (
                    "Crear proyecto"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal bloqueo: proyectos >1 año sin cerrar */}
      {showBloqueoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-warning-5">
            <div className="mb-2 text-2xl">⚠️</div>
            <h2 className="mb-2 text-lg font-bold text-gray-9">
              Proyectos sin cerrar
            </h2>
            <p className="mb-4 text-sm text-gray-6">
              Tienes{" "}
              <span className="font-semibold text-warning-7">
                {proyectosVencidos.length} proyecto
                {proyectosVencidos.length > 1 ? "s" : ""}
              </span>{" "}
              con más de 1 año sin cerrar. Debes cerrarlos antes de crear uno nuevo.
            </p>
            <ul className="mb-5 space-y-1">
              {proyectosVencidos.map((p) => (
                <li key={p.proyecto_id}>
                  <a
                    href={`/dashboard/proyecto/${p.ref}/configuracion`}
                    onClick={() => setShowBloqueoModal(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-7 hover:bg-primary-1"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {p.nombre_proyecto}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowBloqueoModal(false)}
                className="btn btn-ghost rounded-lg"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
