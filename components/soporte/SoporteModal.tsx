"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { X, LifeBuoy, Send, Loader2, Image as ImageIcon, Link as LinkIcon, MessageSquare, ClipboardList, RefreshCw } from "lucide-react";
import { useSoporte } from "./SoporteContext";
import {
  crearTicketSoporte,
  listarMisTickets,
  cancelarMiTicket,
  type TicketRow,
} from "@/app/actions/soporte";

// ── Helpers ──────────────────────────────────────────────────────────────────

type Tab = "nueva" | "mis";
type Tipo = "consulta" | "error";
type Estado = TicketRow["estado"];

const ESTADO_BADGE: Record<Estado, string> = {
  ingresado:  "bg-info-1 text-info-7 border border-info-3",
  en_curso:   "bg-warning-1 text-warning-7 border border-warning-3",
  finalizado: "bg-success-1 text-success-7 border border-success-3",
  cancelado:  "bg-gray-1 text-gray-6 border border-gray-3",
  reabierto:  "bg-critique-1 text-critique-7 border border-critique-3",
};

const ESTADO_LABEL: Record<Estado, string> = {
  ingresado:  "Ingresado",
  en_curso:   "En curso",
  finalizado: "Finalizado",
  cancelado:  "Cancelado",
  reabierto:  "Reabierto",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TicketSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-2 p-3">
          <div className="h-4 w-24 rounded bg-gray-2 animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-gray-2 animate-pulse" />
          <div className="ml-auto h-3 w-20 rounded bg-gray-2 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function SoporteModal() {
  const { isOpen, close } = useSoporte();
  const [tab, setTab] = useState<Tab>("nueva");

  // ── Formulario nueva solicitud ────────────────────────────────────────────
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<Tipo>("consulta");
  const [descripcion, setDescripcion] = useState("");
  const [url, setUrl] = useState("");
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mis solicitudes ───────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [cargandoTickets, setCargandoTickets] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);
  // Cooldown del botón refresh (5s)
  const [refreshEnCooldown, setRefreshEnCooldown] = useState(false);

  const cargarTickets = useCallback(async () => {
    setCargandoTickets(true);
    const res = await listarMisTickets();
    if (res.ok) setTickets(res.tickets);
    else toast.error(res.error);
    setCargandoTickets(false);
  }, []);

  // Siempre que el tab cambia a "mis", hace fetch fresco
  useEffect(() => {
    if (tab === "mis") cargarTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function handleTabChange(t: Tab) {
    setTab(t);
    // El useEffect se encarga del fetch
  }

  function handleRefresh() {
    if (refreshEnCooldown || cargandoTickets) return;
    setRefreshEnCooldown(true);
    cargarTickets().finally(() => {
      setTimeout(() => setRefreshEnCooldown(false), 5000);
    });
  }

  function resetForm() {
    setTitulo("");
    setTipo("consulta");
    setDescripcion("");
    setUrl("");
    setImagenFile(null);
    setImagenPreview(null);
  }

  function handleClose() {
    resetForm();
    setTab("nueva");
    close();
  }

  function onPickImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImagenFile(f);
    setImagenPreview(f ? URL.createObjectURL(f) : null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const formValido =
    titulo.trim().length > 0 &&
    descripcion.trim().length > 0 &&
    (tipo === "consulta" || url.trim().length > 0);

  async function handleEnviar() {
    if (!formValido || enviando) return;
    setEnviando(true);

    const fd = new FormData();
    fd.append("tipo", tipo);
    fd.append("titulo", titulo.trim());
    fd.append("descripcion", descripcion.trim());
    if (tipo === "error") {
      fd.append("url", url.trim());
      if (imagenFile) fd.append("imagen", imagenFile);
    }

    const res = await crearTicketSoporte(fd);
    setEnviando(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Ticket enviado correctamente. Recibirás un correo de confirmación.");
    resetForm();
    // Saltar a "Mis solicitudes" — el useEffect dispara fetch fresco automáticamente
    handleTabChange("mis");
  }

  async function handleCancelar(id: string) {
    setCancelando(id);
    const res = await cancelarMiTicket(id);
    setCancelando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Ticket cancelado.");
    setTickets((prev) =>
      prev
        ? prev.map((t) => (t.id === id ? { ...t, estado: "cancelado" as Estado } : t))
        : prev
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop inerte */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary-6" strokeWidth={2} />
            <h2 className="text-base font-bold text-gray-9">Centro de soporte</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-5 hover:bg-gray-1 hover:text-gray-8"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-2 mb-5">
          {(["nueva", "mis"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-primary-5 text-primary-7"
                  : "border-transparent text-gray-5 hover:text-gray-8"
              }`}
            >
              {t === "nueva" ? (
                <><Send className="h-3.5 w-3.5" strokeWidth={2} />Nueva solicitud</>
              ) : (
                <><ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />Mis solicitudes</>
              )}
            </button>
          ))}
        </div>

        {/* ─── TAB: Nueva solicitud ─────────────────────────────────────── */}
        {tab === "nueva" && (
          <div className="space-y-4">
            {/* Título */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-7">
                Título del soporte <span className="text-critique-6">*</span>
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                placeholder="Ej: No puedo descargar el reporte GRI"
                className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-9 outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-3"
              />
              <p className="mt-0.5 text-right text-[11px] text-gray-4">{titulo.length}/200</p>
            </div>

            {/* Tipo */}
            <div>
              <p className="mb-2 text-xs font-medium text-gray-7">Tipo de solicitud</p>
              <div className="grid grid-cols-2 gap-2">
                {(["consulta", "error"] as Tipo[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      tipo === t
                        ? "border-primary-5 bg-primary-1 text-primary-7"
                        : "border-gray-2 text-gray-6 hover:border-gray-3 hover:bg-gray-1"
                    }`}
                  >
                    <span className="block font-medium">
                      {t === "consulta" ? "🙋 Consulta / Duda" : "🐛 Error / Bug"}
                    </span>
                    <span className="mt-0.5 block text-[11px] opacity-70">
                      {t === "consulta" ? "Cómo usar, preguntas generales" : "Algo no funciona bien"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campos dinámicos según tipo */}
            {tipo === "error" && (
              <>
                {/* URL */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-7">
                    <LinkIcon className="mr-1 inline h-3 w-3" strokeWidth={2} />
                    URL donde tienes el problema <span className="text-critique-6">*</span>
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    maxLength={500}
                    placeholder="https://app.nuverdis.com/dashboard/..."
                    className="w-full rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-9 outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-3"
                  />
                </div>

                {/* Imagen */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-7">
                    <ImageIcon className="mr-1 inline h-3 w-3" strokeWidth={2} />
                    Captura de pantalla (opcional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer rounded-lg border border-gray-3 px-3 py-2 text-xs font-medium text-gray-6 hover:bg-gray-1 hover:text-gray-8">
                      {imagenFile ? "Cambiar imagen" : "Subir imagen"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={onPickImagen}
                        className="hidden"
                      />
                    </label>
                    {imagenPreview && (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagenPreview}
                          alt="preview"
                          className="h-10 w-16 rounded object-cover border border-gray-2"
                        />
                        <button
                          type="button"
                          onClick={() => { setImagenFile(null); setImagenPreview(null); }}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-critique-6 text-white"
                        >
                          <X className="h-2.5 w-2.5" strokeWidth={3} />
                        </button>
                      </div>
                    )}
                    {imagenFile && !imagenPreview && (
                      <span className="text-xs text-gray-5 truncate max-w-[120px]">{imagenFile.name}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-4">PNG, JPG o WebP · máx. 5 MB</p>
                </div>
              </>
            )}

            {/* Descripción */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-7">
                <MessageSquare className="mr-1 inline h-3 w-3" strokeWidth={2} />
                {tipo === "consulta" ? "Tu consulta" : "Describe el problema"} <span className="text-critique-6">*</span>
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={
                  tipo === "consulta"
                    ? "Describe tu duda con el mayor detalle posible..."
                    : "Describe qué estabas haciendo, qué esperabas y qué ocurrió..."
                }
                className="w-full resize-none rounded-lg border border-gray-3 px-3 py-2 text-sm text-gray-9 outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-3"
              />
              <p className="mt-0.5 text-right text-[11px] text-gray-4">{descripcion.length}/1000</p>
            </div>

            {/* Botón enviar */}
            <button
              type="button"
              onClick={handleEnviar}
              disabled={!formValido || enviando}
              className="btn-primary btn w-full rounded-lg disabled:opacity-50"
            >
              {enviando ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Enviando...
                </span>
              ) : (
                "Enviar solicitud"
              )}
            </button>

            {/* Texto de fallback */}
            <p className="text-center text-[11px] text-gray-4">
              Si por cualquier razón no logras enviar una solicitud, utiliza directamente nuestro correo{" "}
              <a href="mailto:soporte@nuverdis.com" className="text-primary-6 underline">
                soporte@nuverdis.com
              </a>
            </p>
          </div>
        )}

        {/* ─── TAB: Mis solicitudes ─────────────────────────────────────── */}
        {tab === "mis" && (
          <div>
            {/* Botón refresh con cooldown 5s */}
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={cargandoTickets || refreshEnCooldown}
                title="Actualizar lista"
                className="flex items-center gap-1 rounded-lg border border-gray-2 px-2 py-1 text-[11px] font-medium text-gray-5 transition-colors hover:border-gray-3 hover:text-primary-6 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${cargandoTickets ? "animate-spin" : ""}`} strokeWidth={2} />
                Actualizar
              </button>
            </div>

            {cargandoTickets ? (
              <TicketSkeleton />
            ) : tickets === null ? (
              <TicketSkeleton />
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center">
                <LifeBuoy className="mx-auto mb-2 h-8 w-8 text-gray-3" strokeWidth={1.5} />
                <p className="text-sm text-gray-5">No tienes solicitudes de soporte aún.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-gray-2 p-3 hover:bg-gray-1 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-8 truncate">{ticket.titulo}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-gray-4">{ticket.id}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_BADGE[ticket.estado]}`}>
                        {ESTADO_LABEL[ticket.estado]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-4">{formatFecha(ticket.created_at)}</span>
                      {(ticket.estado === "ingresado" || ticket.estado === "en_curso" || ticket.estado === "reabierto") && (
                        <button
                          type="button"
                          onClick={() => handleCancelar(ticket.id)}
                          disabled={cancelando === ticket.id}
                          className="rounded-lg border border-gray-2 px-2 py-1 text-[11px] font-medium text-gray-5 hover:border-critique-4 hover:text-critique-6 disabled:opacity-50"
                        >
                          {cancelando === ticket.id ? "Cancelando..." : "Cancelar solicitud"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Texto de fallback */}
            <p className="mt-4 text-center text-[11px] text-gray-4">
              Si por cualquier razón no logras enviar una solicitud, utiliza directamente nuestro correo{" "}
              <a href="mailto:soporte@nuverdis.com" className="text-primary-6 underline">
                soporte@nuverdis.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
