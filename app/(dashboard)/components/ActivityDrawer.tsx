"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LogEntry {
  log_id: number;
  accion: string;
  tabla: string;
  registro_id: string;
  datos_new: Record<string, string | boolean | null> | null;
  datos_prev: Record<string, string | boolean | null> | null;
  created_at: string;
  actor: string;       // ← nuevo
  tipo: string;        // ← nuevo
}

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}


function getActionIcon(accion: string): JSX.Element {
  const cls = "h-4 w-4";
  switch (accion) {
    case "CREATE_USUARIO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>;
    case "UPDATE_USUARIO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
    case "DELETE_USUARIO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
    case "SOFT_DELETE_USUARIO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>;
    case "CREATE_EQUIPO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
    case "DELETE_EQUIPO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
    case "ASSIGN_USUARIO_EQUIPO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>;
    case "REMOVE_USUARIO_EQUIPO":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>;
    default:
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  }
}

function getActionColor(accion: string): string {
  if (accion === "CREATE_USUARIO" || accion === "CREATE_EQUIPO" || accion === "ASSIGN_USUARIO_EQUIPO") {
    return "bg-success-1 border-success-4 text-success-7";
  }
  if (accion === "UPDATE_USUARIO") {
    return "bg-info-1 border-info-4 text-info-7";
  }
  if (accion === "DELETE_USUARIO" || accion === "SOFT_DELETE_USUARIO" || accion === "DELETE_EQUIPO" || accion === "REMOVE_USUARIO_EQUIPO") {
    return "bg-critique-1 border-critique-4 text-critique-7";
  }
  return "bg-gray-1 border-gray-3 text-gray-6";
}

function getLogMessage(log: LogEntry): string {
  const n = log.datos_new;
  const p = log.datos_prev;
  switch (log.accion) {
    case "CREATE_USUARIO":
      return `${n?.nombre_completo ?? n?.nombre ?? log.registro_id} fue creado`;
    case "UPDATE_USUARIO":
      return `${n?.nombre_completo ?? n?.nombre ?? log.registro_id} fue actualizado`;
    case "DELETE_USUARIO":
      return `${p?.nombre_completo ?? p?.nombre ?? log.registro_id} fue eliminado`;
    case "SOFT_DELETE_USUARIO":
      return `${p?.nombre_completo ?? log.registro_id} fue desactivado`;
    case "CREATE_EQUIPO":
      return `Equipo ${n?.nombre ?? log.registro_id} fue creado`;
    case "DELETE_EQUIPO":
      return `Equipo ${p?.nombre ?? log.registro_id} fue eliminado`;
    case "ASSIGN_USUARIO_EQUIPO":
      return `${n?.usuario_nombre ?? log.registro_id} fue asignado a ${n?.equipo_nombre ?? "un equipo"}`;
    case "REMOVE_USUARIO_EQUIPO":
      return `${p?.usuario_nombre ?? log.registro_id} fue removido de ${p?.equipo_nombre ?? "un equipo"}`;
    default:
      return log.accion;
  }
}

function formatTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "hace unos segundos";
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return then.toLocaleDateString("es-CL");
}

export function ActivityDrawer({ isOpen, onClose }: ActivityDrawerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;

      async function cargarLogs() {
        setIsLoading(true);
        const { data } = await supabase
          .from("v_logs_legible")
          .select("log_id, accion, tabla, registro_id, datos_new, datos_prev, created_at, actor, tipo")
          .in("tabla", ["usuarios", "equipos", "equipo_miembros"])
          .order("created_at", { ascending: false })
          .limit(50);

        setLogs((data as LogEntry[]) ?? []);
        setIsLoading(false);
      }

      cargarLogs();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col overflow-hidden bg-white shadow-modal">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-2 bg-gray-0 p-4">
          <div>
            <h2 className="text-base font-bold text-gray-9">Actividad reciente</h2>
            <p className="text-xs text-gray-5">Últimas 50 acciones registradas</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-5 transition-colors hover:bg-gray-1"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg border border-gray-2 p-3">
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-2" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-2" />
                  <div className="h-2 w-1/2 animate-pulse rounded bg-gray-2" />
                </div>
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-5">Sin actividad registrada</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.log_id}
                className="flex gap-3 rounded-lg border border-gray-2 bg-gray-0 p-3 transition-colors hover:bg-gray-1"
              >
                <span
                  className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border ${getActionColor(log.accion)}`}
                >
                  {getActionIcon(log.accion)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-9">
                    {getLogMessage(log)}
                  </p>
                  {log.actor && (
                    <p className="mt-0.5 text-xs text-gray-5 truncate">
                      por <span className="font-medium text-gray-7">{log.actor}</span>
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-4">
                    {formatTime(log.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
