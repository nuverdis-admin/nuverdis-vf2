"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMensaje, MiembroEquipo, TareaDetalle } from "@/lib/tareas/types";
import { ChatPanel } from "./ChatPanel";

const RECURSOS_FAKE: Array<{ label: string; href: string }> = [
  { label: "Guía GRI 2-1", href: "#" },
  { label: "Ejemplos por sector", href: "#" },
  { label: "FAQ de reportabilidad", href: "#" },
  { label: "Glosario GRI", href: "#" },
];

interface ChatProps {
  mensajes: ChatMensaje[];
  cargando: boolean;
  noLeidos: number;
  uid: string;
  onEnviar: (contenido: string) => Promise<void>;
  onMarcarLeido: () => void;
}

interface Props {
  tarea: TareaDetalle;
  miembros: MiembroEquipo[];
  chat: ChatProps;
  esAdmin?: boolean;
  tareaId?: number;
  empresaId?: number;
  exclusionesTable?: string;
  miembrosExtraTable?: string;
}

function copiarPublicId(publicId: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  navigator.clipboard
    .writeText(publicId)
    .then(() => toast.success("public_id copiado"))
    .catch(() => toast.error("No se pudo copiar"));
}

// ── Subcomponentes Inline para Admin ────────────────────────────────────────

function MiniBotonExcluir({
  userId,
  nombre,
  tareaId,
  empresaId,
  esTemporal,
  onExcluidoOk,
  exclusionesTable = "tarea_exclusiones",
  miembrosExtraTable = "tarea_miembros_extra",
}: {
  userId: string;
  nombre: string;
  tareaId: number;
  empresaId: number;
  esTemporal: boolean;
  onExcluidoOk: (userId: string) => void;
  exclusionesTable?: string;
  miembrosExtraTable?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirmarExcluir() {
    setLoading(true);
    const supabase = createClient();
    let error: Error | null = null;

    if (esTemporal) {
      const res = await supabase
        .from(miembrosExtraTable)
        .delete()
        .eq("tarea_id", tareaId)
        .eq("user_id", userId);
      error = res.error;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const res = await supabase.from(exclusionesTable).insert({
        empresa_id: empresaId,
        tarea_id: tareaId,
        user_id: userId,
        excluido_por: userData.user?.id ?? "",
        motivo: "Excluido manualmente por administrador",
      });
      error = res.error;
    }

    setLoading(false);
    if (error) {
      toast.error("Error al excluir: " + error.message);
      setConfirmando(false);
      return;
    }

    // FIX: Log auditoría fire-and-forget con IIFE (soluciona error .catch)
    void (async () => {
      try {
        await supabase.rpc("log_usuario_accion", {
          p_accion: "ADMIN_EXCLUIR_MIEMBRO_TAREA",
          p_tabla: esTemporal ? miembrosExtraTable : exclusionesTable,
          p_registro_id: String(tareaId),
          p_datos_prev: null,
          p_datos_new: { user_id: userId, nombre, tipo: esTemporal ? "temporal" : "normal" },
          p_proyecto_id: null,
        });
      } catch (err) {
        console.error("[log_usuario_accion error]:", err);
      }
    })();

    toast.success(`${nombre} excluido de la tarea`);
    setConfirmando(false);
    onExcluidoOk(userId);
  }

  if (confirmando) {
    return (
      <div className="ml-auto flex items-center gap-2 rounded-lg border border-critique-3 bg-critique-1 px-2.5 py-1">
        <span className="text-xs font-medium text-critique-7">¿Seguro que quieres excluir?</span>
        <button
          disabled={loading}
          onClick={() => void handleConfirmarExcluir()}
          className="rounded-md bg-critique-6 px-2 py-0.5 text-xs font-semibold text-white hover:bg-critique-7 disabled:opacity-50"
        >
          Sí, excluir
        </button>
        <button
          disabled={loading}
          onClick={() => setConfirmando(false)}
          className="rounded-md px-2 py-0.5 text-xs font-semibold text-gray-6 hover:bg-gray-2 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      title="Excluir de la tarea"
      onClick={() => setConfirmando(true)}
      className="ml-auto shrink-0 rounded-md p-1 text-gray-4 hover:bg-critique-1 hover:text-critique-6 transition-colors"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function MiniBotonReintegrar({
  userId,
  nombre,
  tareaId,
  onReintegradoOk,
  exclusionesTable = "tarea_exclusiones",
}: {
  userId: string;
  nombre: string;
  tareaId: number;
  onReintegradoOk: (userId: string) => void;
  exclusionesTable?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleReintegrar() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from(exclusionesTable)
      .delete()
      .eq("tarea_id", tareaId)
      .eq("user_id", userId);

    setLoading(false);
    if (error) {
      toast.error("Error al reintegrar: " + error.message);
      return;
    }

    // FIX: Log auditoría fire-and-forget con IIFE (soluciona error .catch)
    void (async () => {
      try {
        await supabase.rpc("log_usuario_accion", {
          p_accion: "ADMIN_REINTEGRAR_MIEMBRO_TAREA",
          p_tabla: exclusionesTable,
          p_registro_id: String(tareaId),
          p_datos_prev: null,
          p_datos_new: { user_id: userId, nombre },
          p_proyecto_id: null,
        });
      } catch (err) {
        console.error("[log_usuario_accion error]:", err);
      }
    })();

    toast.success(`${nombre} reintegrado a la tarea`);
    onReintegradoOk(userId);
  }

  return (
    <button
      type="button"
      title="Reintegrar a la tarea"
      disabled={loading}
      onClick={() => void handleReintegrar()}
      className="ml-auto shrink-0 rounded-md p-1 text-gray-4 hover:bg-success-1 hover:text-success-6 transition-colors disabled:opacity-50"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Contenido Principal ─────────────────────────────────────────────────────

function DetallesContenido({ tarea, miembros, chat, esAdmin, tareaId, empresaId, exclusionesTable = "tarea_exclusiones", miembrosExtraTable = "tarea_miembros_extra" }: Props) {
  const [copied, setCopied] = useState(false);
  const [miembrosLocal, setMiembrosLocal] = useState<MiembroEquipo[]>(miembros);

  // Sincronizar estado si las props cambian (ej. al refrescar datos)
  useEffect(() => {
    setMiembrosLocal(miembros);
  }, [miembros]);

  function handleExcluidoOk(userId: string) {
    setMiembrosLocal((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, tipo_miembro: "excluido" as const } : m))
    );
  }

  function handleReintegradoOk(userId: string) {
    setMiembrosLocal((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, tipo_miembro: "normal" as const } : m))
    );
  }

  function handleCopy() {
    copiarPublicId(tarea.public_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const miembrosNormales = miembrosLocal.filter((m) => m.tipo_miembro !== "excluido");
  const miembrosExcluidos = miembrosLocal.filter((m) => m.tipo_miembro === "excluido");

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-4">Tarea</p>
        <p className="mt-1 text-sm font-semibold text-gray-9">{tarea.jerarquia_2_nombre}</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="rounded bg-gray-1 px-1.5 py-0.5 text-[10px] text-gray-6">
            {tarea.public_id}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] text-primary-6 hover:underline"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-4">Equipo asignado</p>
        <p className="mt-1 text-sm font-medium text-gray-8">
          {tarea.equipo_nombre ?? "Sin equipo"}
        </p>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-4">Miembros</p>
        {miembrosLocal.length === 0 ? (
          <p className="text-xs text-gray-5">Sin miembros registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {miembrosNormales.map((m) => {
              const inicial = (m.nombre_completo ?? "?").trim().charAt(0).toUpperCase() || "?";
              const esTemporal = m.tipo_miembro === "temporal";
              
              return (
                <li key={m.user_id} className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold
                    ${esTemporal ? "bg-critique-1 text-critique-7" : "bg-primary-1 text-primary-7"}`}
                  >
                    {inicial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-8">{m.nombre_completo}</p>
                    <p className="truncate text-[11px] text-gray-5">{m.rol ?? "Sin rol"}</p>
                    {esTemporal && (
                      <p className="text-[10px] font-semibold text-critique-6">Temporal · sin equipo</p>
                    )}
                  </div>
                  {esAdmin && tareaId && empresaId && (
                    <MiniBotonExcluir
                      userId={m.user_id}
                      nombre={m.nombre_completo ?? "?"}
                      tareaId={tareaId}
                      empresaId={empresaId}
                      esTemporal={esTemporal}
                      onExcluidoOk={handleExcluidoOk}
                      exclusionesTable={exclusionesTable}
                      miembrosExtraTable={miembrosExtraTable}
                    />
                  )}
                </li>
              );
            })}

            {/* Sub-sección exclusiva para admin: Miembros Excluidos */}
            {esAdmin && miembrosExcluidos.length > 0 && tareaId && (
              <div className="mt-3 border-t border-gray-2 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase text-gray-4">Excluidos</p>
                {miembrosExcluidos.map((m) => {
                  const inicial = (m.nombre_completo ?? "?").trim().charAt(0).toUpperCase() || "?";
                  return (
                    <li key={m.user_id} className="flex items-center gap-2 opacity-60">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-2 text-xs font-semibold text-gray-5">
                        {inicial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-6 line-through">{m.nombre_completo}</p>
                        <p className="truncate text-[11px] text-gray-4">{m.rol ?? "Sin rol"}</p>
                        <p className="text-[10px] font-semibold text-gray-5">Excluido</p>
                      </div>
                      <MiniBotonReintegrar
                        userId={m.user_id}
                        nombre={m.nombre_completo ?? "?"}
                        tareaId={tareaId}
                        onReintegradoOk={handleReintegradoOk}
                        exclusionesTable={exclusionesTable}
                      />
                    </li>
                  );
                })}
              </div>
            )}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-4">Recursos</p>
        <ul className="flex flex-col gap-1.5">
          {RECURSOS_FAKE.map((r) => (
            <li key={r.label}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                data-bypass-block="true"
                className="flex items-center gap-2 text-sm text-info-7 hover:underline"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-4">Chat</p>
          {chat.noLeidos > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-critique-6 px-1 text-[9px] font-bold text-white">
              {chat.noLeidos > 9 ? "9+" : chat.noLeidos}
            </span>
          )}
        </div>
        <ChatPanel
          mensajes={chat.mensajes}
          cargando={chat.cargando}
          uid={chat.uid}
          onEnviar={chat.onEnviar}
          onVisible={chat.onMarcarLeido}
        />
      </section>
    </div>
  );
}

export function DetallesPanel({ tarea, miembros, chat, esAdmin, tareaId, empresaId, exclusionesTable, miembrosExtraTable }: Props) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-7rem)] w-80 shrink-0 flex-col gap-3 rounded-xl border border-gray-2 bg-white p-5 xl:flex 2xl:flex">
      <DetallesContenido
        tarea={tarea}
        miembros={miembros}
        chat={chat}
        esAdmin={esAdmin}
        tareaId={tareaId}
        empresaId={empresaId}
        exclusionesTable={exclusionesTable}
        miembrosExtraTable={miembrosExtraTable}
      />
    </aside>
  );
}

interface ModalProps extends Props {
  open: boolean;
  onClose: () => void;
}

export function DetallesModal({ open, onClose, tarea, miembros, chat, esAdmin, tareaId, empresaId, exclusionesTable, miembrosExtraTable }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-xl bg-white p-6 shadow-modal border-t-4 border-info-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-9">Detalles de la tarea</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-gray-5 hover:bg-gray-1 hover:text-gray-8"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <DetallesContenido
            tarea={tarea}
            miembros={miembros}
            chat={chat}
            esAdmin={esAdmin}
            tareaId={tareaId}
            empresaId={empresaId}
            exclusionesTable={exclusionesTable}
            miembrosExtraTable={miembrosExtraTable}
          />
        </div>
      </div>
    </div>
  );
}