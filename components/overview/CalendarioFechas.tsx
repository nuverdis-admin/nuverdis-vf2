"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar, Users, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FechaTarea {
  fecha: string;
  tipo: "GRI" | "NCG";
  titulo: string;
  estado: string;
  public_id: string;
  rol: "encargado" | "revisor";
  jerarquia_1: string | null;
  jerarquia_2: string | null;
  jerarquia_1_nombre: string | null;
  jerarquia_2_nombre: string | null;
  equipo_nombre: string | null;
  fecha_encargado: string | null;
  fecha_revisor: string | null;
}

type EventosPorDia = Record<string, FechaTarea[]>;

const TIPO_CSS: Record<string, string> = {
  GRI: "var(--color-primary-5)",
  NCG: "var(--color-secondary-5)",
};
const ROL_CSS: Record<string, string> = {
  encargado: "var(--color-warning-5)",
  revisor: "#c4b5fd",
};
const TIPO_DOT: Record<string, string> = {
  GRI: "bg-primary-5",
  NCG: "bg-secondary-5",
};
const ROL_DOT: Record<string, string> = {
  encargado: "bg-warning-5",
  revisor: "bg-violet-300",
};
const ROL_LABEL: Record<string, string> = {
  encargado: "Encargado",
  revisor: "Revisor",
};
const ESTADO_BADGE: Record<string, string> = {
  sin_asignar: "bg-gray-2 text-gray-6",
  asignada:    "text-success-7 border border-success-7 bg-success-1/30",
  en_revision: "bg-secondary-2 text-secondary-7",
  completada:  "bg-success-1 text-success-7",
  retornada:   "bg-warning-1 text-warning-9",
  no_aplica:   "bg-gray-1 text-gray-4 border border-gray-3",
};
const ESTADO_LABEL: Record<string, string> = {
  sin_asignar: "Sin asignar",
  asignada:    "Asignada",
  en_revision: "En revisión",
  completada:  "Completada",
  retornada:   "Retornada",
  no_aplica:   "No aplica",
};

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function mesKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getCeldas(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const totalDias = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= totalDias; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function navMes(y: number, m: number, delta: number) {
  let nm = m + delta, ny = y;
  if (nm < 0) { nm = 11; ny--; }
  if (nm > 11) { nm = 0; ny++; }
  return { y: ny, m: nm };
}
function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Modal de detalle del día ────────────────────────────────────────────────

function ModalDia({
  dia,
  evts,
  proyectoRef,
  multiTipo,
  onClose,
}: {
  dia: Date;
  evts: FechaTarea[];
  proyectoRef: string;
  multiTipo: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white shadow-modal border-t-4 border-primary-5 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-1 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary-6" strokeWidth={2} />
            <span className="text-sm font-semibold text-gray-9">
              {dia.getDate()} de {MESES_ES[dia.getMonth()]} {dia.getFullYear()}
            </span>
            <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs font-medium text-gray-6">
              {evts.length} tarea{evts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-4 hover:bg-gray-1 hover:text-gray-7 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Lista tareas */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {evts.map((e, i) => {
            const href = `/dashboard/proyecto/${proyectoRef}/${e.tipo.toLowerCase()}/seguimiento/${e.public_id}`;
            const badgeCls = ESTADO_BADGE[e.estado] ?? "bg-gray-2 text-gray-6";
            const badgeLbl = ESTADO_LABEL[e.estado] ?? e.estado;

            return (
              <div key={i} className="rounded-xl border border-gray-2 bg-gray-1/40 p-4 flex flex-col gap-3">
                {/* Fila superior: pill tipo+rol + badge estado */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {multiTipo ? (
                      /* Pill diagonal tipo / rol — solo cuando hay múltiples tipos activos */
                      <>
                        <span
                          className="h-4 w-7 shrink-0 rounded-full"
                          style={{
                            background: `linear-gradient(to bottom right, ${TIPO_CSS[e.tipo]} 50%, ${ROL_CSS[e.rol]} 50%)`,
                          }}
                          title={`${e.tipo} · ${ROL_LABEL[e.rol]}`}
                        />
                        <span className="text-xs font-semibold text-gray-7">{e.tipo}</span>
                        <span className="text-gray-3 text-xs">·</span>
                      </>
                    ) : (
                      /* Un solo tipo — solo mostrar dot de color del tipo */
                      <span className={`h-2.5 w-2.5 rounded-full ${TIPO_DOT[e.tipo]}`} />
                    )}
                    <span className={`h-2 w-2 rounded-full ${ROL_DOT[e.rol]}`} />
                    <span className="text-xs text-gray-6">{ROL_LABEL[e.rol]}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}>
                    {badgeLbl}
                  </span>
                </div>

                {/* Jerarquías */}
                <div>
                  {e.jerarquia_1_nombre && (
                    <p className="text-[11px] font-medium text-gray-5 leading-tight">
                      {e.jerarquia_1 && <span className="font-semibold text-gray-6">{e.jerarquia_1} </span>}
                      {e.jerarquia_1_nombre}
                    </p>
                  )}
                  {e.jerarquia_2_nombre && e.jerarquia_2_nombre !== e.jerarquia_1_nombre && (
                    <p className="mt-0.5 text-sm font-semibold text-gray-9 leading-snug">
                      {e.jerarquia_2 && <span className="text-gray-5 font-medium">{e.jerarquia_2} </span>}
                      {e.jerarquia_2_nombre}
                    </p>
                  )}
                  {!e.jerarquia_2_nombre && (
                    <p className="mt-0.5 text-sm font-semibold text-gray-9 leading-snug">{e.titulo}</p>
                  )}
                </div>

                {/* Equipo + fechas */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {e.equipo_nombre && (
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-gray-4" strokeWidth={2} />
                      <span className="text-xs text-gray-6">{e.equipo_nombre}</span>
                    </div>
                  )}
                  {e.fecha_encargado && (
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${ROL_DOT.encargado}`} />
                      <span className="text-xs text-gray-5">Enc:</span>
                      <span className="text-xs font-medium text-gray-7">{formatFecha(e.fecha_encargado)}</span>
                    </div>
                  )}
                  {e.fecha_revisor && (
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${ROL_DOT.revisor}`} />
                      <span className="text-xs text-gray-5">Rev:</span>
                      <span className="text-xs font-medium text-gray-7">{formatFecha(e.fecha_revisor)}</span>
                    </div>
                  )}
                </div>

                {/* Link a detalle */}
                {e.public_id && (
                  <a
                    href={href}
                    className={`flex items-center gap-1 text-[11px] font-medium hover:underline w-fit ${e.tipo === "NCG" ? "text-secondary-6" : "text-primary-6"}`}
                  >
                    Ver tarea <ArrowRight className="h-3 w-3" strokeWidth={2} />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full btn btn-outline rounded-lg text-sm py-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export function CalendarioFechas({
  proyectoId,
  proyectoRef,
  reportesHabilitados,
}: {
  proyectoId: string;
  proyectoRef: string;
  reportesHabilitados: string[];
}) {
  const [mesActual, setMesActual] = useState<{ y: number; m: number } | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [minKey, setMinKey] = useState("");
  const [maxKey, setMaxKey] = useState("");
  const [eventos, setEventos] = useState<EventosPorDia>({});
  const [loading, setLoading] = useState(true);
  const [modalDia, setModalDia] = useState<{ key: string; dia: Date } | null>(null);

  // Clave estable de los tipos activos para detectar cambios de pill
  const tiposKey = reportesHabilitados
    .filter((r) => r === "GRI" || r === "NCG")
    .sort()
    .join(",");

  useEffect(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const tk = toDateKey(hoy);
    const mk = mesKey(hoy.getFullYear(), hoy.getMonth());
    setTodayKey(tk);
    setMinKey(mk);
    setMaxKey(mk);
    // Solo inicializar el mes en el primer render
    setMesActual((prev) => prev ?? { y: hoy.getFullYear(), m: hoy.getMonth() });
    setModalDia(null);

    const tipos = tiposKey ? tiposKey.split(",") : [];
    if (tipos.length === 0) { setEventos({}); setLoading(false); return; }

    setLoading(true);
    createClient()
      .rpc("get_fechas_calendario_proyecto", { p_proyecto_id: proyectoId, p_tipos: tipos })
      .then(({ data }: { data: FechaTarea[] | null }) => {
        if (data) {
          const grouped: EventosPorDia = {};
          let maxF = "";
          for (const row of data) {
            if (!row.fecha) continue;
            grouped[row.fecha] = [...(grouped[row.fecha] ?? []), row];
            if (row.fecha > maxF) maxF = row.fecha;
          }
          setEventos(grouped);
          if (maxF) {
            const mk2 = maxF.slice(0, 7);
            setMaxKey(mk2 >= mk ? mk2 : mk);
          }
        } else {
          setEventos({});
        }
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, tiposKey]);

  if (loading || !mesActual) {
    return (
      <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-52 animate-pulse rounded bg-gray-2" />
          <div className="h-7 w-44 animate-pulse rounded-lg bg-gray-2" />
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-1" />
          ))}
        </div>
      </div>
    );
  }

  if (Object.keys(eventos).length === 0) return null;

  const curKey = mesKey(mesActual.y, mesActual.m);
  const canPrev = curKey > minKey;
  const canNext = curKey < maxKey;
  const celdas = getCeldas(mesActual.y, mesActual.m);

  function nav(delta: number) {
    setMesActual((p) => p ? navMes(p.y, p.m, delta) : p);
    setModalDia(null);
  }

  const todosEventos = Object.values(eventos).flat();
  const tiposPresentes = Array.from(new Set(todosEventos.map((e) => e.tipo)));
  const rolesPresentes = Array.from(new Set(todosEventos.map((e) => e.rol)));
  const multiTipo = tiposPresentes.length > 1;

  const modalEvts = modalDia ? (eventos[modalDia.key] ?? []) : [];

  return (
    <>
      <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-8">Calendario de fechas límite</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {tiposPresentes.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-gray-6">
                  <span className={`h-2.5 w-2.5 rounded-full ${TIPO_DOT[t]}`} />{t}
                </span>
              ))}
              {tiposPresentes.length > 0 && rolesPresentes.length > 0 && (
                <span className="text-gray-3 text-xs">·</span>
              )}
              {rolesPresentes.map((r) => (
                <span key={r} className="flex items-center gap-1.5 text-xs font-medium text-gray-6">
                  <span className={`h-2.5 w-2.5 rounded-full ${ROL_DOT[r]}`} />{ROL_LABEL[r]}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => nav(-1)}
              disabled={!canPrev}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-2 text-gray-5 transition-colors hover:bg-gray-1 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <span className="min-w-[128px] text-center text-sm font-medium text-gray-8">
              {MESES_ES[mesActual.m]} {mesActual.y}
            </span>
            <button
              type="button"
              onClick={() => nav(1)}
              disabled={!canNext}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-2 text-gray-5 transition-colors hover:bg-gray-1 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Cabecera días */}
        <div className="mb-1 grid grid-cols-7">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-medium text-gray-4">{d}</div>
          ))}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7">
          {celdas.map((dia, idx) => {
            if (!dia) return <div key={`pad-${idx}`} className="min-h-[58px]" />;

            const k = toDateKey(dia);
            const esHoy = k === todayKey;
            const esPasado = k < todayKey;
            const evts = eventos[k] ?? [];
            const griN = evts.filter((e) => e.tipo === "GRI").length;
            const ncgN = evts.filter((e) => e.tipo === "NCG").length;
            const tieneEvts = evts.length > 0;
            const seleccionado = modalDia?.key === k;

            return (
              <div
                key={k}
                onClick={() => tieneEvts && setModalDia(seleccionado ? null : { key: k, dia })}
                className={`relative flex min-h-[58px] flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors
                  ${tieneEvts ? "cursor-pointer hover:bg-primary-1" : ""}
                  ${seleccionado ? "bg-primary-1 ring-2 ring-primary-3 ring-inset" : ""}
                `}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    esHoy
                      ? "bg-gray-8 text-white"
                      : esPasado && !tieneEvts
                      ? "text-gray-3"
                      : "text-gray-7"
                  }`}
                >
                  {dia.getDate()}
                </span>

                {esHoy && (
                  <span className="text-[8px] font-bold leading-none text-gray-6">HOY</span>
                )}

                {tieneEvts && (
                  <div className="flex gap-0.5">
                    {griN > 0 && (
                      <span className="flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary-5 px-1 text-[9px] font-bold leading-none text-white">
                        {griN}
                      </span>
                    )}
                    {ncgN > 0 && (
                      <span className="flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-secondary-5 px-1 text-[9px] font-bold leading-none text-white">
                        {ncgN}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {Object.keys(eventos).length > 0 && (
          <p className="mt-3 text-center text-[11px] text-gray-4">
            Haz clic en un día con tareas para ver el detalle
          </p>
        )}
      </div>

      {modalDia && modalEvts.length > 0 && (
        <ModalDia
          dia={modalDia.dia}
          evts={modalEvts}
          proyectoRef={proyectoRef}
          multiTipo={multiTipo}
          onClose={() => setModalDia(null)}
        />
      )}
    </>
  );
}
