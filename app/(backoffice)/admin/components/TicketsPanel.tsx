"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, X, ExternalLink, ImageIcon, Loader2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  actualizarEstadoTicket,
  getTicketImagenUrl,
  type TicketAdminRow,
} from "@/app/actions/admin-tickets";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos resultado
// ─────────────────────────────────────────────────────────────────────────────

type TicketsRes =
  | { ok: true; tickets: TicketAdminRow[] }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de estilo
// ─────────────────────────────────────────────────────────────────────────────

type Estado = TicketAdminRow["estado"];

const ESTADO_STYLE: Record<Estado, string> = {
  ingresado:  "bg-info-8 text-info-2",
  en_curso:   "bg-warning-8 text-warning-2",
  finalizado: "bg-primary-8 text-primary-2",
  cancelado:  "bg-[#2A2A2A] text-[#707070]",
  reabierto:  "bg-critique-8 text-critique-2",
};

const ESTADO_LABEL: Record<Estado, string> = {
  ingresado:  "Ingresado",
  en_curso:   "En curso",
  finalizado: "Finalizado",
  cancelado:  "Cancelado",
  reabierto:  "Reabierto",
};

const TIPO_LABEL: Record<string, string> = {
  consulta: "🙋 Consulta",
  error: "🐛 Error",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de detalle (tema oscuro)
// ─────────────────────────────────────────────────────────────────────────────

function DetalleModal({
  ticket,
  onClose,
  onUpdated,
}: {
  ticket: TicketAdminRow;
  onClose: () => void;
  onUpdated: (t: TicketAdminRow) => void;
}) {
  const [guardando, setGuardando] = useState<"en_curso" | "finalizado" | "reabierto" | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [loadingImagen, setLoadingImagen] = useState(false);

  async function handleEstado(estado: "en_curso" | "finalizado" | "reabierto") {
    setGuardando(estado);
    const res = await actualizarEstadoTicket(ticket.id, estado);
    setGuardando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Ticket marcado como "${ESTADO_LABEL[estado]}"`);
    onUpdated(res.ticket);
  }

  async function handleVerImagen() {
    if (!ticket.imagen_path) return;
    setLoadingImagen(true);
    const res = await getTicketImagenUrl(ticket.imagen_path);
    setLoadingImagen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setImagenUrl(res.url);
  }

  const INPUT_STYLE = "w-full rounded-lg border border-[#2A2A2A] bg-[#202020] px-3 py-2 text-sm text-[#EDEDED]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-xl rounded-xl border-t-4 border-info-5 bg-[#161616] p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_STYLE[ticket.estado]}`}>
                {ESTADO_LABEL[ticket.estado]}
              </span>
              <span className="text-xs text-[#707070]">{TIPO_LABEL[ticket.tipo]}</span>
            </div>
            <h2 className="text-base font-bold text-[#EDEDED]">{ticket.titulo}</h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#707070]">{ticket.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#707070] hover:bg-[#202020] hover:text-[#EDEDED]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Datos del solicitante */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
              Solicitante
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-[#707070]">Nombre</p>
                <p className="text-[#EDEDED]">{ticket.nombre_completo || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#707070]">Email</p>
                <p className="text-[#EDEDED] break-all">{ticket.email || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#707070]">Rol</p>
                <p className="text-[#EDEDED] capitalize">{ticket.rol}</p>
              </div>
              <div>
                <p className="text-[11px] text-[#707070]">Empresa</p>
                <p className="text-[#EDEDED]">{ticket.empresa_nombre}</p>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
              Descripción
            </p>
            <div className={`${INPUT_STYLE} whitespace-pre-wrap`}>{ticket.descripcion}</div>
          </div>

          {/* URL (solo error) */}
          {ticket.url && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
                URL del problema
              </p>
              <a
                href={ticket.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-info-4 hover:text-info-3 break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {ticket.url}
              </a>
            </div>
          )}

          {/* Imagen */}
          {ticket.imagen_path && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
                Captura adjunta
              </p>
              {imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagenUrl}
                  alt="Captura del ticket"
                  className="max-h-60 rounded-lg border border-[#2A2A2A] object-contain"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleVerImagen}
                  disabled={loadingImagen}
                  className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED] disabled:opacity-50"
                >
                  {loadingImagen ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <ImageIcon className="h-4 w-4" strokeWidth={2} />
                  )}
                  {loadingImagen ? "Cargando…" : "Ver imagen (URL firmada 60s)"}
                </button>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[11px] text-[#707070]">Creado</p>
              <p className="text-[#EDEDED]">{fecha(ticket.created_at)}</p>
            </div>
            {ticket.resolved_at && (
              <div>
                <p className="text-[11px] text-[#707070]">Resuelto</p>
                <p className="text-[#EDEDED]">{fecha(ticket.resolved_at)}</p>
              </div>
            )}
          </div>

          {/* Acciones de estado */}
          {ticket.estado !== "cancelado" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#2A2A2A]">
              {/* ingresado → en_curso */}
              {ticket.estado === "ingresado" && (
                <button
                  type="button"
                  onClick={() => handleEstado("en_curso")}
                  disabled={guardando !== null}
                  className="rounded-lg border border-warning-6 px-4 py-2 text-sm font-semibold text-warning-4 hover:bg-warning-8 disabled:opacity-50"
                >
                  {guardando === "en_curso" ? "Guardando…" : "Marcar en curso"}
                </button>
              )}
              {/* cualquier estado activo → finalizado */}
              {ticket.estado !== "finalizado" && (
                <button
                  type="button"
                  onClick={() => handleEstado("finalizado")}
                  disabled={guardando !== null}
                  className="rounded-lg bg-primary-6 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-7 disabled:opacity-50"
                >
                  {guardando === "finalizado" ? "Guardando…" : "Marcar finalizado"}
                </button>
              )}
              {/* finalizado o reabierto → reabrir */}
              {(ticket.estado === "finalizado" || ticket.estado === "reabierto") && (
                <button
                  type="button"
                  onClick={() => handleEstado("reabierto")}
                  disabled={guardando !== null || ticket.estado === "reabierto"}
                  className="rounded-lg border border-critique-6 px-4 py-2 text-sm font-semibold text-critique-4 hover:bg-critique-8 disabled:opacity-50"
                >
                  {guardando === "reabierto" ? "Guardando…" : "Reabrir ticket"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TicketsPanel — componente principal
// ─────────────────────────────────────────────────────────────────────────────

const FILTRO_ESTADOS = ["todos", "ingresado", "en_curso", "reabierto", "finalizado", "cancelado"] as const;
type FiltroEstado = (typeof FILTRO_ESTADOS)[number];

export function TicketsPanel({ ticketsRes }: { ticketsRes: TicketsRes }) {
  const [tickets, setTickets] = useState<TicketAdminRow[]>(
    ticketsRes.ok ? ticketsRes.tickets : []
  );
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [detalle, setDetalle] = useState<TicketAdminRow | null>(null);

  function handleUpdated(updated: TicketAdminRow) {
    setTickets((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    setDetalle(updated);
  }

  const filtered = filtro === "todos"
    ? tickets
    : tickets.filter((t) => t.estado === filtro);

  if (!ticketsRes.ok) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="rounded-xl border border-critique-7 bg-critique-9 px-4 py-3 text-sm text-critique-3">
          {ticketsRes.error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary-4" strokeWidth={2} />
          <h1 className="text-base font-bold text-[#EDEDED]">Tickets de soporte</h1>
          <span className="rounded-full bg-[#2A2A2A] px-2 py-0.5 text-[11px] font-semibold text-[#A1A1A1]">
            {filtered.length}
          </span>
        </div>

        {/* Filtros por estado */}
        <div className="flex gap-1">
          {FILTRO_ESTADOS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filtro === f
                  ? "bg-[#1F1F1F] text-[#EDEDED]"
                  : "text-[#8C8C8C] hover:bg-[#161616] hover:text-[#EDEDED]"
              }`}
            >
              {f === "todos" ? "Todos" : ESTADO_LABEL[f as Estado]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#161616]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-[#707070]">
                  No hay tickets con este filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-[11px] text-[#707070]">{t.id}</TableCell>
                  <TableCell className="text-[#8C8C8C]">{t.empresa_nombre}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm text-[#EDEDED]">{t.nombre_completo || "—"}</p>
                      <p className="text-[11px] text-[#707070] capitalize">{t.rol}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-[#8C8C8C]">
                    {TIPO_LABEL[t.tipo] ?? t.tipo}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-[#EDEDED]">
                    {t.titulo}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_STYLE[t.estado]}`}>
                      {ESTADO_LABEL[t.estado]}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-[#8C8C8C] whitespace-nowrap">
                    {fecha(t.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => setDetalle(t)}
                      className="rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]"
                    >
                      Ver
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <DetalleModal
          ticket={detalle}
          onClose={() => setDetalle(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
