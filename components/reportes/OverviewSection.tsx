"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { OverviewStats } from "@/lib/reportes";
import type { EquipoStats, ActividadLog } from "@/lib/proyecto/data";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { CalendarioFechas } from "@/components/overview/CalendarioFechas";

const DONUT_META: Array<{
  key: keyof OverviewStats;
  label: string;
  color: string;
  dotClass: string;
  dotStyle?: string;
  stroke?: string;
}> = [
  { key: "sin_asignar",  label: "Sin asignar",  color: "var(--color-gray-4)",       dotClass: "bg-gray-4"                                                                       },
  { key: "asignada",     label: "Asignada",      color: "rgba(102, 188, 159, 0.3)", dotClass: "bg-primary-4",  dotStyle: "border border-primary-4 bg-transparent", stroke: "#66BC9F" },
  { key: "en_revision",  label: "En revisión",   color: "var(--color-secondary-5)", dotClass: "bg-secondary-5"                                                                   },
  { key: "completada",   label: "Completada",    color: "var(--color-success-5)",   dotClass: "bg-success-5"                                                                     },
  { key: "retornada",    label: "Retornada",     color: "var(--color-warning-5)",   dotClass: "bg-warning-5"                                                                     },
  { key: "no_aplica",    label: "No aplica",     color: "var(--color-gray-3)",      dotClass: "bg-gray-3"                                                                        },
];

const BARRA_ESTADOS: Array<{
  key: keyof EquipoStats["porEstado"];
  color: string;
}> = [
  { key: "completada",  color: "var(--color-success-5)"     },
  { key: "en_revision", color: "var(--color-secondary-5)"   },
  { key: "asignada",    color: "rgba(102, 188, 159, 0.4)"  },
  { key: "retornada",   color: "var(--color-warning-5)"     },
  { key: "no_aplica",   color: "var(--color-gray-3)"        },
  { key: "sin_asignar", color: "var(--color-gray-2)"        },
];

function formatTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days  = Math.floor(diffMs / 86_400_000);
  if (mins  <  1) return "ahora";
  if (mins  < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days  <  7) return `${days}d`;
  return new Date(iso).toLocaleDateString("es-CL");
}

function logToActividad(log: ActividadLog): { tipo: string; texto: string } {
  const n    = log.datos_new;
  const acLow = log.accion.toLowerCase();
  const tareaLabel  = String(n?.tarea ?? n?.jerarquia_2_nombre ?? n?.nombre ?? "");
  const equipoLabel = String(n?.equipo_nombre ?? "");
  const estadoNuevo = String(n?.estado ?? "");

  if (acLow.includes("completad") || estadoNuevo === "completada")
    return { tipo: "completada", texto: tareaLabel ? `${tareaLabel} completada` : "Tarea completada" };
  if (acLow.includes("revision") || estadoNuevo === "en_revision")
    return { tipo: "en_revision", texto: tareaLabel ? `${tareaLabel} enviada a revisión` : "Tarea en revisión" };
  if (acLow.includes("retornad") || estadoNuevo === "retornada")
    return { tipo: "retornada", texto: tareaLabel ? `${tareaLabel} retornada` : "Tarea retornada" };
  if (acLow.includes("recordatorio"))
    return { tipo: "asignada", texto: tareaLabel ? `Recordatorio: ${tareaLabel}` : "Recordatorio enviado" };
  if (acLow.includes("asignar") || acLow.includes("asignac") || estadoNuevo === "asignada") {
    const suffix = equipoLabel ? ` → ${equipoLabel}` : "";
    return { tipo: "asignada", texto: tareaLabel ? `${tareaLabel} asignada${suffix}` : "Tarea asignada" };
  }
  if (acLow.includes("no_aplica") || estadoNuevo === "no_aplica")
    return { tipo: "no_aplica", texto: tareaLabel ? `${tareaLabel} marcada como no aplica` : "Tarea no aplica" };

  return { tipo: "asignada", texto: log.accion };
}

function dotColor(tipo: string): string {
  if (tipo === "completada")  return "bg-success-5";
  if (tipo === "retornada")   return "bg-critique-6";
  if (tipo === "en_revision") return "bg-secondary-5";
  if (tipo === "no_aplica")   return "bg-gray-3";
  return "bg-info-5";
}

const REPORTES_DISPONIBLES: Array<{ key: string; label: string; disabled?: boolean }> = [
  { key: "GRI",  label: "GRI" },
  { key: "NCG",  label: "NCG" },
  { key: "SASB", label: "SASB", disabled: true },
];

export function OverviewSection({
  stats: initialStats,
  error: initialError,
  proyectoRef,
  proyectoId,
  reportesHabilitados,
  cargaEquipos: initialCarga,
  actividadReciente: initialActividad,
}: {
  stats: OverviewStats | null;
  error: string | null;
  proyectoRef: string;
  proyectoId: string;
  reportesHabilitados: string[];
  cargaEquipos: EquipoStats[];
  actividadReciente: ActividadLog[];
}) {
  const router = useRouter();
  const setTareasFiltroOverview = useAuthStore((s) => s.setTareasFiltroOverview);

  // Pills: solo mostrar reportes que el proyecto tiene habilitados
  const pillsVisibles = REPORTES_DISPONIBLES.filter(
    (r) => r.disabled || reportesHabilitados.includes(r.key)
  );
  const [selectedReportes, setSelectedReportes] = useState<string[]>(reportesHabilitados);

  // Estado local — inicializado con datos SSR
  const [stats, setStats] = useState(initialStats);
  const [error, setError] = useState(initialError);
  const [cargaEquipos, setCargaEquipos] = useState(initialCarga);
  const [actividadReciente, setActividadReciente] = useState(initialActividad);
  const [pillLoading, setPillLoading] = useState(false);
  const [filtroDonut, setFiltroDonut] = useState<Set<string>>(new Set());

  // tipoRuta: para la navegación de KPIs (solo cuando hay un único tipo activo)
  const tipoRuta = selectedReportes.length === 1 ? selectedReportes[0].toLowerCase() : null;

  function irConFiltro(estados: string[]) {
    if (!tipoRuta) return;
    setTareasFiltroOverview(estados);
    router.push(`/dashboard/proyecto/${proyectoRef}/${tipoRuta}/seguimiento`);
  }

  async function fetchParaTipos(tipos: string[]) {
    if (tipos.length === 0) return;
    setPillLoading(true);
    const supabase = createClient();

    const [statsRes, cargaRes, actRes] = await Promise.all([
      supabase.rpc("overview_proyecto_multi", {
        p_proyecto_id: proyectoId,
        p_tipos: tipos,
      }),
      supabase.rpc("get_carga_equipos_multi", {
        p_proyecto_id: proyectoId,
        p_tipos: tipos,
      }),
      supabase.rpc("get_historial_proyecto", {
        p_proyecto_id: proyectoId,
        p_limit: 12,
        p_offset: 0,
        p_tipo_reporte: tipos.length === 1 ? tipos[0].toLowerCase() : null,
      }),
    ]);

    if (!statsRes.error) {
      const raw = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      setStats((raw as OverviewStats) ?? null);
      setError(null);
    } else {
      setError(statsRes.error.message);
    }

    if (!cargaRes.error && cargaRes.data) {
      const map = new Map<number, EquipoStats>();
      for (const row of cargaRes.data as { equipo_id: number; equipo_nombre: string | null; estado: string }[]) {
        if (!map.has(row.equipo_id)) {
          map.set(row.equipo_id, {
            equipo_id: row.equipo_id,
            nombre: row.equipo_nombre ?? `Equipo ${row.equipo_id}`,
            total: 0,
            porEstado: { completada: 0, en_revision: 0, asignada: 0, retornada: 0, no_aplica: 0, sin_asignar: 0 },
          });
        }
        const eq = map.get(row.equipo_id)!;
        eq.total++;
        const e = row.estado as keyof EquipoStats["porEstado"];
        if (e in eq.porEstado) eq.porEstado[e]++;
      }
      setCargaEquipos(
        Array.from(map.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
      );
    }

    if (!actRes.error) {
      setActividadReciente((actRes.data as ActividadLog[]) ?? []);
    }

    setPillLoading(false);
  }

  function togglePill(key: string) {
    setSelectedReportes((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      // Al menos un reporte debe estar activo
      if (next.length === 0) return prev;
      void fetchParaTipos(next);
      return next;
    });
  }

  const [cooldown, setCooldown] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function handleRefresh() {
    if (cooldown > 0) return;
    setRefreshing(true);
    router.refresh();
    setCooldown(15);
    setTimeout(() => setRefreshing(false), 800);
  }

  const chartData = stats
    ? DONUT_META.map((m) => ({
        name: m.label,
        value: stats[m.key] as number,
        color: m.color,
        dotClass: m.dotClass,
        dotStyle: m.dotStyle,
        stroke: m.stroke,
      })).filter((d) => d.value > 0)
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-8">Resumen del proyecto</h2>
          {/* Pills — solo visibles si el proyecto tiene más de un reporte */}
          {reportesHabilitados.length > 1 && (
            <div className="flex items-center gap-1.5">
              {pillsVisibles.map((r) => {
                const habilitado = reportesHabilitados.includes(r.key);
                const activo = selectedReportes.includes(r.key);
                if (!habilitado) {
                  return (
                    <span
                      key={r.key}
                      title="Próximamente"
                      className="cursor-not-allowed rounded-full border border-gray-2 bg-gray-1 px-3 py-1 text-xs font-medium text-gray-4"
                    >
                      {r.label}
                    </span>
                  );
                }
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => togglePill(r.key)}
                    disabled={pillLoading}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      activo
                        ? "border-primary-4 bg-primary-5 text-white"
                        : "border-gray-2 bg-white text-gray-6 hover:border-gray-3 hover:bg-gray-1"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={cooldown > 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-2 bg-white px-3 py-1.5 text-xs font-medium text-gray-6 shadow-sm transition-colors hover:bg-gray-1 disabled:cursor-not-allowed disabled:opacity-50"
          title={cooldown > 0 ? `Disponible en ${cooldown}s` : "Actualizar datos"}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            strokeWidth={2}
          />
          {cooldown > 0 ? `${cooldown}s` : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-critique-3 bg-critique-1 p-3 text-sm text-critique-7">
          Error al cargar estadísticas: {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Columna izquierda */}
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-5">
            <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-8">Distribución de estados</p>
                {filtroDonut.size > 0 && (
                  <button
                    onClick={() => setFiltroDonut(new Set())}
                    className="text-xs font-medium text-primary-6 hover:underline"
                  >
                    Mostrar todo
                  </button>
                )}
              </div>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={filtroDonut.size > 0 ? chartData.filter((d) => !filtroDonut.has(d.name)) : chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={78}
                      dataKey="value"
                      paddingAngle={chartData.length > 1 ? 2 : 0}
                      animationDuration={300}
                    >
                      {(filtroDonut.size > 0 ? chartData.filter((d) => !filtroDonut.has(d.name)) : chartData).map((entry, index) => (
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
                  <p className="text-2xl font-bold text-gray-9">
                    {filtroDonut.size > 0
                      ? chartData
                          .filter((d) => !filtroDonut.has(d.name))
                          .reduce((sum, d) => sum + d.value, 0)
                      : stats.total}
                  </p>
                  <p className="text-xs text-gray-5">{filtroDonut.size > 0 ? "filtrado" : "total"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 sm:gap-y-2">
                {chartData.map((d) => {
                  const isHidden = filtroDonut.has(d.name);
                  return (
                    <button
                      key={d.name}
                      onClick={() => {
                        const newFiltro = new Set(filtroDonut);
                        if (isHidden) {
                          newFiltro.delete(d.name);
                        } else {
                          newFiltro.add(d.name);
                        }
                        setFiltroDonut(newFiltro);
                      }}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all ${
                        isHidden
                          ? "opacity-40"
                          : "hover:bg-gray-1"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isHidden ? "bg-gray-3" : (d.dotStyle ?? d.dotClass)}`} />
                      <span className={`truncate ${isHidden ? "text-gray-4 line-through" : "text-gray-6"}`}>
                        {d.name}
                      </span>
                      <span className={`ml-auto font-semibold ${isHidden ? "text-gray-4" : "text-gray-8"}`}>
                        {d.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-2 bg-white p-5 shadow-card">
              <p className="mb-4 text-sm font-semibold text-gray-8">Carga por equipo</p>
              {cargaEquipos.length === 0 ? (
                <p className="text-xs text-gray-4">Sin equipos asignados en este proyecto.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {cargaEquipos.map((equipo) => (
                    <div key={equipo.equipo_id}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="truncate text-xs font-medium text-gray-7">{equipo.nombre}</span>
                        <span className="ml-2 shrink-0 text-xs text-gray-4">{equipo.total} ítems</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-gray-1">
                        {BARRA_ESTADOS.map(({ key, color }) => {
                          const count = equipo.porEstado[key];
                          if (!count) return null;
                          const pct = (count / equipo.total) * 100;
                          return (
                            <div
                              key={key}
                              style={{ width: `${pct}%`, backgroundColor: color }}
                              className="h-full shrink-0"
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha */}
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-primary-3 bg-primary-1 p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-primary-6">Total de ítems</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-2">
                    <svg className="h-3.5 w-3.5 text-primary-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-primary-7">{stats.total}</p>
              </div>

              <div
                role={tipoRuta ? "button" : undefined}
                onClick={tipoRuta ? () => irConFiltro(["completada"]) : undefined}
                className={`rounded-xl border border-gray-2 bg-white p-4 shadow-card transition-all ${tipoRuta ? "cursor-pointer hover:scale-[1.02] hover:shadow-md" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-5">Completadas</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-1">
                    <svg className="h-3.5 w-3.5 text-success-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-9">{stats.completada}</p>
                {stats.total > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-success-7">
                    {Math.round((stats.completada / stats.total) * 100)}% del total
                  </p>
                )}
              </div>

              <div
                role={tipoRuta ? "button" : undefined}
                onClick={tipoRuta ? () => irConFiltro(["__atrasadas__"]) : undefined}
                className={`rounded-xl border p-4 shadow-card transition-all ${tipoRuta ? "cursor-pointer hover:scale-[1.02] hover:shadow-md" : ""} ${
                  stats.atrasadas > 0 ? "border-critique-3 bg-critique-1" : "border-gray-2 bg-white"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      stats.atrasadas > 0 ? "text-critique-6" : "text-gray-5"
                    }`}
                  >
                    Atrasadas
                  </span>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      stats.atrasadas > 0 ? "bg-critique-2" : "bg-gray-1"
                    }`}
                  >
                    <svg
                      className={`h-3.5 w-3.5 ${
                        stats.atrasadas > 0 ? "text-critique-7" : "text-gray-4"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p
                  className={`text-3xl font-bold ${
                    stats.atrasadas > 0 ? "text-critique-7" : "text-gray-9"
                  }`}
                >
                  {stats.atrasadas}
                </p>
              </div>

              <div
                role={tipoRuta ? "button" : undefined}
                onClick={tipoRuta ? () => irConFiltro(["sin_asignar"]) : undefined}
                className={`rounded-xl border border-gray-2 bg-white p-4 shadow-card transition-all ${tipoRuta ? "cursor-pointer hover:scale-[1.02] hover:shadow-md" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-5">Sin asignar</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-1">
                    <svg className="h-3.5 w-3.5 text-gray-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-9">{stats.sin_asignar}</p>
                {stats.total > 0 && (
                  <p className="mt-0.5 text-xs text-gray-4">
                    {Math.round((stats.sin_asignar / stats.total) * 100)}% sin equipo
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-gray-2 bg-white p-5 shadow-card">
              <p className="mb-4 text-sm font-semibold text-gray-8">Actividad reciente</p>
              {actividadReciente.length === 0 ? (
                <p className="text-xs text-gray-4">Sin actividad registrada aún.</p>
              ) : (
                <div className="flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
                  {actividadReciente.map((log) => {
                    const { tipo, texto } = logToActividad(log);
                    return (
                      <div
                        key={log.log_id}
                        className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-1"
                      >
                        <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotColor(tipo)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-8">{texto}</p>
                          <p className="text-[11px] text-gray-4">
                            {log.actor ?? "—"} · {formatTime(log.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendario de fechas límite — siempre visible (se auto-oculta si no hay eventos) */}
      <CalendarioFechas
        proyectoId={proyectoId}
        proyectoRef={proyectoRef}
        reportesHabilitados={selectedReportes}
      />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 rounded bg-gray-2 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-gray-2 animate-pulse" />
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-5">
          <div className="h-72 animate-pulse rounded-xl bg-gray-2" />
          <div className="h-52 animate-pulse rounded-xl bg-gray-2" />
        </div>
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-2" />
            ))}
          </div>
          <div className="h-52 animate-pulse rounded-xl bg-gray-2" />
        </div>
      </div>
    </div>
  );
}
