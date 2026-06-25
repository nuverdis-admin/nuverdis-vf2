"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  saving: boolean;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}

export function RechazarTareaModal({ open, saving, onConfirmar, onCancelar }: Props) {
  const [motivo, setMotivo] = useState("");

  if (!open) return null;

  const motivoValido = motivo.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-modal border-t-4 border-critique-6">
        <h2 className="mb-1 text-base font-bold text-critique-7">Rechazar tarea</h2>
        <p className="mb-4 text-sm text-gray-6">
          La tarea volverá al estado <strong>Retornada</strong> con el motivo indicado.
        </p>
        <label htmlFor="motivo-rechazo" className="mb-1.5 block text-xs font-medium text-gray-5">
          Motivo del rechazo (mínimo 5 caracteres)
        </label>
        <textarea
          id="motivo-rechazo"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Indica qué falta o qué corregir…"
          className="w-full resize-none rounded-md border border-gray-3 bg-white px-3 py-2 text-sm text-gray-8 outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="btn btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!motivoValido || saving}
            onClick={() => onConfirmar(motivo.trim())}
            className="btn bg-critique-6 text-white hover:bg-critique-7 disabled:opacity-50"
          >
            {saving ? "Rechazando…" : "Rechazar"}
          </button>
        </div>
      </div>
    </div>
  );
}
