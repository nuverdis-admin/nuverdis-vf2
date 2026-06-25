"use client";

import { useState } from "react";
import { humanizeSize, iconoMimeColor } from "@/lib/tareas/evidencias-path";
import type { EvidenciaRow } from "@/lib/tareas/types";

interface Props {
  evidencias: EvidenciaRow[];
  tareaId: number;
  canBorrar: (ev: EvidenciaRow) => boolean;
  onBorrar: (ev: EvidenciaRow) => Promise<void> | void;
  onDescargar: (ev: EvidenciaRow, tareaId: number) => Promise<void> | void;
}

export function EvidenciasList({ evidencias, tareaId, canBorrar, onBorrar, onDescargar }: Props) {
  const [confirmarId, setConfirmarId] = useState<number | null>(null);

  if (evidencias.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-2 bg-gray-1 px-4 py-6 text-center text-xs text-gray-5">
        Aún no hay evidencias para esta tarea.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {evidencias.map((ev) => {
        const { letra, color } = iconoMimeColor(ev.mime_type, ev.nombre_archivo);
        const fecha = new Date(ev.created_at).toLocaleDateString("es-CL");
        const puedeBorrar = canBorrar(ev);
        const confirmar = confirmarId === ev.evidencia_id;
        return (
          <div
            key={ev.evidencia_id}
            className="flex items-center gap-3 rounded-lg border border-gray-2 bg-white px-3 py-2 transition-colors hover:border-gray-3"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${color}`}>
              {letra}
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => void onDescargar(ev, tareaId)}
                className="block w-full truncate text-left text-sm font-medium text-gray-8 hover:text-primary-7 hover:underline"
              >
                {ev.nombre_archivo}
              </button>
              <p className="truncate text-[11px] text-gray-5">
                {humanizeSize(ev.size_bytes)} · {ev.uploader_nombre ?? "—"} · {fecha}
              </p>
            </div>
            {puedeBorrar && (
              <div className="shrink-0">
                {confirmar ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        await onBorrar(ev);
                        setConfirmarId(null);
                      }}
                      className="rounded-md bg-critique-6 px-2 py-1 text-[10px] font-semibold text-white hover:bg-critique-7"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarId(null)}
                      className="rounded-md bg-gray-2 px-2 py-1 text-[10px] font-semibold text-gray-7 hover:bg-gray-3"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmarId(ev.evidencia_id)}
                    title="Borrar evidencia"
                    className="rounded-md p-1.5 text-gray-4 transition-colors hover:bg-critique-1 hover:text-critique-7"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
