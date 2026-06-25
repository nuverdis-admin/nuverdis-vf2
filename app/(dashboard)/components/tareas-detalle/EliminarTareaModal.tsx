"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  saving: boolean;
  tareaNombre: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function EliminarTareaModal({
  open,
  saving,
  tareaNombre,
  onConfirmar,
  onCancelar,
}: Props) {
  const [fase, setFase] = useState<1 | 2>(1);

  if (!open) return null;

  function cancelar() {
    setFase(1);
    onCancelar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-critique-6">
        <h2 className="mb-2 text-base font-bold text-critique-7">Eliminar tarea</h2>
        {fase === 1 ? (
          <>
            <p className="text-sm text-gray-7">
              Vas a eliminar la tarea <strong>{tareaNombre}</strong>. Se borrarán las respuestas,
              evidencias e historial asociado. Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cancelar} className="btn btn-ghost">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setFase(2)}
                className="btn bg-critique-6 text-white hover:bg-critique-7"
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-7">
              ¿Confirmas que quieres eliminar esta tarea de forma definitiva?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cancelar} className="btn btn-ghost">
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onConfirmar}
                className="btn bg-critique-6 text-white hover:bg-critique-7 disabled:opacity-50"
              >
                {saving ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
