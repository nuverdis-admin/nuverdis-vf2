"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, AlertTriangle, Lock, Trash2, Pencil } from "lucide-react";
import { cerrarProyecto, eliminarProyecto, renombrarProyecto } from "@/app/actions/proyectos";
import type { ProyectoServer } from "@/lib/proyecto/data";
import { useAuthStore } from "@/lib/store/auth";

type ModalState =
  | null
  | "cerrar-felicitaciones"
  | "cerrar-advertencia"
  | "cerrar-confirmar"
  | "eliminar";

interface Props {
  proyecto: ProyectoServer;
  empresaRef: string;
  tareasIncompletas: number;
}

export function ConfiguracionView({ proyecto, empresaRef, tareasIncompletas }: Props) {
  const router = useRouter();
  const setProyectos = useAuthStore((s) => s.setProyectos);
  const proyectosStore = useAuthStore((s) => s.proyectos);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);
  const [eliminarInput, setEliminarInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const yaEstaCerrado = proyecto.estado === "cerrado" || !!proyecto.archivado_at;
  const [nuevoNombre, setNuevoNombre] = useState(proyecto.nombre_proyecto);
  const [loadingNombre, setLoadingNombre] = useState(false);

  async function handleRenombrar(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nuevoNombre.trim();
    if (!trimmed || trimmed === proyecto.nombre_proyecto) return;
    setLoadingNombre(true);
    const res = await renombrarProyecto(parseInt(proyecto.proyecto_id, 10), trimmed);
    setLoadingNombre(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Nombre actualizado");
    router.refresh();
  }

  async function handleCerrar() {
    setLoading(true);
    const res = await cerrarProyecto(parseInt(proyecto.proyecto_id, 10));
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Proyecto cerrado correctamente");
    setModal(null);
    router.refresh();
  }

  async function handleEliminar() {
    setLoading(true);
    const res = await eliminarProyecto(
      parseInt(proyecto.proyecto_id, 10),
      eliminarInput
    );
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Proyecto eliminado");
    setModal(null);
    setProyectos(proyectosStore.filter((p) => p.proyecto_id !== proyecto.proyecto_id));
    router.push(`/dashboard/org/${empresaRef}`);
  }

  function abrirCerrar() {
    if (tareasIncompletas === 0) {
      setModal("cerrar-felicitaciones");
    } else {
      setModal("cerrar-advertencia");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-6" strokeWidth={2} />
        <div>
          <h1 className="text-xl font-bold text-gray-9">Configuración del proyecto</h1>
          <p className="text-sm text-gray-5">{proyecto.nombre_proyecto}</p>
        </div>
      </div>

      {/* Banner proyecto cerrado / archivado */}
      {proyecto.archivado_at ? (
        <div className="flex items-center gap-3 rounded-lg border border-warning-3 bg-warning-1 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-warning-6" strokeWidth={2} />
          <p className="text-sm font-medium text-warning-7">
            Este proyecto está archivado. Solo los administradores pueden consultarlo.
            <span className="ml-1 text-warning-6">
              Archivado el {new Date(proyecto.archivado_at).toLocaleDateString("es-CL")}.
            </span>
          </p>
        </div>
      ) : yaEstaCerrado ? (
        <div className="flex items-center gap-3 rounded-lg border border-critique-3 bg-critique-1 px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-critique-6" strokeWidth={2} />
          <p className="text-sm font-medium text-critique-7">
            Este proyecto está cerrado y es de solo lectura.
            {proyecto.cerrado_at && (
              <span className="ml-1 text-critique-6">
                Cerrado el {new Date(proyecto.cerrado_at).toLocaleDateString("es-CL")}.
              </span>
            )}
          </p>
        </div>
      ) : null}

      {/* Cambio de nombre */}
      <div className="rounded-xl border border-primary-3 bg-white">
        <div className="flex items-center gap-2 border-b border-primary-3 px-5 py-4">
          <Pencil className="h-5 w-5 text-primary-6" strokeWidth={2} />
          <h2 className="text-base font-bold text-gray-9">Cambiar nombre del proyecto</h2>
        </div>
        <form onSubmit={handleRenombrar} className="px-5 py-4">
          <p className="mb-3 text-xs text-gray-5">
            El nombre es visible para todos los miembros del proyecto.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              disabled={yaEstaCerrado || loadingNombre}
              maxLength={120}
              className="flex-1 rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-9 outline-none transition-colors focus:border-primary-4 focus:ring-1 focus:ring-primary-3 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={
                yaEstaCerrado ||
                loadingNombre ||
                !nuevoNombre.trim() ||
                nuevoNombre.trim() === proyecto.nombre_proyecto
              }
              className="btn btn-primary rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingNombre ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-critique-3 bg-white">
        <div className="flex items-center gap-2 border-b border-critique-3 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-critique-6" strokeWidth={2} />
          <h2 className="text-base font-bold text-critique-7">Zona de peligro</h2>
        </div>

        <div className="divide-y divide-critique-2">
          {/* Cerrar proyecto */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-9">Cerrar proyecto</p>
              <p className="mt-0.5 text-xs text-gray-5">
                El proyecto quedará en modo lectura. No se podrán editar tareas ni
                asignaciones. Esta acción es reversible solo ingresando un ticket en soporte.
              </p>
            </div>
            <button
              type="button"
              disabled={yaEstaCerrado}
              onClick={abrirCerrar}
              className="ml-4 shrink-0 rounded-lg border border-critique-4 bg-white px-4 py-1.5 text-sm font-medium text-critique-7 transition-colors hover:bg-critique-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Lock className="inline h-4 w-4 mr-1.5 -mt-0.5" strokeWidth={2} />
              Cerrar proyecto
            </button>
          </div>

          {/* Eliminar proyecto */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-9">Eliminar proyecto</p>
              <p className="mt-0.5 text-xs text-gray-5">
                Borra permanentemente el proyecto, todas sus tareas, respuestas, chat y
                archivos. Esta acción <span className="font-semibold">no se puede deshacer</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEliminarInput("");
                setModal("eliminar");
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="ml-4 shrink-0 rounded-lg border border-critique-6 bg-critique-6 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-critique-7"
            >
              <Trash2 className="inline h-4 w-4 mr-1.5 -mt-0.5" strokeWidth={2} />
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALES ── */}

      {/* 1. Cerrar: felicitaciones (100% completadas) */}
      {modal === "cerrar-felicitaciones" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            <div className="mb-1 text-3xl">🎉</div>
            <h2 className="mb-2 text-lg font-bold text-gray-9">¡Proyecto completado!</h2>
            <p className="mb-6 text-sm text-gray-6">
              Todas las tareas están finalizadas. Al cerrar el proyecto quedará en modo
              lectura y se activará la retención de logs.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={loading}
                className="btn btn-ghost rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCerrar}
                disabled={loading}
                className="btn btn-primary rounded-lg disabled:opacity-60"
              >
                {loading ? "Cerrando…" : "Cerrar proyecto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Cerrar: advertencia (hay tareas pendientes) */}
      {modal === "cerrar-advertencia" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-warning-5">
            <AlertTriangle className="mb-2 h-8 w-8 text-warning-6" strokeWidth={2} />
            <h2 className="mb-2 text-lg font-bold text-gray-9">Tareas sin finalizar</h2>
            <p className="mb-2 text-sm text-gray-6">
              Hay{" "}
              <span className="font-semibold text-warning-7">
                {tareasIncompletas} tarea{tareasIncompletas > 1 ? "s" : ""} sin finalizar
              </span>{" "}
              en este proyecto.
            </p>
            <p className="mb-6 text-sm text-gray-5">
              ¿Deseas cerrar el proyecto de todas formas? Las tareas pendientes quedarán
              congeladas en su estado actual.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={loading}
                className="btn btn-ghost rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setModal("cerrar-confirmar")}
                className="rounded-lg border border-warning-5 bg-white px-4 py-2 text-sm font-medium text-warning-7 transition-colors hover:bg-warning-1"
              >
                Continuar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cerrar: confirmación final */}
      {modal === "cerrar-confirmar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-critique-6">
            <Lock className="mb-2 h-8 w-8 text-critique-6" strokeWidth={2} />
            <h2 className="mb-2 text-lg font-bold text-critique-7">¿Confirmar cierre?</h2>
            <p className="mb-6 text-sm text-gray-6">
              El proyecto{" "}
              <span className="font-semibold text-gray-9">{proyecto.nombre_proyecto}</span>{" "}
              pasará a modo lectura. Nadie podrá editar tareas ni asignaciones.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={loading}
                className="btn btn-ghost rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCerrar}
                disabled={loading}
                className="rounded-lg bg-critique-6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-critique-7 disabled:opacity-60"
              >
                {loading ? "Cerrando…" : "Sí, cerrar proyecto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Eliminar: escribir nombre para confirmar */}
      {modal === "eliminar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-critique-6">
            <Trash2 className="mb-2 h-8 w-8 text-critique-6" strokeWidth={2} />
            <h2 className="mb-2 text-lg font-bold text-critique-7">Eliminar proyecto</h2>
            <p className="mb-4 text-sm text-gray-6">
              Esta acción borrará permanentemente el proyecto, todas sus tareas,
              respuestas, archivos y chat. <span className="font-semibold">No se puede deshacer.</span>
            </p>
            <p className="mb-2 text-xs text-gray-6">
              Escribe{" "}
              <span className="rounded bg-gray-1 px-1 font-mono text-gray-9">
                {proyecto.nombre_proyecto}
              </span>{" "}
              para confirmar:
            </p>
            <input
              ref={inputRef}
              type="text"
              value={eliminarInput}
              onChange={(e) => setEliminarInput(e.target.value)}
              className="mb-5 w-full rounded-lg border border-gray-3 px-3 py-2 text-sm focus:border-critique-5 focus:outline-none"
              placeholder={proyecto.nombre_proyecto}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={loading}
                className="btn btn-ghost rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={
                  loading ||
                  eliminarInput.toLowerCase().trim() !==
                    proyecto.nombre_proyecto.toLowerCase().trim()
                }
                className="rounded-lg bg-critique-6 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-critique-7 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
