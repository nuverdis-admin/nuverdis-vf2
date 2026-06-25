"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import MiembroDerivacionesView from "@/components/reportes/MiembroDerivacionesView";
import { notificarDerivacionResuelta } from '@/lib/supabase/notificaciones';
import type { ReporteConfig } from "@/lib/reportes/types";

interface DerivacionRow {
  id: string;
  proyecto_id: number;
  tarea_id: number;
  tipo: "derivacion" | "exclusion";
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo: string;
  motivo_rechazo: string | null;
  solicitante_uid: string;
  derivar_a_uid: string | null;
  derivar_a_texto: string | null;
  created_at: string;
  updated_at: string;
  solicitante_nombre: string | null;
  solicitante_email: string | null;
  resuelto_por_nombre: string | null;
  derivar_a_nombre: string | null;
  tarea_public_id: string;
  estandar: string;
  jerarquia_1: string;
  jerarquia_2: string;
  jerarquia_1_nombre: string;
  jerarquia_2_nombre: string;
}

type Filtro =
  | "todas"
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "derivacion"
  | "exclusion";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas",      label: "Todas" },
  { value: "pendiente",  label: "Solo pendientes" },
  { value: "aprobada",   label: "Solo aprobadas" },
  { value: "rechazada",  label: "Solo rechazadas" },
  { value: "derivacion", label: "Solo derivaciones" },
  { value: "exclusion",  label: "Solo exclusiones" },
];

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tipoBadge(tipo: "derivacion" | "exclusion"): { cls: string; label: string } {
  return tipo === "derivacion"
    ? { cls: "bg-info-1 text-info-7", label: "Derivación" }
    : { cls: "bg-warning-1 text-warning-7", label: "Exclusión" };
}

function estadoBadge(estado: "pendiente" | "aprobada" | "rechazada"): { cls: string; label: string } {
  if (estado === "aprobada")  return { cls: "bg-success-1 text-success-7", label: "Aprobada" };
  if (estado === "rechazada") return { cls: "bg-critique-1 text-critique-7", label: "Rechazada" };
  return { cls: "bg-gray-2 text-gray-7", label: "Pendiente" };
}


function SkeletonFilas() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className="border-b border-gray-1">
          <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-36 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-7 w-10 rounded bg-gray-2 animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

type FaseModal = "detalle" | "opciones_derivacion" | "opciones_exclusion" | "confirmar_rechazo";

function DetalleModal({
  derivacion,
  onClose,
  onResolved,
  config,
}: {
  derivacion: DerivacionRow;
  onClose: () => void;
  onResolved: (id: string, accion: "aprobada" | "rechazada", motivoRechazo: string | null) => void;
  config: ReporteConfig;
}) {
  const [faseModal, setFaseModal] = useState<FaseModal>("detalle");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingOpcion, setLoadingOpcion] = useState<string | null>(null);
  const [opcionDerivacion, setOpcionDerivacion] = useState<"temporal" | "equipo">("temporal");
  const [opcionExclusion, setOpcionExclusion] = useState<"tarea" | "equipo">("tarea");

  async function handleAprobarDerivacion(tipoInclusion: "temporal" | "equipo") {
    setLoadingOpcion(tipoInclusion);
    const supabase = createClient();

    const { data, error } = await supabase.rpc(config.rpcAprobarDerivacion, {
      p_derivacion_id: derivacion.id,
      p_tipo_inclusion: tipoInclusion,
    });

    if (error || !(data as { ok?: boolean } | null)?.ok) {
      toast.error(error?.message ?? "Error al aprobar la derivación");
      setLoadingOpcion(null);
      return;
    }

    const tareaLabel = `${derivacion.estandar} ${derivacion.jerarquia_1}-${derivacion.jerarquia_2}`;
    
    // FIX: Esperamos a que la Server Action termine antes de cerrar el modal
    try {
      await notificarDerivacionResuelta({
        solicitanteUid: derivacion.solicitante_uid,
        accion: "aprobada",
        tipo: "derivacion",
        tipoOpcion: tipoInclusion,
        tareaLabel,
        derivarAUid: derivacion.derivar_a_uid ?? null,
      });
    } catch (err) {
      console.error("[notificar-derivacion]", err);
    }

    setLoadingOpcion(null);
    toast.success(
      tipoInclusion === "temporal"
        ? "Derivación aprobada · acceso temporal asignado"
        : "Derivación aprobada · usuario añadido al equipo"
    );
    onResolved(derivacion.id, "aprobada", null);
  }

  async function handleAprobarExclusion(tipoExclusion: "tarea" | "equipo") {
    setLoadingOpcion(tipoExclusion);
    const supabase = createClient();

    const { data, error } = await supabase.rpc(config.rpcAprobarExclusion, {
      p_derivacion_id: derivacion.id,
      p_tipo_exclusion: tipoExclusion,
    });

    if (error || !(data as { ok?: boolean } | null)?.ok) {
      toast.error(error?.message ?? "Error al aprobar la exclusión");
      setLoadingOpcion(null);
      return;
    }

    const tareaLabel = `${derivacion.estandar} ${derivacion.jerarquia_1}-${derivacion.jerarquia_2}`;
    
    // FIX: Esperamos a que la Server Action termine
    try {
      await notificarDerivacionResuelta({
        solicitanteUid: derivacion.solicitante_uid,
        accion: "aprobada",
        tipo: "exclusion",
        tipoOpcion: tipoExclusion,
        tareaLabel,
        derivarAUid: null,
      });
    } catch (err) {
      console.error("[notificar-exclusion]", err);
    }

    setLoadingOpcion(null);
    toast.success(
      tipoExclusion === "tarea"
        ? "Exclusión aprobada · usuario excluido de la tarea"
        : "Usuario eliminado del equipo"
    );
    onResolved(derivacion.id, "aprobada", null);
  }

  async function resolver(accion: "aprobada" | "rechazada") {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc(config.rpcResolverDerivacion, {
      p_derivacion_id: derivacion.id,
      p_accion: accion,
      p_motivo_rechazo: accion === "rechazada" ? motivoTexto : null,
    });

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    const tareaLabel = `${derivacion.estandar} ${derivacion.jerarquia_1}-${derivacion.jerarquia_2}`;
    
    // FIX: Esperamos a que la Server Action termine
    try {
      await notificarDerivacionResuelta({
        solicitanteUid: derivacion.solicitante_uid,
        accion,
        tipo: derivacion.tipo,
        tareaLabel,
        motivoRechazo: accion === "rechazada" ? motivoTexto : undefined,
        derivarAUid: null,
      });
    } catch (err) {
      console.error("[notificar-rechazo]", err);
    }
    
    toast.success(accion === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada");
    onResolved(derivacion.id, accion, accion === "rechazada" ? motivoTexto : null);
    setSaving(false);
  }

  const tb = tipoBadge(derivacion.tipo);
  const eb = estadoBadge(derivacion.estado);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-info-5 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-8">Detalle de solicitud</h3>
          <button
            onClick={onClose}
            className="text-gray-4 hover:text-gray-7 transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-4 mb-0.5">Solicitante</p>
            <p className="font-medium text-gray-8">{derivacion.solicitante_nombre ?? "—"}</p>
            {derivacion.solicitante_email && (
              <p className="text-xs text-gray-5">{derivacion.solicitante_email}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-4 mb-0.5">Tarea</p>
            <p className="text-gray-8">
              {derivacion.estandar} {derivacion.jerarquia_1}-{derivacion.jerarquia_2} ·{" "}
              {derivacion.jerarquia_2_nombre}
            </p>
          </div>

          <div className="flex gap-4">
            <div>
              <p className="text-xs text-gray-4 mb-0.5">Tipo</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tb.cls}`}>
                {tb.label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-4 mb-0.5">Estado</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${eb.cls}`}>
                {eb.label}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-4 mb-0.5">Motivo</p>
            <p className="bg-gray-1 rounded p-3 text-sm text-gray-7">{derivacion.motivo}</p>
          </div>

          {derivacion.tipo === "derivacion" && (
            <div>
              <p className="text-xs text-gray-4 mb-0.5">Derivar a</p>
              <p className="text-gray-7">
                {derivacion.derivar_a_nombre ?? derivacion.derivar_a_texto ?? "—"}
              </p>
            </div>
          )}

          {derivacion.estado === "rechazada" && derivacion.motivo_rechazo && (
            <div>
              <p className="text-xs text-gray-4 mb-0.5">Motivo de rechazo</p>
              <p className="bg-critique-1 rounded p-3 text-sm text-critique-7">
                {derivacion.motivo_rechazo}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-4 mb-0.5">Fecha solicitud</p>
            <p className="text-gray-6">{formatFecha(derivacion.created_at)}</p>
          </div>
        </div>

        {derivacion.estado === "pendiente" && (
          <div className="mt-5 space-y-3">
            {faseModal === "confirmar_rechazo" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-6 mb-1">
                    Motivo de rechazo
                  </label>
                  <textarea
                    value={motivoTexto}
                    onChange={(e) => setMotivoTexto(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-2 rounded-lg px-3 py-2 text-sm text-gray-7 focus:outline-none focus:ring-2 focus:ring-critique-3 resize-none"
                    placeholder="Explica el motivo del rechazo (mínimo 10 caracteres)..."
                  />
                </div>
                <button
                  disabled={motivoTexto.trim().length < 10 || saving}
                  onClick={() => void resolver("rechazada")}
                  className="w-full rounded-lg border border-critique-6 py-2 text-sm text-critique-6 hover:bg-critique-1 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Procesando…" : "Confirmar rechazo"}
                </button>
                <button
                  type="button"
                  onClick={() => setFaseModal("detalle")}
                  className="btn btn-ghost w-full"
                >
                  ← Volver
                </button>
              </>
            )}

            {faseModal === "opciones_derivacion" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-6">
                  ¿Cómo deseas integrar a{" "}
                  <span className="font-semibold">
                    {derivacion.derivar_a_nombre ?? derivacion.derivar_a_texto ?? "la persona designada"}
                  </span>
                  ?
                </p>
                <div className="flex flex-col gap-2">
                  {(["temporal", "equipo"] as const).map((op) => (
                    <label
                      key={op}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        opcionDerivacion === op
                          ? "border-primary-4 bg-primary-0"
                          : "border-gray-2 bg-white hover:border-gray-3"
                      }`}
                    >
                      <input
                        type="radio"
                        name="opcion_derivacion"
                        value={op}
                        checked={opcionDerivacion === op}
                        onChange={() => setOpcionDerivacion(op)}
                        className="accent-primary-5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-8">
                          {op === "temporal" ? "Solo para esta tarea" : "Incluir en el equipo completo"}
                        </p>
                        <p className="text-xs text-gray-5">
                          {op === "temporal"
                            ? "Acceso temporal · permanece en su equipo original"
                            : "Se une al equipo · accede a todas sus tareas"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={loadingOpcion !== null}
                  onClick={() => void handleAprobarDerivacion(opcionDerivacion)}
                  className="btn btn-primary rounded-lg w-full disabled:opacity-50"
                >
                  {loadingOpcion !== null ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando…
                    </span>
                  ) : "Aprobar"}
                </button>
                <button
                  type="button"
                  disabled={loadingOpcion !== null}
                  onClick={() => setFaseModal("detalle")}
                  className="btn btn-ghost w-full"
                >
                  ← Volver
                </button>
              </div>
            )}

            {faseModal === "opciones_exclusion" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-6">
                  ¿Cómo deseas excluir a{" "}
                  <span className="font-semibold">{derivacion.solicitante_nombre}</span>?
                </p>
                <div className="flex flex-col gap-2">
                  {(["tarea", "equipo"] as const).map((op) => (
                    <label
                      key={op}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        opcionExclusion === op
                          ? op === "equipo"
                            ? "border-critique-3 bg-critique-1"
                            : "border-primary-4 bg-primary-0"
                          : "border-gray-2 bg-white hover:border-gray-3"
                      }`}
                    >
                      <input
                        type="radio"
                        name="opcion_exclusion"
                        value={op}
                        checked={opcionExclusion === op}
                        onChange={() => setOpcionExclusion(op)}
                        className={op === "equipo" ? "accent-critique-6" : "accent-primary-5"}
                      />
                      <div>
                        <p className={`text-sm font-medium ${op === "equipo" ? "text-critique-7" : "text-gray-8"}`}>
                          {op === "tarea" ? "Solo de esta tarea" : "Eliminar del equipo"}
                        </p>
                        <p className="text-xs text-gray-5">
                          {op === "tarea"
                            ? "Permanece en el equipo · pierde acceso solo a esta tarea"
                            : "Pierde acceso a todas las tareas del equipo"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={loadingOpcion !== null}
                  onClick={() => void handleAprobarExclusion(opcionExclusion)}
                  className={`btn rounded-lg w-full disabled:opacity-50 ${
                    opcionExclusion === "equipo"
                      ? "bg-critique-6 text-white hover:bg-critique-7"
                      : "btn-primary"
                  }`}
                >
                  {loadingOpcion !== null ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando…
                    </span>
                  ) : "Aprobar"}
                </button>
                <button
                  type="button"
                  disabled={loadingOpcion !== null}
                  onClick={() => setFaseModal("detalle")}
                  className="btn btn-ghost w-full"
                >
                  ← Volver
                </button>
              </div>
            )}

            {faseModal === "detalle" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFaseModal("confirmar_rechazo")}
                  className="flex-1 rounded-lg border border-critique-6 py-2 text-sm text-critique-6 hover:bg-critique-1 transition-colors"
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={(e) => {
                    e.preventDefault(); // Prevenimos comportamientos por defecto
                    // FIX: En lugar de llamar a Supabase, cambiamos el estado de la UI
                    if (derivacion.tipo === "derivacion") {
                      setFaseModal("opciones_derivacion");
                    } else {
                      setFaseModal("opciones_exclusion");
                    }
                  }}
                  className="flex-1 btn btn-primary rounded-lg text-sm py-2 disabled:opacity-50"
                >
                  Aprobar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Lógica de admin en componente propio para no violar Rules of Hooks
// (no se pueden llamar hooks después de un return condicional).
function AdminDerivacionesView({ proyectoId, config }: { proyectoId: string; config: ReporteConfig }) {
  const [derivaciones, setDerivaciones] = useState<DerivacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [detalle, setDetalle] = useState<DerivacionRow | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from(config.viewDerivaciones)
      .select("*")
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false })
      .then(({ data, error }: { data: any[] | null; error: any }) => { // ✅ Tipado explícito de la respuesta
        if (error) toast.error("Error al cargar derivaciones");
        else setDerivaciones((data as DerivacionRow[]) ?? []);
        setLoading(false);
      });
  }, [proyectoId]);

  function handleResolved(
    id: string,
    accion: "aprobada" | "rechazada",
    motivoRechazo: string | null
  ) {
    setDerivaciones((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              estado: accion,
              motivo_rechazo: accion === "rechazada" ? motivoRechazo : d.motivo_rechazo,
            }
          : d
      )
    );
    setDetalle(null);
  }

  const derivacionesFiltradas =
    filtro === "todas"
      ? derivaciones
      : filtro === "derivacion" || filtro === "exclusion"
      ? derivaciones.filter((d) => d.tipo === filtro)
      : derivaciones.filter((d) => d.estado === filtro);

  const pendienteCount = derivaciones.filter((d) => d.estado === "pendiente").length;

  return (
    <section className="flex flex-col h-[calc(100vh-240px)] overflow-hidden pb-8">
      <header className="shrink-0 flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-8">Solicitudes de derivación</span>
          {pendienteCount > 0 && (
            <span className="rounded-full bg-warning-1 text-warning-7 px-2 py-0.5 text-xs font-medium">
              {pendienteCount} pendiente{pendienteCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-6 shrink-0">Filtrar:</label>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            className="text-sm border border-gray-2 rounded-lg px-3 py-1.5 text-gray-7 bg-white focus:outline-none focus:ring-2 focus:ring-primary-3"
          >
            {FILTROS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-2 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-1 border-b border-gray-2">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Solicitante</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Tarea</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Estado</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonFilas />}

            {!loading && derivaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-4">
                  No hay solicitudes de derivación para este proyecto.
                </td>
              </tr>
            )}

            {!loading && derivaciones.length > 0 && derivacionesFiltradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-4">
                  No hay solicitudes con este filtro.
                </td>
              </tr>
            )}

            {!loading &&
              derivacionesFiltradas.map((d) => {
                const tb = tipoBadge(d.tipo);
                const eb = estadoBadge(d.estado);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-gray-1 hover:bg-gray-1 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-7 whitespace-nowrap">
                      {d.solicitante_nombre ?? d.solicitante_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-6 whitespace-nowrap">
                      {d.estandar} {d.jerarquia_1}-{d.jerarquia_2}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tb.cls}`}>
                        {tb.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${eb.cls}`}>
                        {eb.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-5 whitespace-nowrap">
                      {formatFecha(d.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetalle(d)}
                        className="btn-ghost text-xs px-2 py-1"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {detalle && (
        <DetalleModal
          derivacion={detalle}
          onClose={() => setDetalle(null)}
          onResolved={handleResolved}
          config={config}
        />
      )}
    </section>
  );
}

export default function DerivacionesView({
  proyectoId,
  rol,
  uid,
  config,
}: {
  proyectoId: string;
  rol: string;
  uid: string;
  config: ReporteConfig;
}) {
  if (rol === "encargado" || rol === "revisor") {
    return (
      <MiembroDerivacionesView
        proyectoId={parseInt(proyectoId, 10)}
        uid={uid}
        rol={rol as "encargado" | "revisor"}
        config={config}
      />
    );
  }
  return <AdminDerivacionesView proyectoId={proyectoId} config={config} />;
}
