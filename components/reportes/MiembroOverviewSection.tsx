"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  ListTodo,
  Sparkles,
  Send,
  PartyPopper,
  XCircle,
  ArrowRightLeft,
  UserMinus,
  Activity,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";

export interface ProximaTarea {
  tarea_id: string;
  public_id: string;
  estandar: string;
  estandar_nombre?: string | null;
  jerarquia_1: string;
  jerarquia_2: string;
  jerarquia_1_nombre: string | null;
  jerarquia_2_nombre: string | null;
  subtema_nombre?: string | null;
  estado: string;
  tipo?: string;
  fecha_encargado: string | null;
  dias_restantes: number | null;
  atrasada: boolean;
}

export interface ActividadItem {
  log_id: string;
  accion: string;
  created_at: string;
  tarea_public_id: string | null;
  estandar: string | null;
  jerarquia_1: string | null;
  jerarquia_2: string | null;
  jerarquia_1_nombre: string | null;
  tipo?: string | null;
}

export interface SaludData {
  completada: number;
  retornada: number;
  otras: number;
}

export interface MiembroOverviewData {
  total_asignadas: number;
  completadas: number;
  atrasadas: number;
  en_revision: number;
  proximas_tareas: ProximaTarea[];
  actividad_reciente: ActividadItem[];
  salud: SaludData;
}

const REPORTES_DISPONIBLES = [
  { key: "GRI",  label: "GRI" },
  { key: "NCG",  label: "NCG" },
  { key: "SASB", label: "SASB", disabled: true },
];

const ESTADO_BADGE: Record<string, string> = {
  sin_asignar: "badge bg-gray-2 text-gray-6",
  asignada:    "badge text-success-7 border border-success-7 bg-success-1/30",
  en_revision: "badge bg-secondary-2 text-secondary-7",
  completada:  "badge bg-success-1 text-success-7",
  retornada:   "badge bg-warning-1 text-warning-9",
  no_aplica:   "badge bg-gray-1 text-gray-4 border border-gray-3",
};

const ESTADO_LABEL: Record<string, string> = {
  asignada:    "Asignada",
  en_revision: "En revisión",
  completada:  "Completada",
  retornada:   "Retornada",
  sin_asignar: "Sin asignar",
  no_aplica:   "No aplica",
};

type SaludMetaEntry = { key: string; label: string; color: string; dotClass: string; dotStyle?: string; stroke?: string };

// Encargado: completadas → asignadas → retornadas → en revisión
const SALUD_META_ENCARGADO: SaludMetaEntry[] = [
  { key: "completada",      label: "Completadas",  color: "var(--color-success-5)",   dotClass: "bg-success-5" },
  { key: "asignada_sal",    label: "Asignadas",    color: "rgba(102, 188, 159, 0.3)", dotClass: "bg-primary-4", dotStyle: "border border-primary-4 bg-transparent", stroke: "#66BC9F" },
  { key: "retornada",       label: "Retornadas",   color: "var(--color-warning-5)",   dotClass: "bg-warning-5" },
  { key: "en_revision_sal", label: "En revisión",  color: "var(--color-secondary-5)", dotClass: "bg-secondary-5" },
];

// Revisor: completadas → en revisión → próximas (asignadas + retornadas = pendientes de llegar)
const SALUD_META_REVISOR: SaludMetaEntry[] = [
  { key: "completada",      label: "Completadas",  color: "var(--color-success-5)",   dotClass: "bg-success-5" },
  { key: "en_revision_sal", label: "En revisión",  color: "var(--color-secondary-5)", dotClass: "bg-secondary-5" },
  { key: "proximas_sal",    label: "Próximas",     color: "rgba(102, 188, 159, 0.3)", dotClass: "bg-primary-4", dotStyle: "border border-primary-4 bg-transparent", stroke: "#66BC9F" },
];

function formatFecha(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function tiempoRelativo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function getActividadMeta(accion: string): {
  icon: React.ElementType;
  dotClass: string;
  texto: string;
} {
  if (accion.includes("COMPLETA") || accion === "GUARDAR_RESPUESTAS")
    return { icon: PartyPopper, dotClass: "text-success-6", texto: "Tarea completada" };
  if (accion.includes("RETORNA"))
    return { icon: RefreshCw, dotClass: "text-warning-6", texto: "Tarea retornada" };
  if (accion.includes("REVISION") || accion.includes("ENVIAR"))
    return { icon: Send, dotClass: "text-secondary-6", texto: "Enviada a revisión" };
  if (accion.includes("ASIGNA"))
    return { icon: ArrowRightLeft, dotClass: "text-primary-6", texto: "Tarea asignada" };
  if (accion.includes("EXCLUSION") || accion.includes("EXCLU"))
    return { icon: UserMinus, dotClass: "text-warning-6", texto: "Solicitud de exclusión" };
  if (accion.includes("DERIVACION") || accion.includes("DERIVA"))
    return { icon: ArrowRightLeft, dotClass: "text-secondary-6", texto: "Solicitud de derivación" };
  if (accion.includes("CANCEL") || accion.includes("RECHA"))
    return { icon: XCircle, dotClass: "text-critique-6", texto: "Acción rechazada" };
  return { icon: Activity, dotClass: "text-gray-5", texto: accion };
}

export function MiembroOverviewSection({
  data: initialData,
  proyectoRef,
  proyectoId,
  reportesHabilitados,
}: {
  data: MiembroOverviewData & { rol: "encargado" | "revisor" };
  proyectoRef: string;
  proyectoId: string;
  reportesHabilitados: string[];
}) {
  const router = useRouter();
  const setTareasFiltroOverview = useAuthStore((s) => s.setTareasFiltroOverview);

  const [data, setData] = useState(initialData);
  const [selectedReportes, setSelectedReportes] = useState<string[]>(reportesHabilitados);
  const [pillLoading, setPillLoading] = useState(false);
  const [filtroDonut, setFiltroDonut] = useState<Set<string>>(new Set());

  const rol = initialData.rol;
  const pillsVisibles = REPORTES_DISPONIBLES.filter(
    (r) => r.disabled || reportesHabilitados.includes(r.key)
  );
  // navegación KPI solo cuando hay un único tipo activo
  const tipoRuta = selectedReportes.length === 1 ? selectedReportes[0].toLowerCase() : null;

  function irConFiltro(estados: string[]) {
    if (!tipoRuta) return;
    setTareasFiltroOverview(estados);
    router.push(`/dashboard/proyecto/${proyectoRef}/${tipoRuta}/seguimiento`);
  }

  async function fetchParaTipos(tipos: string[]) {
    if (tipos.length === 0) return;
    setPillLoading(true);
    const { data: raw } = await createClient().rpc("overview_miembro_proyecto", {
      p_proyecto_id: proyectoId,
      p_tipos: tipos,
    });
    const nuevo = (Array.isArray(raw) ? raw[0] : raw) as MiembroOverviewData | null;
    if (nuevo) setData({ ...nuevo, rol });
    setPillLoading(false);
  }

  function togglePill(key: string) {
    setSelectedReportes((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (next.length === 0) return prev;
      void fetchParaTipos(next);
      return next;
    });
  }

  function toggleFiltroDonut(key: string) {
    setFiltroDonut((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const tareasRol =
    rol === "encargado"
      ? data.total_asignadas - data.completadas - data.en_revision
      : data.en_revision;

  const saludMeta = rol === "encargado" ? SALUD_META_ENCARGADO : SALUD_META_REVISOR;

  // asignada_sal = otras (asignada+en_revision) - en_revision
  const saludAsignada = Math.max(0, data.salud.otras - data.en_revision);
  const saludValues: Record<string, number> = {
    completada:       data.salud.completada,
    retornada:        data.salud.retornada,
    otras:            data.salud.otras,
    asignada_sal:     saludAsignada,
    en_revision_sal:  data.en_revision,
    proximas_sal:     saludAsignada + data.salud.retornada,
  };

  const saludChartAll = saludMeta.map((m) => ({
    ...m,
    value: saludValues[m.key] ?? 0,
  })).filter((d) => d.value > 0);

  const saludChart =
    filtroDonut.size > 0
      ? saludChartAll.filter((d) => !filtroDonut.has(d.key))
      : saludChartAll;

  const saludTotal = data.salud.completada + data.salud.retornada + data.salud.otras;
  const filtroTotal = saludChart.reduce((acc, d) => acc + d.value, 0);
  const pctCompleta =
    saludTotal > 0 ? Math.round((data.salud.completada / saludTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header con pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-8">Tu progreso</h2>
        <div className="flex items-center gap-2">
          {pillLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-4" strokeWidth={2} />}
          <div className="flex gap-1.5">
            {pillsVisibles.map((r) => {
              const isDisabled = "disabled" in r;
              const isActive = selectedReportes.includes(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && togglePill(r.key)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    isDisabled
                      ? "cursor-not-allowed bg-gray-1 text-gray-4"
                      : isActive
                      ? "bg-primary-5 text-white"
                      : "bg-gray-1 text-gray-5 hover:bg-gray-2"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div
          role="button"
          onClick={() => irConFiltro(rol === "encargado" ? ["asignada", "retornada"] : ["en_revision"])}
          className={`rounded-xl border border-primary-3 bg-primary-1 p-4 shadow-card transition-all hover:scale-[1.02] hover:shadow-md ${tipoRuta ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-primary-6">
                {rol === "encargado" ? "Pendientes" : "En revisión"}
              </span>
              <span className="text-[10px] font-normal text-primary-5">
                {rol === "encargado" ? "(asignadas/retornadas)" : "(en revisión)"}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-2">
              <Clock className="h-3.5 w-3.5 text-primary-7" strokeWidth={2} />
            </div>
          </div>
          <p className="text-3xl font-bold text-primary-7">{tareasRol}</p>
        </div>

        <div
          role="button"
          onClick={() => irConFiltro(["completada"])}
          className={`rounded-xl border border-gray-2 bg-white p-4 shadow-card transition-all hover:scale-[1.02] hover:shadow-md ${tipoRuta ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-5">Completadas</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-1">
              <Sparkles className="h-3.5 w-3.5 text-success-6" strokeWidth={2} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-9">{data.completadas}</p>
          {data.total_asignadas > 0 && (
            <p className="mt-0.5 text-xs font-medium text-success-7">
              {Math.round((data.completadas / data.total_asignadas) * 100)}% del total
            </p>
          )}
        </div>

        <div
          role="button"
          onClick={() => irConFiltro(["__atrasadas__"])}
          className={`rounded-xl border p-4 shadow-card transition-all hover:scale-[1.02] hover:shadow-md ${
            data.atrasadas > 0 ? "border-critique-3 bg-critique-1" : "border-gray-2 bg-white"
          } ${tipoRuta ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className={`text-xs font-medium ${data.atrasadas > 0 ? "text-critique-6" : "text-gray-5"}`}>
              Atrasadas
            </span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${data.atrasadas > 0 ? "bg-critique-2" : "bg-gray-1"}`}>
              <AlertTriangle
                className={`h-3.5 w-3.5 ${data.atrasadas > 0 ? "text-critique-7" : "text-gray-4"}`}
                strokeWidth={2}
              />
            </div>
          </div>
          <p className={`text-3xl font-bold ${data.atrasadas > 0 ? "text-critique-7" : "text-gray-9"}`}>
            {data.atrasadas}
          </p>
          {data.total_asignadas > 0 && (
            <p className={`mt-0.5 text-xs font-medium ${data.atrasadas > 0 ? "text-critique-6" : "text-gray-5"}`}>
              {Math.round((data.atrasadas / data.total_asignadas) * 100)}% del total
            </p>
          )}
        </div>

        <div
          role="button"
          onClick={() => irConFiltro(["asignada", "retornada", "en_revision", "completada"])}
          className={`rounded-xl border border-gray-2 bg-white p-4 shadow-card transition-all hover:scale-[1.02] hover:shadow-md ${tipoRuta ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-5">Mis tareas</span>
              <span className="text-[10px] font-normal text-gray-4">(en cualquier estado)</span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-1">
              <ListTodo className="h-3.5 w-3.5 text-secondary-6" strokeWidth={2} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-9">{data.total_asignadas}</p>
        </div>
      </div>

      {/* Cuerpo principal */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        {/* Columna izquierda — 2/3 */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Próximas tareas */}
          <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
            <p className="mb-4 text-sm font-semibold text-gray-8">Próximas tareas</p>
            {!data.proximas_tareas || data.proximas_tareas.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-4">
                No tienes tareas pendientes próximamente.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-1">
                {(data.proximas_tareas ?? []).map((tarea) => {
                  const tipoTarea = (tarea.tipo ?? tipoRuta ?? "gri").toLowerCase();
                  return (
                    <Link
                      key={tarea.public_id}
                      href={`/dashboard/proyecto/${proyectoRef}/${tipoTarea}/seguimiento/${tarea.public_id}`}
                      className="flex items-center gap-3 py-3 hover:bg-gray-1 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        {tarea.tipo === "NCG" ? (
                          // NCG: nombre específico en título, estandar_nombre como contexto gris
                          <>
                            <p className="truncate text-xs font-semibold text-gray-8">
                              {tarea.jerarquia_2 === "0" ? tarea.jerarquia_1 : `${tarea.jerarquia_1}-${tarea.jerarquia_2}`}
                              {" "}
                              <span className="font-medium text-gray-7">
                                {tarea.jerarquia_2 === "0"
                                  ? tarea.jerarquia_1_nombre
                                  : (tarea.jerarquia_2_nombre ?? tarea.jerarquia_1_nombre)}
                              </span>
                              {selectedReportes.length > 1 && (
                                <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold bg-gray-1 text-gray-5">NCG</span>
                              )}
                            </p>
                            {tarea.estandar_nombre && (
                              <p className="truncate text-[11px] text-gray-4">{tarea.estandar_nombre}</p>
                            )}
                          </>
                        ) : (
                          // GRI: j1_nombre en título (contexto), j2_nombre como subtítulo específico
                          <>
                            <p className="truncate text-xs font-semibold text-gray-8">
                              {`${tarea.jerarquia_1}-${tarea.jerarquia_2}`}
                              {tarea.jerarquia_1_nombre && (
                                <span className="ml-1 font-medium text-gray-7">{tarea.jerarquia_1_nombre}</span>
                              )}
                              {selectedReportes.length > 1 && tarea.tipo && (
                                <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold bg-gray-1 text-gray-5">
                                  {tarea.tipo}
                                </span>
                              )}
                            </p>
                            {tarea.jerarquia_2_nombre && (
                              <p className="truncate text-[11px] text-gray-5">{tarea.jerarquia_2_nombre}</p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {tarea.fecha_encargado && (
                          <span className="text-[10px] text-gray-4">
                            {formatFecha(tarea.fecha_encargado)}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          {tarea.atrasada ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-critique-6">
                              <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                              Atrasada
                            </span>
                          ) : tarea.dias_restantes !== null ? (
                            <span className="flex items-center gap-1 text-[11px] text-gray-4">
                              <Clock className="h-3 w-3" strokeWidth={2} />
                              {tarea.dias_restantes}d
                            </span>
                          ) : null}
                        </div>
                        <span className={ESTADO_BADGE[tarea.estado] ?? "badge bg-gray-2 text-gray-6"}>
                          {ESTADO_LABEL[tarea.estado] ?? tarea.estado}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
            <p className="mb-4 text-sm font-semibold text-gray-8">Tu actividad reciente (general)</p>
            {!data.actividad_reciente || data.actividad_reciente.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-4">Sin actividad reciente.</p>
            ) : (
              <div className="flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
                {(data.actividad_reciente ?? []).map((log, idx) => {
                  const meta = getActividadMeta(log.accion);
                  const Icon = meta.icon;
                  return (
                    <div
                      key={log.log_id || `log-${idx}`}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-1"
                    >
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.dotClass}`} strokeWidth={2} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-8">
                          {meta.texto}
                          {log.tarea_public_id && (log.jerarquia_1 || log.jerarquia_1_nombre) && (
                            <span className="ml-1 font-normal text-gray-5">
                              · {log.jerarquia_1}{log.jerarquia_2 ? `-${log.jerarquia_2}` : ""}{log.jerarquia_1_nombre ? ` ${log.jerarquia_1_nombre}` : ""}
                              {log.tipo && (selectedReportes.length > 1 || !selectedReportes.includes(log.tipo)) && (
                                <span className="ml-1 text-[10px] font-semibold text-gray-4">
                                  [{log.tipo}]
                                </span>
                              )}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-4">{tiempoRelativo(log.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha — 1/3 */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-8">Salud de mis tareas</p>
              {filtroDonut.size > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroDonut(new Set())}
                  className="text-[11px] text-primary-6 hover:text-primary-7 hover:underline"
                >
                  Mostrar todo
                </button>
              )}
            </div>
            {saludTotal === 0 ? (
              <p className="py-6 text-center text-sm text-gray-4">Sin datos aún.</p>
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={saludChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        dataKey="value"
                        paddingAngle={saludChart.length > 1 ? 2 : 0}
                        animationDuration={300}
                      >
                        {saludChart.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.color}
                            {...(entry.stroke ? { stroke: entry.stroke, strokeWidth: 1 } : {})}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [value as number, name as string]}
                        contentStyle={{
                          fontSize: "12px",
                          borderRadius: "8px",
                          border: "1px solid var(--color-gray-2)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    {filtroDonut.size > 0 ? (
                      <>
                        <p className="text-2xl font-bold text-gray-9">{filtroTotal}</p>
                        <p className="text-xs text-gray-5">de {saludTotal}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-gray-9">{pctCompleta}%</p>
                        <p className="text-xs text-gray-5">completado</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1">
                  {saludMeta.map((m, idx) => {
                    const val = saludValues[m.key] ?? 0;
                    const isHidden = filtroDonut.has(m.key);
                    return (
                      <button
                        key={`salud-${idx}`}
                        type="button"
                        onClick={() => toggleFiltroDonut(m.key)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all ${
                          isHidden ? "opacity-40" : "hover:bg-gray-1"
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isHidden ? "bg-gray-3" : (m.dotStyle ?? m.dotClass)}`} />
                        <span className={`truncate ${isHidden ? "text-gray-4 line-through" : "text-gray-6"}`}>{m.label}</span>
                        <span className={`ml-auto font-semibold ${isHidden ? "text-gray-4" : "text-gray-8"}`}>{val}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
