"use client";

import { Fragment, useState, useEffect } from "react";
import { Info } from "lucide-react";
import type { RequerimientoItem, RespuestasMap, RespuestaLetra } from "@/lib/tareas/types";
import { GriTableInput, parseGriTableData } from "./GriTableInput";

interface Props {
  requerimientos: RequerimientoItem[];
  respuestas: RespuestasMap;
  disabled: boolean;
  onChangeLetra: (letra: string, patch: Partial<RespuestaLetra>) => void;
}

function getLetra(map: RespuestasMap, letra: string): RespuestaLetra {
  return map[letra] ?? { aplica: true, contenido: "", borrador: "" };
}

function OrientacionModal({ letra, requerimiento, texto }: { letra: string; requerimiento: string; texto: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 inline-flex translate-y-0.5 items-center text-primary-5 hover:text-primary-7 focus:outline-none"
        aria-label="Ver orientación"
      >
        <Info className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-modal border-t-4 border-primary-5" style={{ maxHeight: "500px" }}>
            <div className="shrink-0 flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-1">
                  <Info className="h-4 w-4 text-primary-6" strokeWidth={2} />
                </span>
                <h3 className="text-base font-semibold text-gray-9">Orientación</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-5 hover:bg-gray-1 hover:text-gray-8 focus:outline-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <div className="mb-3 flex gap-3">
                <span className="shrink-0 text-sm font-medium text-primary-6">{letra})</span>
                <span className="text-sm font-medium text-gray-8">{requerimiento}</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-7">{texto}</p>
            </div>

            <div className="shrink-0 flex justify-end px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-outline rounded-lg text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RequerimientoCard({
  r,
  respuestas,
  disabled,
  onChangeLetra,
}: {
  r: RequerimientoItem;
  respuestas: RespuestasMap;
  disabled: boolean;
  onChangeLetra: (letra: string, patch: Partial<RespuestaLetra>) => void;
}) {
  const valor = getLetra(respuestas, r.letra);
  const esTabla = r.tabla && typeof r.tabla === "string";
  const noAplica = valor.aplica === false;

  return (
    <div className="rounded-xl border border-gray-2 bg-white p-4 transition-colors hover:border-gray-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-1">
          <span className="shrink-0 w-5 text-sm font-semibold text-primary-6">{r.letra})</span>
          <span className="whitespace-pre-line text-sm font-semibold text-gray-9">
            {r.requerimiento_letra}
            {r.orientacion && (
              <OrientacionModal letra={r.letra} requerimiento={r.requerimiento_letra} texto={r.orientacion} />
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {esTabla && (
            <span className="badge bg-info-1 text-info-7 border border-info-3">
              Tabla {r.tabla}
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-6">
            <input
              type="checkbox"
              checked={valor.aplica !== false}
              onChange={(e) => onChangeLetra(r.letra, { aplica: e.target.checked })}
              disabled={disabled}
              className="h-3.5 w-3.5 rounded accent-primary-5 disabled:cursor-not-allowed"
            />
            Aplica
          </label>
        </div>
      </div>

      {noAplica ? (
        <p className="rounded-md bg-gray-1 px-3 py-2 text-xs italic text-gray-4">
          Marcaste &lsquo;no aplica&rsquo; — sin contenido
        </p>
      ) : esTabla ? (
        <GriTableInput
          tableId={r.tabla as string}
          value={parseGriTableData(valor.contenido ?? "", r.tabla as string)}
          onChange={(next) => onChangeLetra(r.letra, { contenido: JSON.stringify(next) })}
          disabled={disabled}
        />
      ) : (
        <textarea
          rows={4}
          value={valor.contenido ?? ""}
          onChange={(e) => onChangeLetra(r.letra, { contenido: e.target.value })}
          disabled={disabled}
          placeholder="Escribe tu respuesta…"
          className="w-full resize-y rounded-md border border-gray-3 bg-white px-3 py-2 text-sm text-gray-8 outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 disabled:cursor-not-allowed disabled:bg-gray-1 disabled:text-gray-5"
        />
      )}
    </div>
  );
}

export function RespuestasForm({ requerimientos, respuestas, disabled, onChangeLetra }: Props) {
  const [tabActiva, setTabActiva] = useState<string>("");

  useEffect(() => {
    if (requerimientos && requerimientos.length > 0 && !tabActiva) {
      setTabActiva(requerimientos[0].letra);
    }
  }, [requerimientos, tabActiva]);

  if (!requerimientos || requerimientos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-3 bg-gray-1 p-6 text-center text-sm text-gray-5">
        Esta tarea no tiene requerimientos por letra registrados.
      </div>
    );
  }

  const requerimientoActivo = requerimientos.find((r) => r.letra === tabActiva);

  return (
    <>
      {/* ── Mobile: tabs por letra ── */}
      <div className="md:hidden">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-2 bg-gray-1 p-1 [scrollbar-width:none]">
          {requerimientos.map((r) => {
            const valor = getLetra(respuestas, r.letra);
            const tieneDatos = valor.aplica === false || (valor.contenido?.trim() ?? "").length > 0;
            return (
              <button
                key={r.letra}
                type="button"
                onClick={() => setTabActiva(r.letra)}
                className={`relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  tabActiva === r.letra
                    ? "bg-white text-primary-7 shadow-sm"
                    : "text-gray-5 hover:text-gray-8"
                }`}
              >
                {r.letra}
                {tieneDatos && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-5" />
                )}
              </button>
            );
          })}
        </div>

        {requerimientoActivo && (
          <div className="mt-3">
            <RequerimientoCard
              r={requerimientoActivo}
              respuestas={respuestas}
              disabled={disabled}
              onChangeLetra={onChangeLetra}
            />
          </div>
        )}
      </div>

      {/* ── Desktop: todos apilados ── */}
      <div className="hidden md:flex flex-col gap-4">
        {requerimientos.map((r, idx) => {
          const subtemaPrev = idx > 0 ? requerimientos[idx - 1].subtema_nombre : null;
          const mostrarSubtema = !!r.subtema_nombre && r.subtema_nombre !== subtemaPrev;
          return (
            <Fragment key={r.letra}>
              {mostrarSubtema && (
                <p className="mb-0 mt-2 text-sm font-semibold text-gray-9 first:mt-0">
                  {r.subtema_nombre}
                </p>
              )}
              <RequerimientoCard
                r={r}
                respuestas={respuestas}
                disabled={disabled}
                onChangeLetra={onChangeLetra}
              />
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
