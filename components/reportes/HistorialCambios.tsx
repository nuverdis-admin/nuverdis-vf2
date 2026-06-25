"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RespuestasMap } from "@/lib/tareas/types";

interface LogEntry {
  log_id: number;
  accion: string;
  tabla: string | null;
  registro_id: string | null;
  tarea_public_id: string | null;
  tarea_estado_actual: string | null;
  datos_prev: Record<string, unknown> | null;
  datos_new: Record<string, unknown> | null;
  created_at: string;
  actor: string | null;
  tipo: string | null;
}

type Categoria =
  | "todas"
  | "cambio_estado"
  | "asignacion"
  | "no_aplica"
  | "recordatorio"
  | "eliminacion";

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "todas",         label: "Todas" },
  { value: "cambio_estado", label: "Cambio de estado" },
  { value: "asignacion",    label: "Asignación" },
  { value: "no_aplica",     label: "No aplica" },
  { value: "recordatorio",  label: "Recordatorio" },
  { value: "eliminacion",   label: "Eliminación" },
];

function clasificarAccion(accion: string): Categoria {
  const a = accion.toLowerCase();
  // Cambios de estado (incluye legacy ADMIN_TOGGLE_EDICION / APROBADO_POR_ADMIN)
  if (
    a.startsWith("cambio_estado") ||
    a === "admin_toggle_edicion" ||
    a === "aprobado_por_admin"
  ) return "cambio_estado";
  // Asignaciones (individual + masiva + actualización)
  if (
    a.startsWith("asignar_") ||
    a.startsWith("asignacion_") ||
    a === "update_tarea_asignacion"
  ) return "asignacion";
  // No aplica
  if (a.startsWith("no_aplica")) return "no_aplica";
  // Recordatorio
  if (a.includes("recordatorio")) return "recordatorio";
  // Eliminación
  if (a.startsWith("delete_") || a.startsWith("eliminacion_")) return "eliminacion";
  return "todas";
}

function badgeAccion(accion: string): string {
  const cat = clasificarAccion(accion);
  switch (cat) {
    case "cambio_estado": return "bg-warning-1 text-warning-7";
    case "asignacion":    return "bg-info-1 text-info-7";
    case "no_aplica":     return "bg-gray-2 text-gray-7";
    case "recordatorio":  return "bg-secondary-1 text-secondary-7";
    case "eliminacion":   return "bg-critique-1 text-critique-7";
    default:              return "bg-gray-2 text-gray-7";
  }
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SkeletonFilas() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className="border-b border-gray-1">
          <td className="px-4 py-3"><div className="h-5 w-28 rounded-full bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-7 w-10 rounded bg-gray-2 animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

// ── RespuestasDiff ────────────────────────────────────────────────────────────

type FilaTabla = { label: string; cells: Record<string, string> };
type ContenidoTabla = { rows?: FilaTabla[]; extra?: ContenidoTabla };

function filasATexto(rows: FilaTabla[] | undefined): string {
  if (!Array.isArray(rows)) return "";
  return rows.map((r) => `${r.label}: ${Object.values(r.cells).join(" | ")}`).join("\n");
}

function parsearContenido(contenido: string | undefined): string {
  if (!contenido) return "";
  try {
    const parsed = JSON.parse(contenido) as ContenidoTabla;
    if (parsed && Array.isArray(parsed.rows)) {
      const principal = filasATexto(parsed.rows);
      // Tabla secundaria (ej. NCG letra xiii sección f): incluirla en el diff.
      const secundaria = filasATexto(parsed.extra?.rows);
      return secundaria ? `${principal}\n${secundaria}` : principal;
    }
  } catch {
    // no es JSON, devolver texto plano
  }
  return contenido;
}

function RespuestasDiff({
  prev,
  next,
}: {
  prev: RespuestasMap | undefined;
  next: RespuestasMap | undefined;
}) {
  const letras = Array.from(
    new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})])
  ).sort();

  if (letras.length === 0) {
    return <p className="text-sm text-gray-4 italic">Sin respuestas registradas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {letras.map((letra) => {
        const p = prev?.[letra];
        const n = next?.[letra];
        const prevTexto = p?.aplica === false ? "No aplica" : parsearContenido(p?.contenido);
        const nextTexto = n?.aplica === false ? "No aplica" : parsearContenido(n?.contenido);
        const cambio = prevTexto !== nextTexto;

        return (
          <div
            key={letra}
            className={`rounded-lg border p-3 ${cambio ? "border-warning-3 bg-warning-1" : "border-gray-2 bg-gray-1"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-primary-6 w-5">{letra})</span>
              {cambio ? (
                <span className="text-xs font-semibold text-warning-7 bg-warning-2 px-2 py-0.5 rounded-full">Modificado</span>
              ) : (
                <span className="text-xs text-gray-4">Sin cambios</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-semibold text-gray-5 uppercase tracking-wide mb-1">Antes</p>
                <p className="text-xs text-gray-7 whitespace-pre-wrap break-words">
                  {prevTexto || <span className="italic text-gray-3">Vacío</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-5 uppercase tracking-wide mb-1">Después</p>
                <p className="text-xs text-gray-7 whitespace-pre-wrap break-words">
                  {nextTexto || <span className="italic text-gray-3">Vacío</span>}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ModalDetalle ─────────────────────────────────────────────────────────────

function ModalDetalle({
  log,
  onClose,
  pathname,
}: {
  log: LogEntry;
  onClose: () => void;
  pathname: string;
}) {
  // tarea_info guardada en el log por el RPC — sin fetch extra
  const tareaInfo = (log.datos_new?.tarea_info ?? log.datos_prev?.tarea_info) as {
    estandar: string;
    jerarquia_1: number | null;
    jerarquia_2: number | null;
    jerarquia_2_nombre: string;
  } | undefined;

  const tareaNombre = tareaInfo?.jerarquia_2_nombre
    ? `${tareaInfo.estandar}-${tareaInfo.jerarquia_2} ${tareaInfo.jerarquia_2_nombre}`
    : null;

  const tieneRespuestas =
    (log.datos_new !== null && "respuestas" in (log.datos_new ?? {})) ||
    (log.datos_prev !== null && "respuestas" in (log.datos_prev ?? {}));

  const ambos = log.datos_prev !== null && log.datos_new !== null;
  const soloPrev = log.datos_prev !== null && log.datos_new === null;
  const soloNew = log.datos_prev === null && log.datos_new !== null;

  const esTarea = log.tabla?.startsWith("gri_") || log.tabla?.startsWith("ncg_");
  const tareaNoAplica = esTarea && log.tarea_estado_actual === "no_aplica";
  // sin_asignar = reseteada/eliminada; null = físicamente eliminada de BD
  const tareaEliminada = esTarea && !tareaNoAplica && (
    !log.tarea_public_id || log.tarea_estado_actual === "sin_asignar"
  );
  const tareaLink = esTarea && log.tarea_public_id && !tareaNoAplica && !tareaEliminada
    ? pathname.replace(/\/cambios$/, `/seguimiento/${log.tarea_public_id}`)
    : null;

  const estadoPrev       = (log.datos_prev?.estado            as string  | undefined) ?? null;
  const estadoNew        = (log.datos_new?.estado             as string  | undefined) ?? null;
  const motivo           = (log.datos_new?.motivo             as string  | undefined) ?? null;
  const asAdmin          = (log.datos_new?.as_admin           as boolean | undefined) ?? false;
  const modoEdicionAdmin = (log.datos_new?.modo_edicion_admin as boolean | undefined) ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-modal border-t-4 border-info-5 mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between mb-4 shrink-0 gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-8">
              Detalle del log{" "}
              <span className="text-gray-4 font-normal text-sm">#{log.log_id}</span>
            </h3>
            {tareaNombre && (
              <p className="text-sm font-medium text-gray-6 mt-0.5">{tareaNombre}</p>
            )}
            {tareaLink && (
              <Link
                href={tareaLink}
                onClick={onClose}
                className="text-xs text-primary-5 hover:text-primary-7 hover:underline font-mono truncate block mt-0.5"
                title={tareaLink}
              >
                {tareaLink}
              </Link>
            )}
            {tareaNoAplica && (
              <span className="text-xs text-gray-4 italic mt-0.5 block">Sin link de seguimiento</span>
            )}
            {tareaEliminada && (
              <span className="text-xs text-gray-4 italic mt-0.5 block">Tarea eliminada</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-4 hover:text-gray-7 transition-colors text-xl leading-none shrink-0"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          {/* Cabecera legible de cambio de estado con respuestas */}
          {tieneRespuestas && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {estadoPrev && (
                <span className="text-xs bg-gray-2 text-gray-7 px-2 py-0.5 rounded-full font-mono">{estadoPrev}</span>
              )}
              {estadoPrev && estadoNew && (
                <span className="text-gray-4 text-xs">→</span>
              )}
              {estadoNew && (
                <span className="text-xs bg-info-1 text-info-7 px-2 py-0.5 rounded-full font-mono">{estadoNew}</span>
              )}
              {asAdmin && (
                <span className="text-xs bg-warning-1 text-warning-7 px-2 py-0.5 rounded-full">aprobación admin</span>
              )}
              {modoEdicionAdmin && !asAdmin && (
                <span className="text-xs bg-warning-1 text-warning-7 px-2 py-0.5 rounded-full">modo edición admin</span>
              )}
              {motivo && (
                <span className="text-xs text-gray-5 italic">Motivo: {motivo}</span>
              )}
            </div>
          )}

          {/* Vista legible cuando hay respuestas */}
          {tieneRespuestas && (
            <div>
              <p className="text-xs font-semibold text-gray-5 uppercase tracking-wide mb-2">Respuestas por requerimiento</p>
              <RespuestasDiff
                prev={log.datos_prev?.respuestas as RespuestasMap | undefined}
                next={log.datos_new?.respuestas as RespuestasMap | undefined}
              />
            </div>
          )}

          {/* Render JSON clásico cuando NO hay respuestas */}
          {!tieneRespuestas && soloNew && (
            <div>
              <p className="text-xs font-medium text-gray-5 mb-1 uppercase tracking-wide">Nuevo registro</p>
              <pre className="bg-gray-1 p-3 rounded text-xs max-h-64 overflow-auto text-gray-8 whitespace-pre-wrap">
                {JSON.stringify(log.datos_new, null, 2)}
              </pre>
            </div>
          )}

          {!tieneRespuestas && soloPrev && (
            <div>
              <p className="text-xs font-medium text-gray-5 mb-1 uppercase tracking-wide">Registro eliminado</p>
              <pre className="bg-gray-1 p-3 rounded text-xs max-h-64 overflow-auto text-gray-8 whitespace-pre-wrap">
                {JSON.stringify(log.datos_prev, null, 2)}
              </pre>
            </div>
          )}

          {!tieneRespuestas && ambos && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-5 mb-1 uppercase tracking-wide">Antes</p>
                <pre className="bg-gray-1 p-3 rounded text-xs max-h-64 overflow-auto text-gray-8 whitespace-pre-wrap">
                  {JSON.stringify(log.datos_prev, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-5 mb-1 uppercase tracking-wide">Después</p>
                <pre className="bg-gray-1 p-3 rounded text-xs max-h-64 overflow-auto text-gray-8 whitespace-pre-wrap">
                  {JSON.stringify(log.datos_new, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {!tieneRespuestas && !soloNew && !soloPrev && !ambos && (
            <p className="text-sm text-gray-4">Sin datos adicionales.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

export function HistorialCambios({ proyectoId, tipoReporte }: { proyectoId: string; tipoReporte: string }) {
  const pathname = usePathname();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filtro, setFiltro] = useState<Categoria>("todas");
  const [detalle, setDetalle] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(
    async (currentOffset: number, append: boolean) => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_historial_proyecto", {
        p_proyecto_id: proyectoId,
        p_limit: PAGE_SIZE,
        p_offset: currentOffset,
        p_tipo_reporte: tipoReporte.toLowerCase(),
      });
      if (rpcError) return { ok: false, message: rpcError.message };
      const rows = (data as LogEntry[]) ?? [];
      if (append) {
        setLogs((prev) => [...prev, ...rows]);
      } else {
        setLogs(rows);
      }
      setHasMore(rows.length === PAGE_SIZE);
      return { ok: true };
    },
    [proyectoId, tipoReporte]
  );

  useEffect(() => {
    setLoading(true);
    fetchLogs(0, false)
      .then((r) => { if (!r.ok) setError(r.message ?? "Error al cargar historial."); })
      .finally(() => setLoading(false));
  }, [fetchLogs]);

  async function cargarMas() {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    const r = await fetchLogs(nextOffset, true);
    if (!r.ok) setError(r.message ?? "Error al cargar más.");
    else setOffset(nextOffset);
    setLoadingMore(false);
  }

  const logsFiltrados =
    filtro === "todas"
      ? logs
      : logs.filter((l) => clasificarAccion(l.accion) === filtro);

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] overflow-hidden pb-8">
      {/* Filtro */}
      <div className="shrink-0 flex items-center gap-3 mb-3">
        <label className="text-sm text-gray-6 font-medium shrink-0">Filtrar por:</label>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Categoria)}
          className="text-sm border border-gray-2 rounded-lg px-3 py-1.5 text-gray-7 bg-white focus:outline-none focus:ring-2 focus:ring-primary-3"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-2 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-1 border-b border-gray-2">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Acción</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Actor</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Objeto</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonFilas />}

            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-critique-6">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && logsFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-4">
                  Sin registros para este filtro.
                </td>
              </tr>
            )}

            {!loading && !error && logsFiltrados.map((log) => {
              const esMasiva = log.accion.toLowerCase().includes("masiva");
              const totalMasiva = esMasiva
                ? ((log.datos_new?.total_tareas as number | undefined) ?? null)
                : null;
              const objetoId = log.tarea_public_id ?? log.registro_id;
              const objeto = esMasiva
                ? `${log.tabla ?? "tareas"} · ${totalMasiva !== null ? `${totalMasiva} tareas` : "masiva"}`
                : log.tabla
                  ? objetoId
                    ? `${log.tabla} · ${objetoId.slice(0, 8)}…`
                    : log.tabla
                  : "—";

              return (
                <tr key={log.log_id} className="border-b border-gray-1 hover:bg-gray-1 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeAccion(log.accion)}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-7 whitespace-nowrap">
                    {log.actor ?? "Sistema"}
                  </td>
                  <td className="px-4 py-3 text-gray-6 font-mono text-xs whitespace-nowrap">
                    {objeto}
                  </td>
                  <td className="px-4 py-3 text-gray-5 whitespace-nowrap">
                    {log.tipo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-5 whitespace-nowrap">
                    {formatFecha(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {(log.datos_prev !== null || log.datos_new !== null) ? (
                      <button
                        onClick={() => setDetalle(log)}
                        className="btn-ghost text-xs px-2 py-1"
                      >
                        Ver
                      </button>
                    ) : (
                      <span className="text-gray-3 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cargar más */}
      {!loading && !error && hasMore && (
        <div className="shrink-0 pt-3 flex justify-center">
          <button
            onClick={cargarMas}
            disabled={loadingMore}
            className="btn-outline text-sm px-5 py-2 disabled:opacity-50"
          >
            {loadingMore ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <ModalDetalle log={detalle} onClose={() => setDetalle(null)} pathname={pathname} />
      )}
    </div>
  );
}
