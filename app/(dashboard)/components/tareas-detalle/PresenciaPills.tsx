"use client";

import type { PresenciaUser } from "@/lib/tareas/types";

interface Props {
  presentes: PresenciaUser[];
  adminModoEdicion?: boolean;
}

const MAX_VISIBLE = 5;

export function PresenciaPills({ presentes, adminModoEdicion }: Props) {
  if (presentes.length === 0) return null;

  const visible = presentes.slice(0, MAX_VISIBLE);
  const ocultos = presentes.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((u) => {
        const inicial = (u.nombre.trim().charAt(0) || "?").toUpperCase();
        const esAdminObservando = u.rol === "administrador" && !adminModoEdicion;
        return (
          <div
            key={u.uid}
            title={`${u.nombre}${esAdminObservando ? " — Observando" : " — En línea"}`}
            className="flex items-center gap-1 rounded-full bg-success-1 px-2 py-0.5"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-5 text-[9px] font-bold text-white">
              {inicial}
            </span>
            <span className="max-w-[72px] truncate text-[11px] font-medium text-success-7">
              {esAdminObservando ? "Observando" : u.nombre.split(" ")[0]}
            </span>
          </div>
        );
      })}
      {ocultos > 0 && (
        <span className="rounded-full bg-gray-2 px-2 py-0.5 text-[11px] text-gray-6">
          +{ocultos} más
        </span>
      )}
    </div>
  );
}
