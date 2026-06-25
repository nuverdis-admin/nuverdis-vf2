"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  notificarTareaAsignada,
  notificarActualizacionTarea,
  notificarAsignacionMasiva,
} from "@/lib/supabase/notificaciones";
import { useAuthStore } from "@/lib/store/auth";
import { Layers, Ban, Trash2 } from "lucide-react";
import {
  getEstadoBadge,
  type ReporteConfig,
  type TareaAsignacionRow,
  type EquipoItem,
} from "@/lib/reportes";

interface JerarquiaCard {
  jerarquia_1: string;
  jerarquia_1_nombre: string;
  estandar: string;
  estandar_nombre?: string;
  total: number;
  asignadas: number;
  no_aplica: number;
}

interface EstandarCard {
  estandar: string;
  estandar_nombre: string;
  total: number;
  asignadas: number;
  no_aplica: number;
}

// ── PanelAsignacion ───────────────────────────────────────────────────────────

// NCG: contexto de la tarea (línea pequeña) = estándar + el tema solo cuando aporta
// un nivel extra (p. ej. "Perfil de la entidad · Propiedad" en 2.3.x). Cuando el tema
// coincide con el título (2.1, 3.1) muestra solo el estándar.
function contextoNcg(t: {
  estandar_nombre?: string;
  jerarquia_1_nombre: string;
  jerarquia_2_nombre: string;
}): string {
  const base = t.estandar_nombre ?? "";
  return t.jerarquia_1_nombre && t.jerarquia_1_nombre !== t.jerarquia_2_nombre
    ? `${base} · ${t.jerarquia_1_nombre}`
    : base;
}

function PanelAsignacion({
  config,
  tarea,
  equipos,
  proyectoRef,
  proyectoNombre,
  onSaved,
}: {
  config: ReporteConfig;
  tarea: TareaAsignacionRow; // Asegúrate de que esto incluye 'instruccion?: string | null' en tus tipos
  equipos: EquipoItem[];
  proyectoRef: string;
  proyectoNombre: string;
  onSaved: (tareaId: string, updates: Partial<TareaAsignacionRow>) => void;
}) {
  const [equipoId, setEquipoId] = useState(tarea.equipo_id?.toString() ?? "");
  const [fechaEncargado, setFechaEncargado] = useState(
  tarea.fecha_limite_encargado ?? ""
  );
  const [fechaRevisor, setFechaRevisor] = useState(
    tarea.fecha_limite_revisor ?? ""
  );
  // 1. Agregamos el estado para la instrucción
  const [instruccion, setInstruccion] = useState(tarea.instruccion ?? "");
  const [saving, setSaving] = useState(false);
  const [faseNoAplica, setFaseNoAplica] = useState<1 | 2>(1);

  const isReadOnly = tarea.estado === "completada";
  const isSavingOrReadOnly = saving || isReadOnly;

  const isFirstAssignment = tarea.estado === "sin_asignar";
  const hasChanges =
    equipoId !== (tarea.equipo_id?.toString() ?? "") ||
    fechaEncargado !== (tarea.fecha_limite_encargado ?? "") ||
    fechaRevisor !== (tarea.fecha_limite_revisor ?? "") ||
    instruccion !== (tarea.instruccion ?? "");

  const minFechaRevisor = fechaEncargado
    ? new Date(new Date(fechaEncargado).getTime() + 86400000)
      .toISOString()
      .split("T")[0]
    : undefined;

  async function handleAsignar() {
    if (!equipoId || !fechaEncargado || !fechaRevisor) return;
    setSaving(true);
    const supabase = createClient();
    const prevJson = {
      equipo_id: tarea.equipo_id,
      equipo_nombre: tarea.equipo_nombre,
      fecha_limite_encargado: tarea.fecha_limite_encargado,
      fecha_limite_revisor: tarea.fecha_limite_revisor,
      estado: tarea.estado,
      instruccion: tarea.instruccion,
    };
    const { error } = await supabase
      .from(config.tareasTable)
      .update({
        equipo_id: parseInt(equipoId),
        fecha_limite_encargado: fechaEncargado,
        fecha_limite_revisor: fechaRevisor,
        estado: "asignada",
        instruccion: instruccion || null,
      })
      .eq("tarea_id", tarea.tarea_id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    const nuevoEquipoNombre =
      equipos.find((e) => e.equipo_id.toString() === equipoId)?.nombre ?? null;
    await supabase.rpc("log_usuario_accion", {
      p_accion: isFirstAssignment ? config.logAcciones.asignar : "UPDATE_TAREA_ASIGNACION",
      p_tabla: config.tareasTable,
      p_registro_id: tarea.public_id ?? tarea.tarea_id,
      p_datos_prev: prevJson,
      p_datos_new: {
        equipo_id: parseInt(equipoId),
        equipo_nombre: nuevoEquipoNombre,
        fecha_limite_encargado: fechaEncargado,
        fecha_limite_revisor: fechaRevisor,
        estado: "asignada",
        instruccion: instruccion || null,
      },
      p_proyecto_id: tarea.proyecto_id,
    });
    toast.success(isFirstAssignment ? "Tarea asignada" : "Asignación actualizada");
    onSaved(tarea.tarea_id, {
      equipo_id: parseInt(equipoId),
      equipo_nombre: nuevoEquipoNombre,
      fecha_limite_encargado: fechaEncargado,
      fecha_limite_revisor: fechaRevisor,
      estado: "asignada",
      instruccion: instruccion || "",
    });
    if (isFirstAssignment) {
      void notificarTareaAsignada(parseInt(equipoId), {
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        proyectoId: tarea.proyecto_id,
        proyectoRef,
        proyectoNombre,
        tipoReporte: config.tipo,
      }).catch((err) => console.error("[handleAsignar] notif error:", err));
    } else {
      void notificarActualizacionTarea(parseInt(equipoId), {
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        proyectoId: tarea.proyecto_id,
        proyectoRef,
        tipoReporte: config.tipo,
      }).catch((err) => console.error("[handleAsignar] notif error:", err));
    }
    setSaving(false);
  }


  async function handleNoAplicaConfirm() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from(config.tareasTable)
      .update({ estado: "no_aplica" })
      .eq("tarea_id", tarea.tarea_id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.rpc("log_usuario_accion", {
      p_accion: config.logAcciones.noAplica,
      p_tabla: config.tareasTable,
      p_registro_id: tarea.public_id ?? tarea.tarea_id,
      p_datos_prev: { estado: tarea.estado },
      p_datos_new: { estado: "no_aplica" },
      p_proyecto_id: tarea.proyecto_id,
    });
    toast.success("Marcada como No aplica");
    setFaseNoAplica(1);
    onSaved(tarea.tarea_id, { estado: "no_aplica" });
    setSaving(false);
  }

  function handleNoAplica() {
    setFaseNoAplica(2);
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-gray-2">
      {/* Info + requerimientos */}
      <div className="p-5">
        <p className="mb-0.5 text-xs text-gray-4">
          {config.tipo === "NCG" ? contextoNcg(tarea) : tarea.jerarquia_1_nombre}
        </p>
        <p className="mb-3 text-sm font-semibold text-gray-9">
          {tarea.jerarquia_2_nombre}
        </p>
        {tarea.requerimientos && tarea.requerimientos.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-4">
              Requerimientos
            </p>
            {tarea.requerimientos.map((r) => (
              <div key={r.letra} className="flex gap-2 text-xs">
                <span className="w-4 shrink-0 font-semibold text-gray-5">
                  {r.letra})
                </span>
                <span className="whitespace-pre-line text-gray-7">{r.requerimiento_letra}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-4">Sin requerimientos registrados.</p>
        )}
      </div>

      {/* Formulario de asignación */}
      <div className="flex flex-col gap-4 p-5">
        <div>
          <label
            htmlFor={`equipo-${tarea.tarea_id}`}
            className="mb-1.5 block text-xs font-medium text-gray-5"
          >
            Equipo
          </label>
          <select
            id={`equipo-${tarea.tarea_id}`}
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            // CAMBIO AQUÍ: Bloqueamos si está guardando o si la tarea está completada
            disabled={isSavingOrReadOnly}
            className="h-9 w-full rounded-md border border-gray-3 bg-white px-3 text-sm text-gray-8 outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 disabled:bg-gray-1 disabled:text-gray-5 disabled:cursor-not-allowed"
          >
            <option value="">— Seleccionar —</option>
            {equipos.map((e) => (
              <option key={e.equipo_id} value={e.equipo_id.toString()}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`fecha-enc-${tarea.tarea_id}`}
              className="mb-1.5 block text-xs font-medium text-gray-5"
            >
              Fecha encargado
            </label>
            <input
              id={`fecha-enc-${tarea.tarea_id}`}
              type="date"
              value={fechaEncargado}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              onChange={(e) => {
                setFechaEncargado(e.target.value);
                if (fechaRevisor && e.target.value && fechaRevisor <= e.target.value) {
                  setFechaRevisor("");
                }
              }}
              // CAMBIO AQUÍ
              disabled={isSavingOrReadOnly}
              className="h-9 w-full rounded-md border border-gray-3 bg-white px-3 text-sm text-gray-8 outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 disabled:bg-gray-1 disabled:text-gray-5 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor={`fecha-rev-${tarea.tarea_id}`}
              className="mb-1.5 block text-xs font-medium text-gray-5"
            >
              Fecha revisor
            </label>
            <input
              id={`fecha-rev-${tarea.tarea_id}`}
              type="date"
              value={fechaRevisor}
              min={minFechaRevisor}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              onChange={(e) => setFechaRevisor(e.target.value)}
              // CAMBIO AQUÍ
              disabled={isSavingOrReadOnly}
              className="h-9 w-full rounded-md border border-gray-3 bg-white px-3 text-sm text-gray-8 outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 disabled:bg-gray-1 disabled:text-gray-5 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`instruccion-${tarea.tarea_id}`}
            className="mb-1.5 block text-xs font-medium text-gray-5"
          >
            Instrucciones adicionales (Opcional)
          </label>
          <textarea
            id={`instruccion-${tarea.tarea_id}`}
            value={instruccion}
            onChange={(e) => setInstruccion(e.target.value)}
            rows={3}
            placeholder={isReadOnly ? "Sin instrucciones" : "Ej: Revisar con prioridad el anexo B..."}
            // CAMBIO AQUÍ
            disabled={isSavingOrReadOnly}
            className="w-full resize-none rounded-md border border-gray-3 bg-white px-3 py-2 text-sm text-gray-8 outline-none transition-colors focus:border-primary-5 focus:ring-1 focus:ring-primary-5 disabled:bg-gray-1 disabled:text-gray-5 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex flex-col gap-3 pt-1">
          {faseNoAplica === 1 ? (
            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving || !hasChanges || !equipoId || !fechaEncargado || !fechaRevisor}
                onClick={handleAsignar}
                className="btn btn-primary gap-2 disabled:opacity-50 rounded-lg"
              >
                {saving && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isFirstAssignment ? "Asignar" : "Actualizar"}
              </button>
              {tarea.estado !== "no_aplica" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleNoAplica}
                  className="btn btn-outline disabled:opacity-50 rounded-lg"
                >
                  No aplica
                </button>
              )}
              {tarea.estado !== "sin_asignar" && tarea.estado !== "no_aplica" && (
                <a
                  href={`/dashboard/proyecto/${proyectoRef}/${config.tipo}/seguimiento/${tarea.public_id}`}
                  className="btn btn-outline rounded-lg"
                >
                  Ir a tarea
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-7 bg-gray-1 border border-gray-2 rounded-lg p-3">
                {isFirstAssignment
                  ? "¿Seguro deseas marcar como no aplica?"
                  : "¿Seguro deseas marcar como no aplica? Se perderá toda la data de la tarea."}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleNoAplicaConfirm}
                  className="btn btn-outline disabled:opacity-50 rounded-lg"
                >
                  {saving ? "Marcando..." : "Sí, marcar"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setFaseNoAplica(1)}
                  className="btn btn-outline rounded-lg disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ModalAsignacionMasiva ─────────────────────────────────────────────────────

const ESTADOS_ELEGIBLES = new Set(["sin_asignar"]);

function ModalAsignacionMasiva({
  open,
  onClose,
  tareas,
  equipos,
  config,
  proyectoId,
  proyectoRef,
  proyectoNombre,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tareas: TareaAsignacionRow[];
  equipos: EquipoItem[];
  config: ReporteConfig;
  proyectoId: string;
  proyectoRef: string;
  proyectoNombre: string;
  onSaved: (
    tareaIds: string[],
    equipoId: number,
    equipoNombre: string,
    fechaEnc: string,
    fechaRev: string
  ) => void;
}) {
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [equipoId, setEquipoId] = useState("");
  const [fechaEncargado, setFechaEncargado] = useState("");
  const [fechaRevisor, setFechaRevisor] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const elegibles = useMemo(
    () => tareas.filter((t) => ESTADOS_ELEGIBLES.has(t.estado)),
    [tareas]
  );

  const filtradas = useMemo(() => {
    if (!search.trim()) return elegibles;
    const q = search.toLowerCase();
    return elegibles.filter(
      (t) =>
        t.jerarquia_2_nombre.toLowerCase().includes(q) ||
        `${t.jerarquia_1}-${t.jerarquia_2}`.toLowerCase().includes(q) ||
        t.estandar.toLowerCase().includes(q)
    );
  }, [elegibles, search]);

  const todasSeleccionadas =
    filtradas.length > 0 &&
    filtradas.every((t) => seleccionadas.has(t.tarea_id));

  const minFechaRevisor = fechaEncargado
    ? new Date(new Date(fechaEncargado).getTime() + 86400000)
        .toISOString()
        .split("T")[0]
    : undefined;

  function toggleTarea(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    if (todasSeleccionadas) {
      setSeleccionadas((prev) => {
        const next = new Set(prev);
        filtradas.forEach((t) => next.delete(t.tarea_id));
        return next;
      });
    } else {
      setSeleccionadas((prev) => {
        const next = new Set(prev);
        filtradas.forEach((t) => next.add(t.tarea_id));
        return next;
      });
    }
  }

  function handleClose() {
    setSeleccionadas(new Set());
    setEquipoId("");
    setFechaEncargado("");
    setFechaRevisor("");
    setSearch("");
    onClose();
  }

  async function handleAsignarMasivo() {
    if (!equipoId || !fechaEncargado || !fechaRevisor || seleccionadas.size === 0) return;
    setSaving(true);

    const supabase = createClient();
    const tareaIds = Array.from(seleccionadas);
    const tareaIdsInt = tareaIds.map((id) => parseInt(id, 10));

    const { error } = await supabase.rpc(config.rpcAsignacionMasiva, {
      p_tarea_ids: tareaIdsInt,
      p_equipo_id: parseInt(equipoId, 10),
      p_fecha_enc: fechaEncargado,
      p_fecha_rev: fechaRevisor,
      p_proyecto_id: parseInt(proyectoId, 10),
    });

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    const equipoNombre =
      equipos.find((e) => e.equipo_id.toString() === equipoId)?.nombre ?? "";

    const itemsNotif = tareas
      .filter((t) => seleccionadas.has(t.tarea_id))
      .map((t) => ({
        jerarquia1: t.jerarquia_1,
        jerarquia2: t.jerarquia_2,
        nombre: t.jerarquia_2_nombre,
      }));

    toast.success(`${seleccionadas.size} tareas asignadas`);
    onSaved(tareaIds, parseInt(equipoId, 10), equipoNombre, fechaEncargado, fechaRevisor);

    void notificarAsignacionMasiva(parseInt(equipoId, 10), {
      proyectoId,
      proyectoRef,
      proyectoNombre,
      tipoReporte: config.tipo,
      items: itemsNotif,
    }).catch((err) => console.error("[handleAsignarMasivo] notif error:", err));

    handleClose();
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-modal border-t-4 border-primary-5 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-9">Asignación masiva</h2>
            <p className="text-xs text-gray-5 mt-0.5">
              Selecciona tareas y asígnalas a un equipo con las mismas fechas
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Cerrar modal"
            className="rounded-lg p-1.5 text-gray-4 hover:bg-gray-1 hover:text-gray-7 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 gap-4 px-6 pb-6">
          {/* Columna izquierda: lista de tareas */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-2">
            {/* Buscador + toggle seleccionar todo */}
            <div className="shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar tarea..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-full rounded-lg border border-gray-2 bg-gray-0 pl-8 pr-3 text-xs outline-none focus:border-primary-3"
                />
              </div>
              <button
                type="button"
                onClick={toggleTodas}
                className="shrink-0 text-xs text-primary-6 hover:text-primary-7 font-medium"
              >
                {todasSeleccionadas ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
            </div>

            {/* Conteo */}
            <p className="shrink-0 text-[11px] text-gray-4">
              {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? "s" : ""} de {elegibles.length} elegibles
            </p>

            {/* Lista scrolleable */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1 pr-1">
              {filtradas.length === 0 ? (
                <p className="text-xs text-gray-4 text-center py-6">Sin tareas elegibles</p>
              ) : (
                filtradas.map((tarea) => {
                  const checked = seleccionadas.has(tarea.tarea_id);
                  const { label: estadoLabel, badgeClass } = getEstadoBadge(config, tarea.estado);
                  return (
                    <label
                      key={tarea.tarea_id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                        checked
                          ? "border-primary-3 bg-primary-1"
                          : "border-gray-2 bg-white hover:bg-gray-1"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTarea(tarea.tarea_id)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-primary-5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-gray-8 truncate">
                          <span className="text-primary-6 font-semibold mr-1">
                            {tarea.jerarquia_1}-{tarea.jerarquia_2}
                          </span>
                          {tarea.jerarquia_2_nombre}
                        </span>
                        <span className="block text-[10px] text-gray-4 mt-0.5">{config.tipo === "NCG" ? contextoNcg(tarea) : `${tarea.estandar} · ${tarea.jerarquia_1_nombre}`}</span>
                      </span>
                      <span className={`${badgeClass} text-[10px] shrink-0 mt-0.5`}>{estadoLabel}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Columna derecha: formulario */}
          <div className="w-52 shrink-0 flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-6">Equipo</label>
              <select
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
                disabled={saving}
                aria-label="Equipo"
                title="Equipo"
                className="h-9 rounded-lg border border-gray-2 bg-white px-2.5 text-sm text-gray-8 outline-none focus:border-primary-3 disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {equipos.map((e) => (
                  <option key={e.equipo_id} value={e.equipo_id.toString()}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-6">Fecha límite encargado</label>
              <input
                type="date"
                value={fechaEncargado}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                onChange={(e) => {
                  setFechaEncargado(e.target.value);
                  if (fechaRevisor && e.target.value >= fechaRevisor) setFechaRevisor("");
                }}
                disabled={saving}
                aria-label="Fecha límite encargado"
                title="Fecha límite encargado"
                className="h-9 rounded-lg border border-gray-2 bg-white px-2.5 text-sm text-gray-8 outline-none focus:border-primary-3 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-6">Fecha límite revisor</label>
              <input
                type="date"
                value={fechaRevisor}
                min={minFechaRevisor}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                onChange={(e) => setFechaRevisor(e.target.value)}
                disabled={saving || !fechaEncargado}
                aria-label="Fecha límite revisor"
                title="Fecha límite revisor"
                className="h-9 rounded-lg border border-gray-2 bg-white px-2.5 text-sm text-gray-8 outline-none focus:border-primary-3 disabled:opacity-50"
              />
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleAsignarMasivo}
                disabled={
                  saving ||
                  seleccionadas.size === 0 ||
                  !equipoId ||
                  !fechaEncargado ||
                  !fechaRevisor
                }
                className="btn btn-primary rounded-lg w-full gap-2 disabled:opacity-50"
              >
                {saving && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Asignando..." : `Asignar ${seleccionadas.size > 0 ? seleccionadas.size : ""} tareas`}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="btn btn-outline rounded-lg w-full disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── ModalNoAplicaMasiva ───────────────────────────────────────────────────────

function ModalNoAplicaMasiva({
  open,
  onClose,
  tareas,
  config,
  proyectoId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tareas: TareaAsignacionRow[];
  config: ReporteConfig;
  proyectoId: string;
  onSaved: (tareaIds: string[]) => void;
}) {
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const elegibles = useMemo(
    () => tareas.filter((t) => t.estado === "sin_asignar"),
    [tareas]
  );

  const filtradas = useMemo(() => {
    if (!search.trim()) return elegibles;
    const q = search.toLowerCase();
    return elegibles.filter(
      (t) =>
        t.jerarquia_2_nombre.toLowerCase().includes(q) ||
        `${t.jerarquia_1}-${t.jerarquia_2}`.toLowerCase().includes(q) ||
        t.estandar.toLowerCase().includes(q)
    );
  }, [elegibles, search]);

  function toggleTarea(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setSeleccionadas(new Set());
    setSearch("");
    onClose();
  }

  async function handleMarcarNoAplica() {
    if (seleccionadas.size === 0) return;
    setSaving(true);

    const supabase = createClient();
    const tareaIds = Array.from(seleccionadas);
    const tareaIdsInt = tareaIds.map((id) => parseInt(id, 10));

    const { error } = await supabase.rpc(config.rpcNoAplicaMasiva, {
      p_tarea_ids: tareaIdsInt,
      p_proyecto_id: parseInt(proyectoId, 10),
    });

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success(`${seleccionadas.size} tareas marcadas como no aplica`);
    onSaved(tareaIds);

    handleClose();
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-modal border-t-4 border-[var(--color-secondary-5)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-9">Marcar como no aplica</h2>
            <p className="text-xs text-gray-5 mt-0.5">
              Selecciona tareas que no aplican a este proyecto
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Cerrar modal"
            className="rounded-lg p-1.5 text-gray-4 hover:bg-[var(--color-secondary-1)] hover:text-[var(--color-secondary-7)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-3 px-6 pb-6">
          {/* Buscador */}
          <div className="shrink-0">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-secondary-4)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar tarea..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-gray-2 bg-white pl-8 pr-3 text-xs outline-none focus:border-gray-3"
              />
            </div>
          </div>

          {/* Conteo */}
          <p className="shrink-0 text-[11px] text-[var(--color-secondary-5)]">
            {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? "s" : ""} de {elegibles.length} elegibles
          </p>

          {/* Lista scrolleable */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1 pr-1 
            [&::-webkit-scrollbar]:w-1.5 
            [&::-webkit-scrollbar-track]:bg-transparent 
            [&::-webkit-scrollbar-thumb]:bg-[var(--color-secondary-5)] 
            [&::-webkit-scrollbar-thumb]:rounded-full 
            [scrollbar-width:thin] 
            [scrollbar-color:var(--color-secondary-5)_transparent]"
          >
            {filtradas.length === 0 ? (
              <p className="text-xs text-[var(--color-secondary-4)] text-center py-6">Sin tareas para marcar</p>
            ) : (
              filtradas.map((tarea) => {
                const checked = seleccionadas.has(tarea.tarea_id);
                const { label: estadoLabel, badgeClass } = getEstadoBadge(config, tarea.estado);
                return (
                  <label
                    key={tarea.tarea_id}
                    className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      checked
                        ? "border-[var(--color-secondary-5)] bg-[var(--color-secondary-0)]"
                        : "border-gray-2 bg-white hover:bg-[var(--color-secondary-0)] hover:border-[var(--color-secondary-2)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTarea(tarea.tarea_id)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-[var(--color-secondary-5)]"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-gray-8 truncate">
                        <span className="text-[var(--color-secondary-6)] font-semibold mr-1">
                          {tarea.jerarquia_1}-{tarea.jerarquia_2}
                        </span>
                        {tarea.jerarquia_2_nombre}
                      </span>
                      <span className="block text-[10px] text-gray-4 mt-0.5">{config.tipo === "NCG" ? contextoNcg(tarea) : `${tarea.estandar} · ${tarea.jerarquia_1_nombre}`}</span>
                    </span>
                    <span className={`${badgeClass} text-[10px] shrink-0 mt-0.5`}>{estadoLabel}</span>
                  </label>
                );
              })
            )}
          </div>

          {/* Botones */}
          <div className="shrink-0 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleMarcarNoAplica}
              disabled={saving || seleccionadas.size === 0}
              className="btn text-white rounded-lg gap-2 disabled:opacity-50 h-9 flex items-center justify-center bg-[var(--color-secondary-5)] hover:bg-[var(--color-secondary-6)]"
            >
              {saving && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? "Marcando..." : `Marcar ${seleccionadas.size > 0 ? seleccionadas.size : ""} como no aplica`}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="btn btn-outline rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModalEliminacionMasiva ────────────────────────────────────────────────────

function ModalEliminacionMasiva({
  open,
  onClose,
  tareas,
  config,
  proyectoId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tareas: TareaAsignacionRow[];
  config: ReporteConfig;
  proyectoId: string;
  onSaved: (tareaIds: string[]) => void;
}) {
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [fase, setFase] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState(5);

  const elegibles = useMemo(
    () => tareas.filter((t) => t.estado !== "sin_asignar" && t.estado !== "no_aplica"),
    [tareas]
  );

  const filtradas = useMemo(() => {
    if (!search.trim()) return elegibles;
    const q = search.toLowerCase();
    return elegibles.filter(
      (t) =>
        t.jerarquia_2_nombre.toLowerCase().includes(q) ||
        `${t.jerarquia_1}-${t.jerarquia_2}`.toLowerCase().includes(q) ||
        t.estandar.toLowerCase().includes(q)
    );
  }, [elegibles, search]);

  const todasSeleccionadas =
    filtradas.length > 0 && filtradas.every((t) => seleccionadas.has(t.tarea_id));

  function toggleTarea(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    if (todasSeleccionadas) {
      setSeleccionadas((prev) => {
        const next = new Set(prev);
        filtradas.forEach((t) => next.delete(t.tarea_id));
        return next;
      });
    } else {
      setSeleccionadas((prev) => {
        const next = new Set(prev);
        filtradas.forEach((t) => next.add(t.tarea_id));
        return next;
      });
    }
  }

  function handleClose() {
    if (saving) return;
    setSeleccionadas(new Set());
    setSearch("");
    setFase(1);
    setCountdown(5);
    onClose();
  }

  // Countdown cuando se entra a fase 3
  useEffect(() => {
    if (fase !== 3) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fase]);

  async function handleEliminar() {
    if (seleccionadas.size === 0) return;
    setSaving(true);

    const supabase = createClient();
    const tareaIds = Array.from(seleccionadas);
    const tareaIdsInt = tareaIds.map((id) => parseInt(id, 10));

    const { error } = await supabase.rpc(config.rpcEliminacionMasiva, {
      p_tarea_ids: tareaIdsInt,
      p_proyecto_id: parseInt(proyectoId, 10),
    });

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success(`${seleccionadas.size} tareas eliminadas`);
    onSaved(tareaIds);
    handleClose();
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-modal border-t-4 border-critique-6 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-critique-7">Eliminación masiva</h2>
            <p className="text-xs text-gray-5 mt-0.5">
              Selecciona tareas para resetear a sin asignar
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            title="Cerrar modal"
            className="rounded-lg p-1.5 text-gray-4 hover:bg-gray-1 hover:text-gray-7 transition-colors disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-3 px-6 pb-6">
          {/* FASE 1: selección de tareas */}
          {fase === 1 && (
            <>
              <div className="shrink-0 flex items-center gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar tarea..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-full rounded-lg border border-gray-2 bg-white pl-8 pr-3 text-xs outline-none focus:border-gray-3"
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleTodas}
                  className="shrink-0 text-xs text-critique-5 hover:text-critique-4 font-medium"
                >
                  {todasSeleccionadas ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
              </div>

              <p className="shrink-0 text-[11px] text-critique-5">
                {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? "s" : ""} de {elegibles.length} elegibles
              </p>

                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1 pr-1 
                  [&::-webkit-scrollbar]:w-1.5 
                  [&::-webkit-scrollbar-track]:bg-transparent 
                  [&::-webkit-scrollbar-thumb]:bg-critique-5 
                  [&::-webkit-scrollbar-thumb]:rounded-full 
                  [scrollbar-width:thin] 
                  [scrollbar-color:theme(colors.critique.5)_transparent]"
                >
                  {filtradas.length === 0 ? (
                  <p className="text-xs text-gray-4 text-center py-6">Sin tareas elegibles</p>
                ) : (
                  filtradas.map((tarea) => {
                    const checked = seleccionadas.has(tarea.tarea_id);
                    const { label: estadoLabel, badgeClass } = getEstadoBadge(config, tarea.estado);
                    return (
                      <label
                        key={tarea.tarea_id}
                        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          checked
                            ? "border-critique-5 bg-critique-1"
                            : "border-gray-2 bg-white hover:bg-critique-1 hover:border-critique-2"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTarea(tarea.tarea_id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-critique-5"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-gray-8 truncate">
                            <span className="text-critique-6 font-semibold mr-1">
                              {tarea.jerarquia_1}-{tarea.jerarquia_2}
                            </span>
                            {tarea.jerarquia_2_nombre}
                          </span>
                          <span className="block text-[10px] text-gray-4 mt-0.5">{config.tipo === "NCG" ? contextoNcg(tarea) : `${tarea.estandar} · ${tarea.jerarquia_1_nombre}`}</span>
                        </span>
                        <span className={`${badgeClass} text-[10px] shrink-0 mt-0.5`}>{estadoLabel}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFase(2)}
                  disabled={seleccionadas.size === 0}
                  className="btn bg-critique-6 text-white hover:bg-critique-7 rounded-lg gap-2 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar {seleccionadas.size > 0 ? seleccionadas.size : ""} tareas
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-outline rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

          {/* FASE 2: primera advertencia */}
          {fase === 2 && (
            <>
              <div className="flex-1 flex flex-col justify-center gap-4">
                <div className="rounded-lg border border-critique-3 bg-critique-1 p-4">
                  <p className="text-sm font-semibold text-critique-7 mb-2">⚠ Advertencia importante</p>
                  <p className="text-sm text-critique-7">
                    Estás a punto de resetear <strong>{seleccionadas.size} tarea{seleccionadas.size !== 1 ? "s" : ""}</strong> a estado <em>sin asignar</em>.
                  </p>
                  <ul className="mt-3 flex flex-col gap-1.5 text-xs text-critique-6 list-disc list-inside">
                    <li>Todas las respuestas ingresadas se perderán definitivamente</li>
                    <li>El historial de cambios de estas tareas se perderá</li>
                    <li>Los mensajes del chat de cada tarea se perderán</li>
                    <li>Esta acción <strong>no se puede deshacer</strong></li>
                  </ul>
                </div>
              </div>
              <div className="shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFase(3)}
                  className="btn bg-critique-6 text-white hover:bg-critique-7 rounded-lg"
                >
                  Entiendo, continuar
                </button>
                <button
                  type="button"
                  onClick={() => setFase(1)}
                  className="btn btn-outline rounded-lg"
                >
                  Volver
                </button>
              </div>
            </>
          )}

          {/* FASE 3: confirmación final con countdown */}
          {fase === 3 && (
            <>
              <div className="flex-1 flex flex-col justify-center gap-4">
                <div className="rounded-lg border border-critique-3 bg-critique-1 p-4">
                  <p className="text-sm font-semibold text-critique-7 mb-2">Confirmación final</p>
                  <p className="text-sm text-critique-7">
                    Entendiendo lo anterior, ¿deseas continuar y eliminar definitivamente las{" "}
                    <strong>{seleccionadas.size} tarea{seleccionadas.size !== 1 ? "s" : ""}</strong> seleccionadas?
                  </p>
                </div>
                {countdown > 0 && (
                  <p className="text-center text-xs text-gray-5">
                    El botón de confirmación estará disponible en{" "}
                    <span className="font-semibold text-critique-6">{countdown}s</span>
                  </p>
                )}
              </div>
              <div className="shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={handleEliminar}
                  disabled={saving || countdown > 0}
                  className="btn bg-critique-6 text-white hover:bg-critique-7 rounded-lg gap-2 disabled:opacity-50"
                >
                  {saving && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {saving
                    ? "Eliminando..."
                    : countdown > 0
                    ? `Eliminar (${countdown})`
                    : "Sí, eliminar definitivamente"}
                </button>
                <button
                  type="button"
                  onClick={() => setFase(2)}
                  disabled={saving}
                  className="btn btn-outline rounded-lg disabled:opacity-50"
                >
                  Volver
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AsignacionesView ──────────────────────────────────────────────────────────

export function AsignacionesView({
  config,
  proyectoId,
  proyectoRef,
  proyectoNombre,
  equipos,
}: {
  config: ReporteConfig;
  proyectoId: string;
  proyectoRef: string;
  proyectoNombre: string;
  equipos: EquipoItem[];
}) {
  const rol = useAuthStore((s) => s.usuarioActual?.rol);
  const [tareas, setTareas] = useState<TareaAsignacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [jerarquia1Sel, setJerarquia1Sel] = useState<string | null>(null);
  const [openTareaId, setOpenTareaId] = useState<string | null>(null);
  const [openJ1Group, setOpenJ1Group] = useState<string | null>(null);
  const [modalMasivo, setModalMasivo] = useState(false);
  const [modalNoAplica, setModalNoAplica] = useState(false);
  const [modalEliminacion, setModalEliminacion] = useState(false);

  // 1. Nuevos estados para los buscadores
  const [searchJerarquia1, setSearchJerarquia1] = useState("");
  const [searchJerarquia2, setSearchJerarquia2] = useState("");

  const hasAutoSel = useRef(false);

  useEffect(() => {
    if (!proyectoId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    async function cargar() {
      setLoading(true);
      const { data } = await supabase
        .from(config.tareasView)
        .select("*")
        .eq("proyecto_id", proyectoId)
        .order("jerarquia_1", { ascending: true })
        // Cambiamos el segundo orden de nombre a jerarquia_2
        .order("jerarquia_2", { ascending: true });
      // jerarquia_1/jerarquia_2 son smallint en la BD (PostgREST los entrega como
      // number), pero el resto del componente los trata como string (localeCompare,
      // replace, comparaciones). Normalizamos a string en la carga para honrar el tipo.
      const normalizadas = ((data ?? []) as TareaAsignacionRow[]).map((t) => ({
        ...t,
        jerarquia_1: t.jerarquia_1 == null ? t.jerarquia_1 : String(t.jerarquia_1),
        jerarquia_2: t.jerarquia_2 == null ? t.jerarquia_2 : String(t.jerarquia_2),
      }));
      setTareas(normalizadas);
      setLoading(false);
    }
    cargar();
  }, [proyectoId, config.tareasView]);

  useEffect(() => {
    if (!loading && !hasAutoSel.current && tareas.length > 0) {
      hasAutoSel.current = true;
      const foco = useAuthStore.getState().asignacionFoco;
      if (foco) {
        setJerarquia1Sel(foco.jerarquia1);
        setOpenTareaId(foco.tareaId);
        if (foco.j1Group) setOpenJ1Group(foco.j1Group);
        useAuthStore.getState().setAsignacionFoco(null);
      } else if (config.tipo === "NCG") {
        // estandares está ordenado numéricamente; usamos el primero de esa lista.
        const primerEstandar = Array.from(
          new Map(tareas.map((t) => [t.estandar, t])).entries()
        ).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))[0]?.[0];
        setJerarquia1Sel(primerEstandar ?? null);
      } else {
        setJerarquia1Sel(tareas[0].jerarquia_1 ?? tareas[0].jerarquia_1_nombre);
      }
    }
  }, [loading, tareas, config.tipo]);

  const jerarquias = useMemo<JerarquiaCard[]>(() => {
    const map = new Map<string, JerarquiaCard>();
    for (const t of tareas) {
      const key = t.jerarquia_1 ?? t.jerarquia_1_nombre;
      if (!map.has(key)) {
        map.set(key, {
          jerarquia_1: key,
          jerarquia_1_nombre: t.jerarquia_1_nombre,
          estandar: t.estandar,
          estandar_nombre: t.estandar_nombre,
          total: 0,
          asignadas: 0,
          no_aplica: 0,
        });
      }
      const card = map.get(key)!;
      card.total++;
      if (t.estado !== "sin_asignar") card.asignadas++;
      if (t.estado === "no_aplica") card.no_aplica++;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.jerarquia_1.localeCompare(b.jerarquia_1, undefined, { numeric: true })
    );
  }, [tareas]);

  // 1b. Para NCG: agrupamos por estandar
  const estandares = useMemo<EstandarCard[]>(() => {
    if (config.tipo !== "NCG") return [];
    const map = new Map<string, EstandarCard>();
    for (const t of tareas) {
      const key = t.estandar;
      if (!map.has(key)) {
        map.set(key, {
          estandar: key,
          estandar_nombre: t.estandar_nombre ?? key,
          total: 0,
          asignadas: 0,
          no_aplica: 0,
        });
      }
      const card = map.get(key)!;
      card.total++;
      if (t.estado !== "sin_asignar") card.asignadas++;
      if (t.estado === "no_aplica") card.no_aplica++;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.estandar.localeCompare(b.estandar, undefined, { numeric: true })
    );
  }, [tareas, config.tipo]);

  // 2. Filtramos la jerarquía 1 basado en la búsqueda izquierda
  const jerarquiasFiltradas = useMemo(() => {
    if (!searchJerarquia1.trim()) return jerarquias;
    const lowerSearch = searchJerarquia1.toLowerCase();

    return jerarquias.filter((j) => {
      // 1. Preparamos el ID con guion (si es "2 2" lo vuelve "2-2")
      const idConGuion = j.jerarquia_1?.toString().replace(/\s+/g, '-') ?? "";

      // 2. Creamos una sola cadena con TODO lo que el usuario ve
      // Ejemplo: "GRI 2-2 Contenidos generales"
      const cadenaCompleta = `${j.estandar} ${idConGuion} ${j.jerarquia_1_nombre}`.toLowerCase();

      // 3. Buscamos si lo que escribió el usuario está en esa cadena
      return cadenaCompleta.includes(lowerSearch);
    });
  }, [jerarquias, searchJerarquia1]);

  // 2b. Para NCG: filtramos estandares por búsqueda izquierda
  const estandaresFiltrados = useMemo<EstandarCard[]>(() => {
    if (config.tipo !== "NCG") return estandares;
    if (!searchJerarquia1.trim()) return estandares;
    const q = searchJerarquia1.toLowerCase();
    return estandares.filter(
      (e) =>
        e.estandar_nombre.toLowerCase().includes(q) ||
        `${e.estandar}`.includes(q)
    );
  }, [estandares, searchJerarquia1, config.tipo]);

  // 3. Filtramos las tareas visibles por la selección Y por la búsqueda derecha
  // 3. Filtramos y ORDENAMOS las tareas visibles
  const tareasVisibles = useMemo(() => {
    // 1. Primero filtramos por la categoría seleccionada a la izquierda
    let filtradas = tareas.filter((t) =>
      config.tipo === "NCG"
        ? t.estandar === jerarquia1Sel
        : (t.jerarquia_1 ?? t.jerarquia_1_nombre) === jerarquia1Sel
    );

    // 2. Aplicamos la lógica de búsqueda
    if (searchJerarquia2.trim()) {
      const lowerSearch = searchJerarquia2.toLowerCase();

      filtradas = filtradas.filter((t) => {
        // Creamos el código completo (ej: "2-1")
        const codigoCompleto = `${t.jerarquia_1}-${t.jerarquia_2}`.toLowerCase();

        // Creamos una variante sin guion por si el usuario busca "2 1"
        const codigoEspacio = `${t.jerarquia_1} ${t.jerarquia_2}`.toLowerCase();

        // Comprobamos si coincide con:
        return (
          codigoCompleto.includes(lowerSearch) || // Coincidencia con "2-1"
          codigoEspacio.includes(lowerSearch) || // Coincidencia con "2 1"
          t.jerarquia_2_nombre.toLowerCase().includes(lowerSearch) || // Coincidencia con nombre
          (t.codigo_item && t.codigo_item.toLowerCase().includes(lowerSearch)) // Coincidencia con código interno
        );
      });
    }

    // 3. Ordenamos el resultado final numéricamente
    return filtradas.sort((a, b) => {
      const codA = `${a.jerarquia_1}-${a.jerarquia_2}`;
      const codB = `${b.jerarquia_1}-${b.jerarquia_2}`;
      return codA.localeCompare(codB, undefined, { numeric: true });
    });
  }, [tareas, jerarquia1Sel, searchJerarquia2]);

  // 3b. Para NCG: agrupamos tareasVisibles por jerarquia_1 para el panel de dos niveles
  const tareasAgrupadasPorJ1 = useMemo(() => {
    if (config.tipo !== "NCG") return [];
    const map = new Map<
      string,
      { jerarquia_1: string; jerarquia_1_nombre: string; tasks: TareaAsignacionRow[] }
    >();
    for (const t of tareasVisibles) {
      if (!map.has(t.jerarquia_1)) {
        map.set(t.jerarquia_1, {
          jerarquia_1: t.jerarquia_1,
          jerarquia_1_nombre: t.jerarquia_1_nombre,
          tasks: [],
        });
      }
      map.get(t.jerarquia_1)!.tasks.push(t);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.jerarquia_1.localeCompare(b.jerarquia_1, undefined, { numeric: true })
    );
  }, [tareasVisibles, config.tipo]);

  function handleSaved(tareaId: string, updates: Partial<TareaAsignacionRow>) {
    setTareas((prev) =>
      prev.map((t) => (t.tarea_id === tareaId ? { ...t, ...updates } : t))
    );
    setOpenTareaId(null);
  }

  function handleSavedMasivo(
    tareaIds: string[],
    equipoIdNum: number,
    equipoNombre: string,
    fechaEnc: string,
    fechaRev: string
  ) {
    const ids = new Set(tareaIds);
    setTareas((prev) =>
      prev.map((t) =>
        ids.has(t.tarea_id)
          ? {
              ...t,
              equipo_id: equipoIdNum,
              equipo_nombre: equipoNombre,
              fecha_limite_encargado: fechaEnc,
              fecha_limite_revisor: fechaRev,
              estado: "asignada",
            }
          : t
      )
    );
  }

  function handleSavedNoAplica(tareaIds: string[]) {
    const ids = new Set(tareaIds);
    setTareas((prev) =>
      prev.map((t) =>
        ids.has(t.tarea_id) ? { ...t, estado: "no_aplica" } : t
      )
    );
  }

  function handleSavedEliminacion(tareaIds: string[]) {
    const ids = new Set(tareaIds);
    setTareas((prev) =>
      prev.map((t) =>
        ids.has(t.tarea_id)
          ? {
              ...t,
              estado: "sin_asignar",
              equipo_id: null,
              equipo_nombre: null,
              fecha_limite_encargado: null,
              fecha_limite_revisor: null,
              instruccion: "",
            }
          : t
      )
    );
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-240px)] gap-4 overflow-hidden">
        <div className="flex w-52 shrink-0 flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-2" />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-gray-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-[calc(100vh-240px)] gap-4 overflow-hidden">

      {/* Panel izquierdo: cards jerarquía */}
      <div className="flex w-52 shrink-0 flex-col gap-3">
        {/* Buscador Izquierdo */}
        <div className="relative shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por estandar..."
            value={searchJerarquia1}
            onChange={(e) => setSearchJerarquia1(e.target.value)}
            className="h-11 w-full rounded-xl border border-gray-2 bg-white pl-9 pr-3 text-sm text-gray-8 outline-none transition-colors focus:border-primary-3 focus:ring-1 focus:ring-primary-3"
          />
        </div>


        {/* Scroll de jerarquías */}
        <div className="flex-1 overflow-y-auto pb-4 pr-1">
          <div className="flex flex-col gap-2">
            {config.tipo === "NCG" ? (
              /* NCG: cards agrupadas por estandar */
              estandaresFiltrados.length === 0 ? (
                <p className="text-center text-xs text-gray-5 py-4">No se encontraron grupos.</p>
              ) : (
                estandaresFiltrados.map((e) => {
                  const pct = e.total > 0 ? Math.round((e.asignadas / e.total) * 100) : 0;
                  const activa = jerarquia1Sel === e.estandar;
                  return (
                    <button
                      key={e.estandar}
                      type="button"
                      onClick={() => {
                        setJerarquia1Sel(e.estandar);
                        setOpenTareaId(null);
                        setOpenJ1Group(null);
                        setSearchJerarquia2("");
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        activa
                          ? "border-primary-3 bg-primary-1"
                          : "border-gray-2 bg-white hover:border-gray-3 hover:bg-gray-1"
                      }`}
                    >
                      <p
                        className={`mb-2 text-[11px] font-semibold leading-snug ${
                          activa ? "text-primary-7" : "text-gray-7"
                        }`}
                      >
                        NCG {e.estandar}
                        {" · "}
                        {e.estandar_nombre}
                      </p>
                      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-gray-2">
                        <div
                          className="h-full rounded-full bg-success-5 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] ${activa ? "text-primary-6" : "text-gray-5"}`}>
                          {e.asignadas}/{e.total} asignadas
                        </span>
                        {e.no_aplica > 0 && (
                          <span className="text-[10px] text-gray-4">{e.no_aplica} N/A</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              /* GRI/SASB: cards por jerarquia_1 (comportamiento original) */
              jerarquiasFiltradas.length === 0 ? (
                <p className="text-center text-xs text-gray-5 py-4">No se encontraron grupos.</p>
              ) : (
                jerarquiasFiltradas.map((j) => {
                  const pct = j.total > 0 ? Math.round((j.asignadas / j.total) * 100) : 0;
                  const activa = jerarquia1Sel === j.jerarquia_1;
                  return (
                    <button
                      key={j.jerarquia_1}
                      type="button"
                      onClick={() => {
                        setJerarquia1Sel(j.jerarquia_1);
                        setOpenTareaId(null);
                        setSearchJerarquia2("");
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        activa
                          ? "border-primary-3 bg-primary-1"
                          : "border-gray-2 bg-white hover:border-gray-3 hover:bg-gray-1"
                      }`}
                    >
                      <p
                        className={`mb-2 text-[11px] font-semibold leading-snug ${
                          activa ? "text-primary-7" : "text-gray-7"
                        }`}
                      >
                        {j.estandar}
                        {j.jerarquia_1 && !j.estandar.includes(j.jerarquia_1.toString()) && (
                          ` ${j.jerarquia_1}`
                        )}
                        {" · "}
                        {j.jerarquia_1_nombre}
                      </p>
                      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-gray-2">
                        <div
                          className="h-full rounded-full bg-success-5 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] ${activa ? "text-primary-6" : "text-gray-5"}`}>
                          {j.asignadas}/{j.total} asignadas
                        </span>
                        {j.no_aplica > 0 && (
                          <span className="text-[10px] text-gray-4">{j.no_aplica} N/A</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Panel derecho: acordeón */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Buscador Derecho + botones masivos admin */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Buscador: en masivo+ ocupa todo el espacio; en compacto 50% */}
          <div className="relative w-1/2 masivo:w-auto masivo:flex-1 min-w-0">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar tarea específica por nombre o código..."
              value={searchJerarquia2}
              onChange={(e) => setSearchJerarquia2(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-2 bg-white pl-10 pr-4 text-sm text-gray-8 outline-none transition-colors focus:border-primary-3 focus:ring-1 focus:ring-primary-3"
            />
          </div>

          {rol === "administrador" && (
            <>
              {/* ≥1150px: 3 botones individuales */}
              <div className="hidden masivo:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalMasivo(true)}
                  className="h-11 btn btn-outline rounded-xl text-sm flex items-center gap-2 px-4"
                >
                  <Layers className="h-4 w-4 shrink-0" />
                  Asignación masiva
                </button>
                <button
                  type="button"
                  onClick={() => setModalNoAplica(true)}
                  className="h-11 btn btn-outline rounded-xl text-sm flex items-center gap-2 px-4"
                >
                  <Ban className="h-4 w-4 shrink-0" />
                  No aplica masivo
                </button>
                <button
                  type="button"
                  onClick={() => setModalEliminacion(true)}
                  className="h-11 btn btn-outline rounded-xl text-sm flex items-center gap-2 px-4 text-critique-6 border-critique-3 hover:bg-critique-1"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  Eliminación masiva
                </button>
              </div>

              {/* <1150px: select 50% — mismo estilo que los inputs del diseño */}
              <div className="flex masivo:hidden w-1/2 min-w-0">
                <select
                  aria-label="Acciones masivas"
                  className="h-11 w-full rounded-xl border border-gray-2 bg-white px-3 pr-8 text-sm text-gray-7 outline-none transition-colors focus:border-primary-3 focus:ring-1 focus:ring-primary-3 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23B2B2B2%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "masivo") setModalMasivo(true);
                    else if (val === "no_aplica") setModalNoAplica(true);
                    else if (val === "eliminacion") setModalEliminacion(true);
                  }}
                >
                  <option value="" disabled>⚡ Acciones masivas</option>
                  <option value="masivo">Asignación masiva</option>
                  <option value="no_aplica">No aplica masivo</option>
                  <option value="eliminacion">Eliminación masiva</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Scroll de acordeones */}
        <div className="flex-1 overflow-y-auto pb-4 pr-1">
          <div className="flex flex-col gap-1.5">
            {config.tipo === "NCG" ? (
              /* ── NCG: acordeón de dos niveles ── */
              tareasAgrupadasPorJ1.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-gray-5 py-10">
                  {searchJerarquia2
                    ? "No se encontraron tareas con esa búsqueda."
                    : "No hay tareas en esta sección."}
                </div>
              ) : (
                tareasAgrupadasPorJ1.map((grupo) => {
                  const codigoJ1 = grupo.jerarquia_1.replace(/\./g, "-");
                  const hasSubs = grupo.tasks.some((t) => t.jerarquia_2 !== "0");
                  const isGroupOpen = openJ1Group === grupo.jerarquia_1;

                  if (!hasSubs) {
                    /* Grupo simple (j2=0): un único ítem, abre PanelAsignacion directo */
                    const tarea = grupo.tasks[0];
                    const isOpen = openTareaId === tarea.tarea_id;
                    const { label: estadoLabel, badgeClass } = getEstadoBadge(config, tarea.estado);
                    const esNoAplica = tarea.estado === "no_aplica";
                    return (
                      <div
                        key={grupo.jerarquia_1}
                        className={`shrink-0 overflow-hidden rounded-xl border transition-shadow ${
                          isOpen ? "border-primary-3 shadow-card" : "border-gray-2 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenTareaId(isOpen ? null : tarea.tarea_id)}
                          className="flex w-full items-center justify-between bg-white px-4 py-3 text-left transition-colors hover:bg-gray-1"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              className={`flex-1 truncate text-sm font-medium ${
                                esNoAplica ? "text-gray-4 line-through" : "text-gray-8"
                              }`}
                            >
                              <span className="text-primary-6 font-bold mr-2">{codigoJ1}</span>
                              {grupo.jerarquia_1_nombre}
                            </span>
                            {tarea.codigo_item && (
                              <span className="shrink-0 text-xs text-gray-4 bg-gray-1 px-1.5 py-0.5 rounded">
                                {tarea.codigo_item}
                              </span>
                            )}
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span className={badgeClass}>{estadoLabel}</span>
                            <svg
                              className={`h-4 w-4 text-gray-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-gray-2 bg-white">
                            <PanelAsignacion
                              config={config}
                              tarea={tarea}
                              equipos={equipos}
                              proyectoRef={proyectoRef}
                              proyectoNombre={proyectoNombre}
                              onSaved={handleSaved}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }

                  /* Grupo con sub-ítems (j2>0): cabecera expandible + sub-acordeones */
                  return (
                    <div key={grupo.jerarquia_1} className="shrink-0 overflow-hidden rounded-xl border border-gray-2 bg-white">
                      {/* Cabecera del grupo */}
                      <button
                        type="button"
                        onClick={() => {
                          setOpenJ1Group(isGroupOpen ? null : grupo.jerarquia_1);
                          setOpenTareaId(null);
                        }}
                        className="flex w-full items-center justify-between bg-gray-1 px-4 py-3 text-left transition-colors hover:bg-gray-2"
                      >
                        <span className="text-sm font-semibold text-gray-8">
                          <span className="text-primary-6 font-bold mr-2">{codigoJ1}</span>
                          {grupo.jerarquia_1_nombre}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-5">{grupo.tasks.length} ítems</span>
                          <svg
                            className={`h-4 w-4 text-gray-4 transition-transform ${isGroupOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Sub-ítems expandidos */}
                      {isGroupOpen && (
                        <div className="flex flex-col border-t border-gray-2">
                          {grupo.tasks.map((tarea) => {
                            const isOpen = openTareaId === tarea.tarea_id;
                            const { label: estadoLabel, badgeClass } = getEstadoBadge(config, tarea.estado);
                            const esNoAplica = tarea.estado === "no_aplica";
                            const codigoSub = `${tarea.jerarquia_1.replace(/\./g, "-")}-${tarea.jerarquia_2}`;
                            return (
                              <div
                                key={tarea.tarea_id}
                                className={`border-b border-gray-2 last:border-b-0 ${
                                  isOpen ? "bg-primary-1" : "bg-white"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setOpenTareaId(isOpen ? null : tarea.tarea_id)}
                                  className="flex w-full items-center justify-between px-5 py-2.5 text-left transition-colors hover:bg-gray-1"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <span
                                      className={`flex-1 truncate text-sm font-medium ${
                                        esNoAplica ? "text-gray-4 line-through" : "text-gray-8"
                                      }`}
                                    >
                                      <span className="text-primary-6 font-bold mr-2">{codigoSub}</span>
                                      {tarea.jerarquia_2_nombre}
                                    </span>
                                    {tarea.codigo_item && (
                                      <span className="shrink-0 text-xs text-gray-4 bg-gray-1 px-1.5 py-0.5 rounded">
                                        {tarea.codigo_item}
                                      </span>
                                    )}
                                  </div>
                                  <div className="ml-3 flex shrink-0 items-center gap-2">
                                    <span className={badgeClass}>{estadoLabel}</span>
                                    <svg
                                      className={`h-4 w-4 text-gray-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </button>
                                {isOpen && (
                                  <div className="border-t border-gray-2 bg-white">
                                    <PanelAsignacion
                                      config={config}
                                      tarea={tarea}
                                      equipos={equipos}
                                      proyectoRef={proyectoRef}
                                      proyectoNombre={proyectoNombre}
                                      onSaved={handleSaved}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : (
              /* ── GRI/SASB: acordeón original de un nivel ── */
              tareasVisibles.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-gray-5 py-10">
                  {searchJerarquia2
                    ? "No se encontraron tareas con esa búsqueda."
                    : "No hay tareas en esta sección."}
                </div>
              ) : (
                tareasVisibles.map((tarea) => {
                  const isOpen = openTareaId === tarea.tarea_id;
                  const { label: estadoLabel, badgeClass } = getEstadoBadge(config, tarea.estado);
                  const esNoAplica = tarea.estado === "no_aplica";
                  return (
                    <div
                      key={tarea.tarea_id}
                      className={`shrink-0 overflow-hidden rounded-xl border transition-shadow ${
                        isOpen ? "border-primary-3 shadow-card" : "border-gray-2 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenTareaId(isOpen ? null : tarea.tarea_id)}
                        className="flex w-full items-center justify-between bg-white px-4 py-3 text-left transition-colors hover:bg-gray-1"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            className={`flex-1 truncate text-sm font-medium ${
                              esNoAplica ? "text-gray-4 line-through" : "text-gray-8"
                            }`}
                          >
                            <span className="text-primary-6 font-bold mr-2">
                              {tarea.jerarquia_1}-{tarea.jerarquia_2}
                            </span>
                            {tarea.jerarquia_2_nombre}
                          </span>
                          {tarea.codigo_item && (
                            <span className="shrink-0 text-xs text-gray-4 bg-gray-1 px-1.5 py-0.5 rounded">
                              {tarea.codigo_item}
                            </span>
                          )}
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          <span className={badgeClass}>{estadoLabel}</span>
                          <svg
                            className={`h-4 w-4 text-gray-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-2 bg-white">
                          <PanelAsignacion
                            config={config}
                            tarea={tarea}
                            equipos={equipos}
                            proyectoRef={proyectoRef}
                            proyectoNombre={proyectoNombre}
                            onSaved={handleSaved}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>
    </div>

    <ModalAsignacionMasiva
      open={modalMasivo}
      onClose={() => setModalMasivo(false)}
      tareas={tareas}
      equipos={equipos}
      config={config}
      proyectoId={proyectoId}
      proyectoRef={proyectoRef}
      proyectoNombre={proyectoNombre}
      onSaved={handleSavedMasivo}
    />

    <ModalNoAplicaMasiva
      open={modalNoAplica}
      onClose={() => setModalNoAplica(false)}
      tareas={tareas}
      config={config}
      proyectoId={proyectoId}
      onSaved={handleSavedNoAplica}
    />

    <ModalEliminacionMasiva
      open={modalEliminacion}
      onClose={() => setModalEliminacion(false)}
      tareas={tareas}
      config={config}
      proyectoId={proyectoId}
      onSaved={handleSavedEliminacion}
    />
    </>
  );
}