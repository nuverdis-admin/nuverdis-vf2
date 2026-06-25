"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { enviarRecordatorioTarea } from "@/lib/supabase/notificaciones";
import { getEstadoBadge, type ReporteConfig, type TareaRow } from "@/lib/reportes";
import type { ChatMensaje } from "@/lib/tareas/types";
import { useAuthStore } from "@/lib/store/auth";

function detalleHref(ref: string, tipo: string, publicId: string): string {
  return `/dashboard/proyecto/${ref}/${tipo.toLowerCase()}/seguimiento/${publicId}`;
}

// ── EstadoDropdown ────────────────────────────────────────────────────────────

function EstadoDropdown({
  opciones,
  seleccionados,
  onChange,
}: {
  opciones: { value: string; label: string }[];
  seleccionados: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function toggle(v: string) {
    const next = new Set(seleccionados);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }

  const label = seleccionados.size > 0 ? `Estado (${seleccionados.size})` : "Estado";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
          seleccionados.size > 0
            ? "border-primary-4 bg-primary-0 text-primary-7"
            : "border-gray-3 bg-white text-gray-6 hover:border-gray-4 hover:text-gray-8"
        } ${open ? "border-primary-5 ring-1 ring-primary-5" : ""}`}
      >
        {label}
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-md border border-gray-2 bg-white shadow-lg">
          {seleccionados.size > 0 && (
            <div className="border-b border-gray-1 px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11px] text-primary-6 hover:underline"
              >
                Limpiar
              </button>
            </div>
          )}
          <div className="py-1">
            {opciones.map(({ value, label: lbl }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-gray-1"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.has(value)}
                  onChange={() => toggle(value)}
                  className="h-3.5 w-3.5 rounded accent-primary-5"
                />
                <span className={seleccionados.has(value) ? "font-medium text-gray-9" : "text-gray-7"}>
                  {lbl}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── EquipoMultiSelect ─────────────────────────────────────────────────────────

function EquipoMultiSelect({
  opciones,
  seleccionados,
  onChange,
}: {
  opciones: string[];
  seleccionados: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function toggle(eq: string) {
    const next = new Set(seleccionados);
    next.has(eq) ? next.delete(eq) : next.add(eq);
    onChange(next);
  }

  const label =
    seleccionados.size === 0
      ? "Todos los equipos"
      : seleccionados.size === 1
      ? Array.from(seleccionados)[0]
      : `${seleccionados.size} equipos`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-full items-center justify-between rounded-md border px-3 text-xs transition-colors ${
          seleccionados.size > 0
            ? "border-primary-4 bg-primary-0 text-primary-7"
            : "border-gray-3 bg-white text-gray-6 hover:border-gray-4"
        } ${open ? "border-primary-5 ring-1 ring-primary-5" : ""}`}
      >
        <span className="truncate">{label}</span>
        <svg
          className={`ml-1 h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-gray-2 bg-white shadow-lg">
          {seleccionados.size > 0 && (
            <div className="border-b border-gray-1 px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11px] text-primary-6 hover:underline"
              >
                Limpiar selección
              </button>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {opciones.map((eq) => (
              <label
                key={eq}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-gray-1"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.has(eq)}
                  onChange={() => toggle(eq)}
                  className="h-3.5 w-3.5 rounded accent-primary-5"
                />
                <span
                  className={seleccionados.has(eq) ? "font-medium text-gray-9" : "text-gray-7"}
                >
                  {eq}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MiniChat ──────────────────────────────────────────────────────────────────

const MINI_CHAT_SIZE = 10;

function MiniChat({ tareaId, uid, mensajesTable = "tarea_mensajes", lecturasTable = "tarea_lecturas" }: { tareaId: string; uid: string; mensajesTable?: string; lecturasTable?: string }) {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const id = parseInt(tareaId, 10);
    if (isNaN(id)) {
      setCargando(false);
      return;
    }

    async function cargar() {
      const supabase = createClient();
      const [msgsRes] = await Promise.all([
        supabase
          .from(mensajesTable)
          .select("*")
          .eq("tarea_id", id)
          .order("created_at", { ascending: false })
          .limit(MINI_CHAT_SIZE),
        supabase
          .from(lecturasTable)
          .upsert(
            { tarea_id: id, uid, ultima_lectura: new Date().toISOString() },
            { onConflict: "tarea_id,uid" }
          ),
      ]);
      const lista = ((msgsRes.data ?? []) as ChatMensaje[]).reverse();
      setMensajes(lista);
      setCargando(false);
    }

    void cargar();
    return () => void supabase;
  }, [tareaId, uid]);

  if (cargando) {
    return (
      <div className="flex h-24 items-center justify-center">
        <span className="text-xs text-gray-4">Cargando…</span>
      </div>
    );
  }

  if (mensajes.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-gray-4">Sin mensajes aún.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {mensajes.map((m) => {
        const esPropio = m.uid === uid;
        return (
          <div key={m.mensaje_id} className={`flex flex-col ${esPropio ? "items-end" : "items-start"}`}>
            {!esPropio && (
              <span className="mb-0.5 text-[10px] font-semibold text-gray-5">{m.nombre}</span>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                esPropio
                  ? "bg-primary-1 text-primary-8"
                  : "border border-gray-2 bg-white text-gray-8"
              }`}
            >
              {m.contenido}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ModalDetalle ──────────────────────────────────────────────────────────────

function ModalDetalle({
  config,
  tarea,
  proyectoRef,
  tipo,
  uid,
  onClose,
}: {
  config: ReporteConfig;
  tarea: TareaRow;
  proyectoRef: string;
  tipo: string;
  uid: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { label, badgeClass } = getEstadoBadge(config, tarea.estado);
  const [enviando, setEnviando] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const setAsignacionFoco = useAuthStore((s) => s.setAsignacionFoco);

  const detalleAccesible =
    tarea.public_id !== null &&
    tarea.estado !== "sin_asignar" &&
    tarea.estado !== "no_aplica";

  const puedeRecordar =
    tarea.equipo_id !== null &&
    ["asignada", "retornada", "en_revision"].includes(tarea.estado);

  // Fetch unread count on mount for accessible tareas
  useEffect(() => {
    if (!detalleAccesible) return;
    const supabase = createClient();
    const id = parseInt(tarea.tarea_id, 10);
    if (isNaN(id)) return;

    async function fetchNoLeidos() {
      const [lecturaRes, totalRes] = await Promise.all([
        supabase
          .from(config.lecturasTable)
          .select("ultima_lectura")
          .eq("tarea_id", id)
          .eq("uid", uid)
          .maybeSingle(),
        supabase
          .from(config.mensajesTable)
          .select("created_at, uid")
          .eq("tarea_id", id),
      ]);

      const leidoHasta = lecturaRes.data?.ultima_lectura ?? null;
      const todos = (totalRes.data ?? []) as { created_at: string; uid: string }[];
      const count = leidoHasta
        ? todos.filter((m) => m.created_at > leidoHasta && m.uid !== uid).length
        : todos.filter((m) => m.uid !== uid).length;
      setNoLeidos(count);
    }

    void fetchNoLeidos();
  }, [tarea.tarea_id, uid, detalleAccesible]);

  async function handleRecordatorio() {
    if (!tarea.equipo_id) return;
    setEnviando(true);
    try {
      const res = await enviarRecordatorioTarea({
        equipoId: tarea.equipo_id,
        tareaId: tarea.tarea_id,
        proyectoId: tarea.proyecto_id,
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        estado: tarea.estado,
        tipoReporte: config.tipo,
      });
      if (res.enviado > 0) {
        toast.success(`Recordatorio enviado a ${res.enviado} persona${res.enviado !== 1 ? "s" : ""}`);
      } else if ("razon" in res && res.razon === "rate_limited") {
        toast.warning("Ya enviaste este recordatorio recientemente. Intenta en un minuto.");
      } else {
        toast.warning("No hay miembros con el rol requerido");
      }
    } catch (err) {
      console.error("[handleRecordatorio] error:", err);
      toast.error("Error al enviar recordatorio");
    } finally {
      setEnviando(false);
    }
  }

  function handleAbrirChat() {
    setChatOpen(true);
    setNoLeidos(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-modal border-t-4 border-info-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-4">
              Detalle de tarea
            </p>
            <h2 className="text-base font-bold leading-snug text-gray-9">
              {tarea.jerarquia_2_nombre}
            </h2>
            {tarea.codigo_item && (
              <p className="mt-0.5 text-xs text-gray-5">{tarea.codigo_item}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {detalleAccesible && (
              <button
                type="button"
                onClick={handleAbrirChat}
                title="Ver chat de la tarea"
                className="relative rounded-md p-1 text-gray-5 transition-colors hover:bg-gray-1 hover:text-gray-8"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {noLeidos > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-critique-6 text-[9px] font-bold text-white">
                    {noLeidos > 9 ? "9+" : noLeidos}
                  </span>
                )}
              </button>
            )}
            {puedeRecordar && (
              <button
                type="button"
                disabled={enviando}
                onClick={handleRecordatorio}
                title="Recordar al equipo"
                className="rounded-md p-1 text-gray-5 transition-colors hover:bg-primary-1 hover:text-primary-6 disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            )}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="rounded-md p-1 text-gray-5 transition-colors hover:bg-gray-1 hover:text-gray-8"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {chatOpen ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-md p-0.5 text-gray-5 hover:bg-gray-1 hover:text-gray-8"
                aria-label="Volver"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-gray-7">Chat de la tarea</p>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-2 bg-gray-1 p-3">
              <MiniChat tareaId={tarea.tarea_id} uid={uid} mensajesTable={config.mensajesTable} lecturasTable={config.lecturasTable} />
            </div>
            <p className="text-center text-xs text-gray-4">
              Para responder,{" "}
              <Link
                href={detalleHref(proyectoRef, tipo, tarea.public_id!)}
                onClick={onClose}
                className="text-primary-6 hover:underline"
              >
                abre la tarea completa →
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-1 p-3">
                <p className="mb-1 text-xs text-gray-4">Sección</p>
                <p className="font-medium text-gray-8">
                  {config.tipo === "NCG" ? (tarea.estandar_nombre ?? tarea.estandar) : tarea.jerarquia_1_nombre}
                  {config.tipo === "NCG" && tarea.jerarquia_1_nombre !== tarea.jerarquia_2_nombre && (
                    <> · {tarea.jerarquia_1_nombre}</>
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-gray-1 p-3">
                <p className="mb-1 text-xs text-gray-4">Estado</p>
                <span className={badgeClass}>{label}</span>
              </div>
              <div className="rounded-lg bg-gray-1 p-3">
                <p className="mb-1 text-xs text-gray-4">Equipo</p>
                <p className="font-medium text-gray-8">
                  {tarea.equipo_nombre ?? "Sin asignar"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-1 p-3">
                <p className="mb-1 text-xs text-gray-4">Fecha límite</p>
                <p className="font-medium text-gray-8">
                  {tarea.fecha_limite
                    ? new Date(tarea.fecha_limite).toLocaleDateString("es-CL")
                    : "—"}
                </p>
              </div>
            </div>

            {tarea.dias_restantes !== null && (
              <div
                className={`mt-3 rounded-lg p-3 text-sm ${
                  tarea.esta_atrasada
                    ? "border border-critique-3 bg-critique-1"
                    : "bg-gray-1"
                }`}
              >
                <p className="mb-1 text-xs text-gray-4">Tiempo restante</p>
                <p className={`font-semibold ${tarea.esta_atrasada ? "text-critique-7" : "text-gray-8"}`}>
                  {tarea.esta_atrasada
                    ? `Atrasada ${Math.abs(tarea.dias_restantes)} días`
                    : `${tarea.dias_restantes} días restantes`}
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              {detalleAccesible ? (
                <Link
                  href={detalleHref(proyectoRef, tipo, tarea.public_id!)}
                  className="btn btn-primary"
                  onClick={onClose}
                >
                  Abrir tarea completa
                </Link>
              ) : (tarea.estado === "sin_asignar" || tarea.estado === "no_aplica") ? (
                <button
                  type="button"
                  className="btn btn-outline rounded-lg"
                  onClick={() => {
                    const jerarquia1 =
                      config.tipo === "NCG"
                        ? tarea.estandar
                        : String(tarea.jerarquia_1 ?? tarea.jerarquia_1_nombre);
                    const j1Group =
                      config.tipo === "NCG" ? tarea.jerarquia_1 : undefined;
                    setAsignacionFoco({ tareaId: tarea.tarea_id, jerarquia1, j1Group });
                    onClose();
                    router.push(
                      `/dashboard/proyecto/${proyectoRef}/${tipo.toLowerCase()}/asignaciones`
                    );
                  }}
                >
                  Ir a asignar
                </button>
              ) : (
                <span className="text-xs italic text-gray-4">
                  Disponible cuando la tarea esté asignada.
                </span>
              )}
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── TareasTable ───────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<TareaRow>();

export function TareasTable({
  config,
  proyectoId,
  rol,
  uid: uidProp,
  misEquipoIds,
}: {
  config: ReporteConfig;
  proyectoId: string;
  rol?: string;
  uid?: string;
  misEquipoIds?: number[];
}) {
  const router = useRouter();
  const params = useParams<{ ref?: string; tipo?: string }>();
  const proyectoRef = params?.ref ?? "";
  const tipoParam = params?.tipo ?? config.tipo.toLowerCase();
  const uidStore = useAuthStore((s) => s.usuarioActual?.uid ?? "");
  const uid = uidProp ?? uidStore;

  const esAdmin = !rol || rol === "administrador";

  const estadosPorDefecto = (): Set<string> => {
    if (rol === "encargado") return new Set(["asignada", "retornada"]);
    if (rol === "revisor") return new Set(["en_revision"]);
    return new Set();
  };

  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tareaDetalle, setTareaDetalle] = useState<TareaRow | null>(null);

  function abrirTarea(t: TareaRow) {
    if (!t.public_id || t.estado === "sin_asignar" || t.estado === "no_aplica") {
      setTareaDetalle(t);
      return;
    }
    router.push(detalleHref(proyectoRef, tipoParam, t.public_id));
  }

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstados, setFiltroEstados] = useState<Set<string>>(estadosPorDefecto);
  const [filtroEquipos, setFiltroEquipos] = useState<Set<string>>(new Set());
  const [soloAtrasadas, setSoloAtrasadas] = useState(false);

  // 1. Añade este useRef justo arriba de tu useEffect
  const previoTipo = useRef(config.tipo);
  
  // 2. Lee el Zustand de forma reactiva (usándolo como hook)
  const storeFiltro = useAuthStore((s) => s.tareasFiltroOverview);
  const setTareasFiltroOverview = useAuthStore((s) => s.setTareasFiltroOverview);

  // 3. El nuevo useEffect maestro
  useEffect(() => {
    // A) Si hay una orden explícita desde las Cards (Zustand)
    if (storeFiltro) {
      if (storeFiltro.includes("__atrasadas__")) {
        setSoloAtrasadas(true);
        setFiltroEstados(new Set());
      } else if (storeFiltro.includes("__vencen_semana__")) {
        setSoloAtrasadas(false);
        setFiltroEstados(new Set());
      } else {
        setSoloAtrasadas(false);
        setFiltroEstados(new Set(storeFiltro));
      }

      setBusqueda("");
      setFiltroEquipos(new Set());
      
      // Sincronizamos el ref para evitar que se resetee luego
      previoTipo.current = config.tipo;

      // Limpiamos la orden del store
      setTareasFiltroOverview(null);
      return; 
    }

    // B) Si NO hay orden, revisamos si de verdad el usuario cambió de pestaña de reporte (GRI a SASB, etc.)
    if (previoTipo.current !== config.tipo) {
      setBusqueda("");
      setFiltroEstados(estadosPorDefecto());
      setFiltroEquipos(new Set());
      setSoloAtrasadas(false);
      
      previoTipo.current = config.tipo;
    }
    
    // Si storeFiltro es null y config.tipo no ha cambiado, no hace NADA.
    // Esto protege tus filtros si el componente hace re-renders por otros motivos.
    
  }, [config.tipo, storeFiltro, setTareasFiltroOverview]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!proyectoId) {
      setLoading(false);
      return;
    }

    // Miembro sin equipos: no hay tareas que mostrar
    if (misEquipoIds !== undefined && misEquipoIds.length === 0) {
      setTareas([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function cargar() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from(config.tareasView)
        .select("*")
        .eq("proyecto_id", proyectoId)
        .order("estandar", { ascending: true })
        .order("jerarquia_1", { ascending: true })
        .order("jerarquia_2", { ascending: true });

      if (misEquipoIds && misEquipoIds.length > 0) {
        query = query.in("equipo_id", misEquipoIds);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      let resultado = (data as TareaRow[]) ?? [];

      // Para miembros (no admin), añadir tareas con acceso temporal por derivación.
      if (misEquipoIds !== undefined && uid) {
        const { data: tareasTemporales } = await supabase
          .from(config.miembrosExtraTable)
          .select("tarea_id")
          .eq("user_id", uid);

      if (tareasTemporales && tareasTemporales.length > 0) {
          // ✅ Tipamos 't' explícitamente para que sepa que tiene tarea_id
          const idsTmp = tareasTemporales.map((t: { tarea_id: number | string }) => t.tarea_id as number);
          
          // ✅ Tipamos la respuesta de Supabase para evitar el 'any' implícito en la desestructuración
          const { data: tareasExtra }: { data: any[] | null } = await supabase
            .from(config.tareasView)
            .select("*")
            .eq("proyecto_id", proyectoId)
            .in("tarea_id", idsTmp);

          const idsYaPresentes = new Set(resultado.map((t: TareaRow) => String(t.tarea_id)));
          const nuevas = ((tareasExtra ?? []) as TareaRow[]).filter(
            (t: TareaRow) => !idsYaPresentes.has(String(t.tarea_id))
          );
          resultado = [...resultado, ...nuevas];
        }
      }

      // Excluir del listado final las tareas de las que el miembro fue excluido.
      if (misEquipoIds !== undefined && uid) {
        // ✅ Tipamos la respuesta de las exclusiones
        const { data: exclusiones }: { data: any[] | null } = await supabase
          .from(config.exclusionesTable)
          .select("tarea_id")
          .eq("user_id", uid);

        // ✅ Tipamos 'e' para asegurar que el map sea estricto
        const tareasExcluidas = new Set(exclusiones?.map((e: { tarea_id: number | string }) => String(e.tarea_id)) ?? []);
        if (tareasExcluidas.size > 0) {
          resultado = resultado.filter((t: TareaRow) => !tareasExcluidas.has(String(t.tarea_id)));
        }
      }

      setTareas(resultado);
      setLoading(false);
    }

    cargar();
  }, [proyectoId, config.tareasView, misEquipoIds]);

  const equiposUnicos = useMemo(() => {
    return Array.from(
      new Set(tareas.map((t) => t.equipo_nombre).filter((n): n is string => n !== null))
    ).sort();
  }, [tareas]);

  const estadosDisponibles = esAdmin
    ? Object.entries(config.estados).map(([value, { label }]) => ({ value, label }))
    : [
        { value: "asignada",    label: "Asignada" },
        { value: "retornada",   label: "Retornada" },
        { value: "en_revision", label: "En revisión" },
        { value: "completada",  label: "Completada" },
      ];

  const tareasFiltradas = useMemo(() => {
      const filtradas = tareas.filter((t) => {
        if (filtroEstados.size > 0 && !filtroEstados.has(t.estado)) return false;
        if (filtroEquipos.size > 0 && !filtroEquipos.has(t.equipo_nombre ?? "")) return false;
        if (soloAtrasadas && !t.esta_atrasada) return false;
        if (busqueda.trim()) {
          const q = busqueda.toLowerCase();
          const jerarquiaNum = `${t.jerarquia_1}-${t.jerarquia_2}`;
          if (
            !t.jerarquia_1_nombre?.toLowerCase().includes(q) &&
            !t.jerarquia_2_nombre?.toLowerCase().includes(q) &&
            !t.codigo_item?.toLowerCase().includes(q) &&
            !jerarquiaNum.includes(q)
          )
            return false;
        }
        return true;
      });

      // ¡NUEVO!: Aplicamos el ordenamiento natural (2-1 antes que 10-1)
      return filtradas.sort((a, b) => {
        const codA = `${a.jerarquia_1}-${a.jerarquia_2}`;
        const codB = `${b.jerarquia_1}-${b.jerarquia_2}`;
        return codA.localeCompare(codB, undefined, { numeric: true });
      });
  }, [tareas, filtroEstados, filtroEquipos, soloAtrasadas, busqueda]);

  const columns = useMemo(
() => [
      colHelper.accessor("jerarquia_2_nombre", {
        header: "Ítem",
        // NUEVO: Le enseñamos a TanStack Table a ordenar numéricamente si el usuario hace click
        sortingFn: (rowA, rowB) => {
          const a = rowA.original;
          const b = rowB.original;
          const codA = `${a.jerarquia_1}-${a.jerarquia_2}`;
          const codB = `${b.jerarquia_1}-${b.jerarquia_2}`;
          return codA.localeCompare(codB, undefined, { numeric: true });
        },
        cell: (info) => {
          const t = info.row.original;
          const isNcg = config.tipo === "NCG";
          const codigo = isNcg
            ? `${t.jerarquia_1.replace(/\./g, "-")}${t.jerarquia_2 && t.jerarquia_2 !== "0" ? `-${t.jerarquia_2}` : ""}`
            : `${t.jerarquia_1}-${t.jerarquia_2}`;
          const mainName = isNcg ? t.jerarquia_2_nombre : info.getValue();
          const hasJ3 = isNcg && t.jerarquia_2_nombre !== t.jerarquia_1_nombre;
          const subName  = isNcg ? (t.estandar_nombre ?? t.estandar) : t.jerarquia_1_nombre;
          return (
            <div>
              <p className="font-medium leading-snug text-gray-9">
                <span className="text-primary-6 font-bold mr-2">{codigo}</span>
                {mainName}
              </p>
              <p className="mt-0.5 text-xs text-gray-4">
                {subName}
                {hasJ3 && <> · {t.jerarquia_1_nombre}</>}
                {t.codigo_item && (
                  <> · <span className="font-medium">{t.codigo_item}</span></>
                )}
              </p>
            </div>
          );
        },
      }),
      // ... A partir de aquí sigue igual (colHelper.accessor("estado", ...)
      colHelper.accessor("estado", {
        header: "Estado",
        cell: (info) => {
          const { label, badgeClass } = getEstadoBadge(config, info.getValue());
          return <span className={badgeClass}>{label}</span>;
        },
      }),
      colHelper.accessor("equipo_nombre", {
        header: "Equipo",
        cell: (info) =>
          info.getValue() ? (
            <span className="text-sm text-gray-7">{info.getValue()}</span>
          ) : (
            <span className="text-xs italic text-gray-4">Sin equipo</span>
          ),
      }),
      colHelper.accessor("dias_restantes", {
        header: "Días restantes",
        cell: (info) => {
          const dias = info.getValue();
          const atrasada = info.row.original.esta_atrasada;
          if (dias === null) return <span className="text-xs text-gray-4">—</span>;
          return (
            <span className="flex items-center gap-1.5">
              <span
                className={`text-sm font-medium ${
                  atrasada ? "text-critique-7" : dias <= 7 ? "text-warning-7" : "text-gray-7"
                }`}
              >
                {atrasada ? `−${Math.abs(dias)}d` : `${dias}d`}
              </span>
              {atrasada && (
                <span className="inline-flex items-center rounded-full bg-critique-1 px-2 py-[1px] text-[11px] font-medium text-critique-7 border border-critique-3">
                  atrasada
                </span>
              )}
            </span>
          );
        },
      }),
      colHelper.display({
        id: "acciones",
        header: "",
        cell: (info) => {
          const t = info.row.original;
          const accesible =
            t.public_id !== null && t.estado !== "sin_asignar" && t.estado !== "no_aplica";
          return (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTareaDetalle(t);
                }}
                className="text-xs font-medium text-gray-6 transition-colors hover:text-gray-8 hover:underline"
              >
                Ver
              </button>
              {accesible && (
                <Link
                  href={detalleHref(proyectoRef, tipoParam, t.public_id!)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-primary-6 transition-colors hover:text-primary-8 hover:underline"
                >
                  Abrir
                </Link>
              )}
            </div>
          );
        },
      }),
    ],
    [config]
  );

  const table = useReactTable({
    data: tareasFiltradas,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hayFiltros =
    filtroEstados.size > 0 || filtroEquipos.size > 0 || soloAtrasadas || busqueda.trim().length > 0;

  return (
    <div className="flex flex-col">
      {/* Toolbar horizontal */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-2 pb-3 mb-4">
        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-4"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por nombre, código, jerarquía..."
            className="h-8 w-full rounded-md border border-gray-2 bg-transparent pl-8 pr-3 text-xs text-gray-8 outline-none placeholder:text-gray-4 transition-colors focus:border-primary-4 focus:ring-1 focus:ring-primary-5"
          />
        </div>

        {/* Filtros derecha */}
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <EstadoDropdown
            opciones={estadosDisponibles}
            seleccionados={filtroEstados}
            onChange={setFiltroEstados}
          />

          {equiposUnicos.length > 1 && (
            <EquipoMultiSelect
              opciones={equiposUnicos}
              seleccionados={filtroEquipos}
              onChange={setFiltroEquipos}
            />
          )}

          {/* Toggle Solo atrasadas */}
          <button
            type="button"
            onClick={() => setSoloAtrasadas((v) => !v)}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              soloAtrasadas
                ? "border-critique-4 bg-critique-1 text-critique-7"
                : "border-gray-3 bg-white text-gray-6 hover:border-gray-4 hover:text-gray-8"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Atrasadas
          </button>

          {/* Limpiar */}
          {hayFiltros && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltroEstados(new Set());
                setFiltroEquipos(new Set());
                setSoloAtrasadas(false);
              }}
              className="flex h-8 items-center gap-1 rounded-md px-2.5 text-xs text-gray-5 transition-colors hover:bg-gray-1 hover:text-gray-8"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Área de tabla */}
      <div className="flex flex-col gap-2">
        {!loading && (
          <p className="text-xs text-gray-4">
            {tareasFiltradas.length} de {tareas.length} ítems
            {hayFiltros && " (filtrado)"}
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-critique-3 bg-critique-1 p-3 text-sm text-critique-7">
            Error: {error}
          </div>
        )}

        {loading ? (
          <>
            {/* Mobile skeleton */}
            <div className="md:hidden flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-2 bg-white p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="mb-1.5 h-4 w-3/4 rounded bg-gray-2 animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-gray-2 animate-pulse" />
                    </div>
                    <div className="h-5 w-20 shrink-0 rounded-full bg-gray-2 animate-pulse" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 rounded bg-gray-2 animate-pulse" />
                    <div className="h-3 w-12 rounded bg-gray-2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop skeleton */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-2 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-1">
                  <tr className="border-b border-gray-2">
                    {["Ítem", "Estado", "Equipo", "Días", "Acciones"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left">
                        <div className="h-3.5 w-20 rounded bg-gray-2 animate-pulse" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-1">
                      <td className="px-4 py-3">
                        <div className="mb-1 h-4 w-48 rounded bg-gray-2 animate-pulse" />
                        <div className="h-3 w-32 rounded bg-gray-2 animate-pulse" />
                      </td>
                      <td className="px-4 py-3"><div className="h-5 w-24 rounded-full bg-gray-2 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-2 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-gray-2 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-6 w-20 rounded bg-gray-2 animate-pulse" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : tareasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-2 bg-white py-14">
            <svg className="h-9 w-9 text-gray-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium text-gray-6">
              {hayFiltros ? "Sin resultados para los filtros aplicados" : "No hay tareas en este proyecto"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: tarjetas */}
            <div className="md:hidden flex flex-col gap-2">
              {tareasFiltradas.map((t) => {
                const { label, badgeClass } = getEstadoBadge(config, t.estado);
                const accesible = t.public_id !== null && t.estado !== "sin_asignar" && t.estado !== "no_aplica";
                const isNcg = config.tipo === "NCG";
                const codigo = isNcg
                  ? `${t.jerarquia_1.replace(/\./g, "-")}${t.jerarquia_2 && t.jerarquia_2 !== "0" ? `-${t.jerarquia_2}` : ""}`
                  : `${t.jerarquia_1}-${t.jerarquia_2}`;
                const mainName = isNcg ? t.jerarquia_2_nombre : t.jerarquia_2_nombre;
                const subName = isNcg ? (t.estandar_nombre ?? t.estandar) : t.jerarquia_1_nombre;
                return (
                  <div
                    key={t.tarea_id}
                    onClick={() => abrirTarea(t)}
                    className="cursor-pointer rounded-xl border border-gray-2 bg-white p-4 transition-colors hover:bg-gray-1"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-gray-9">
                          <span className="mr-1.5 font-bold text-primary-6">{codigo}</span>
                          {mainName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-4">{subName}</p>
                      </div>
                      <span className={`shrink-0 ${badgeClass}`}>{label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-5">
                        {t.equipo_nombre ?? <span className="italic">Sin equipo</span>}
                      </span>
                      <div className="flex items-center gap-3">
                        {t.dias_restantes !== null && (
                          <span
                            className={`text-xs font-medium ${
                              t.esta_atrasada ? "text-critique-7" : t.dias_restantes <= 7 ? "text-warning-7" : "text-gray-5"
                            }`}
                          >
                            {t.esta_atrasada ? `−${Math.abs(t.dias_restantes)}d` : `${t.dias_restantes}d`}
                          </span>
                        )}
                        {accesible ? (
                          <Link
                            href={detalleHref(proyectoRef, tipoParam, t.public_id!)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium text-primary-6 hover:text-primary-8 hover:underline"
                          >
                            Abrir →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setTareaDetalle(t); }}
                            className="text-xs font-medium text-gray-6 hover:text-gray-8 hover:underline"
                          >
                            Ver
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: tabla */}
            <div className="hidden md:block overflow-auto max-h-[calc(100vh-300px)] rounded-xl border border-gray-2 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-1 shadow-[0_1px_0_0_#e5e7eb]">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-6 whitespace-nowrap ${
                            header.column.getCanSort() ? "cursor-pointer select-none hover:text-gray-9" : ""
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" && (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                            {header.column.getIsSorted() === "desc" && (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => abrirTarea(row.original)}
                      className="cursor-pointer border-b border-gray-1 transition-colors last:border-0 hover:bg-gray-1"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {tareaDetalle && (
        <ModalDetalle
          config={config}
          tarea={tareaDetalle}
          proyectoRef={proyectoRef}
          tipo={tipoParam}
          uid={uid}
          onClose={() => setTareaDetalle(null)}
        />
      )}
    </div>
  );
}
