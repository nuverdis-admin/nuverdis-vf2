"use client";

import { useState } from "react";
import type { PermisoCtx } from "@/lib/tareas/permisos";
import {
  canAprobar,
  canAprobarAdmin,
  canEditarRespuestas,
  canEliminar,
  canEnviarRevision,
  canRechazar,
  tieneContenido,
} from "@/lib/tareas/permisos";
import type { RespuestasMap } from "@/lib/tareas/types";

interface Props {
  ctx: PermisoCtx;
  respuestasBD: RespuestasMap;
  isDirty: boolean;
  saving: boolean;
  bloqueada?: boolean;
  onGuardar: () => void;
  onDeshacer: () => void;
  onEnviarRevision: () => void;
  onAprobar: () => void;
  onRechazar: () => void;
  onAprobarAdmin: () => void;
  onEliminar: () => void;
}

type ModalConfirm = "aprobar" | "aprobar-admin" | null;

export function AccionesBar({
  ctx,
  respuestasBD,
  isDirty,
  saving,
  bloqueada = false,
  onGuardar,
  onDeshacer,
  onEnviarRevision,
  onAprobar,
  onRechazar,
  onAprobarAdmin,
  onEliminar,
}: Props) {
  const [confirmModal, setConfirmModal] = useState<ModalConfirm>(null);

  const editable = canEditarRespuestas(ctx);
  const hayContenido = tieneContenido(respuestasBD);
  const puedeEnviarRevision = canEnviarRevision(ctx, respuestasBD);
  const puedeAprobar = canAprobar(ctx, respuestasBD);
  const puedeRechazar = canRechazar(ctx, respuestasBD);
  const puedeAprobarAdmin = canAprobarAdmin(ctx, respuestasBD);
  const puedeEliminar = canEliminar(ctx) && (ctx.adminModoEdicion || ctx.tarea.estado === "completada");

  const hayAcciones = editable || puedeEnviarRevision || puedeAprobar || puedeRechazar || puedeAprobarAdmin || puedeEliminar;
  if (!hayAcciones) return null;

  const nombreTarea = ctx.tarea.jerarquia_2_nombre ?? ctx.tarea.public_id;

  function handleConfirmar() {
    if (confirmModal === "aprobar") onAprobar();
    else if (confirmModal === "aprobar-admin") onAprobarAdmin();
    setConfirmModal(null);
  }

  return (
    <>
      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-2 rounded-xl border border-gray-2 bg-white p-3 shadow-card">
        {/* Izquierda: Eliminar */}
        <div>
          {puedeEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              disabled={saving || bloqueada}
              className="btn btn-ghost text-critique-7 hover:bg-critique-1 disabled:opacity-50"
            >
              Eliminar tarea
            </button>
          )}
        </div>

        {/* Derecha: Guardar + acciones de estado */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editable && (
            <>
              <button
                type="button"
                onClick={onDeshacer}
                disabled={saving || bloqueada || !isDirty}
                className="btn btn-outline disabled:opacity-50"
              >
                Deshacer
              </button>
              <button
                type="button"
                onClick={onGuardar}
                disabled={saving || bloqueada || !isDirty}
                className="btn btn-primary disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          )}

          {hayContenido && puedeEnviarRevision && (
            <button
              type="button"
              onClick={onEnviarRevision}
              disabled={saving || bloqueada || isDirty}
              title={isDirty ? "Guarda primero los cambios" : undefined}
              className="btn bg-info-5 text-white hover:bg-info-6 disabled:opacity-50"
            >
              Enviar a revisión
            </button>
          )}

          {hayContenido && puedeRechazar && (
            <button
              type="button"
              onClick={onRechazar}
              disabled={saving || bloqueada}
              className="btn bg-critique-6 text-white hover:bg-critique-7 disabled:opacity-50"
            >
              Rechazar
            </button>
          )}

          {hayContenido && puedeAprobar && (
            <button
              type="button"
              onClick={() => setConfirmModal("aprobar")}
              disabled={saving || bloqueada}
              className="btn bg-primary-5 text-white hover:bg-primary-6 disabled:opacity-50"
            >
              Aprobar
            </button>
          )}

          {hayContenido && puedeAprobarAdmin && (
            <button
              type="button"
              onClick={() => setConfirmModal("aprobar-admin")}
              disabled={saving || bloqueada}
              className="btn btn-secondary disabled:opacity-50"
            >
              Aprobar como admin
            </button>
          )}
        </div>
      </div>

      {/* Modal de confirmación de aprobación */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
            <h2 className="mb-2 text-base font-semibold text-gray-9">
              {confirmModal === "aprobar" ? "Aprobar tarea" : "Aprobar como administrador"}
            </h2>
            <p className="mb-6 text-sm text-gray-6">
              ¿Seguro que deseas aprobar la tarea{" "}
              <span className="font-semibold text-gray-9">{nombreTarea}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="btn btn-ghost rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                className="btn btn-primary rounded-lg"
              >
                Sí, aprobar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
