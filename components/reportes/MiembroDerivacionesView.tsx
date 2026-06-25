"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { notificarNuevaSolicitudAdmin } from "@/lib/supabase/notificaciones";
import { toast } from "sonner";
import type { ReporteConfig } from "@/lib/reportes/types";

interface Props {
  proyectoId: number;
  uid: string;
  rol: "encargado" | "revisor";
  config: ReporteConfig;
}

interface MiDerivacionRow {
  id: string;
  tarea_id: number;
  tipo: "derivacion" | "exclusion";
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo: string;
  motivo_rechazo: string | null;
  derivar_a_nombre: string | null;
  derivar_a_texto: string | null;
  created_at: string;
  tarea_public_id: string;
  estandar: string;
  jerarquia_1: string;
  jerarquia_2: string;
}

interface TareaOpcion {
  tarea_id: number;
  tarea_public_id: string;
  estandar: string;
  jerarquia_1: string;
  jerarquia_2: string;
  jerarquia_2_nombre: string;
  equipo_id: number | null;
}

interface UsuarioOpcion {
  uid: string;
  nombre_completo: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

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

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonFilas() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className="border-b border-gray-1">
          <td className="px-4 py-3"><div className="h-4 w-36 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-2 animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-7 w-10 rounded bg-gray-2 animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

// ── Modal readonly de detalle ──────────────────────────────────────────────

function DetalleModal({
  derivacion,
  onClose,
}: {
  derivacion: MiDerivacionRow;
  onClose: () => void;
}) {
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
            <p className="text-xs text-gray-4 mb-0.5">Tarea</p>
            <p className="text-gray-8">
              {derivacion.estandar} {derivacion.jerarquia_1}-{derivacion.jerarquia_2}
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
      </div>
    </div>
  );
}

// ── Modal nueva solicitud ──────────────────────────────────────────────────

type TabSolicitud = "derivar" | "excluir";
type ModoDerivacion = "seleccionar" | "manual";

function NuevaSolicitudModal({
  proyectoId,
  uid,
  rol,
  misTareas,
  usuariosMismoRol,
  onClose,
  onCreated,
  config,
}: {
  proyectoId: number;
  uid: string;
  rol: "encargado" | "revisor";
  misTareas: TareaOpcion[];
  usuariosMismoRol: UsuarioOpcion[];
  onClose: () => void;
  onCreated: (row: MiDerivacionRow) => void;
  config: ReporteConfig;
}) {
  const [activeTab, setActiveTab] = useState<TabSolicitud>("derivar");
  const [selectedTareaId, setSelectedTareaId] = useState<number | "">("");
  const [motivoText, setMotivoText] = useState("");
  const [modoDerivacion, setModoDerivacion] = useState<ModoDerivacion>(
    usuariosMismoRol.length > 0 ? "seleccionar" : "manual"
  );
  const [selectedUsuarioUid, setSelectedUsuarioUid] = useState("");
  const [derivarTexto, setDerivarTexto] = useState("");
  const [saving, setSaving] = useState(false);

  const tareaSeleccionada = misTareas.find((t) => t.tarea_id === selectedTareaId);
  const motivoValido = motivoText.trim().length >= 10;

  const puedeEnviar =
    selectedTareaId !== "" &&
    motivoValido &&
    (activeTab === "excluir" ||
      (activeTab === "derivar" &&
        (modoDerivacion === "manual"
          ? derivarTexto.trim().length > 0
          : selectedUsuarioUid !== "")));

  async function handleSubmit() {
    if (!puedeEnviar) return;
    setSaving(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const empresaId = (user?.app_metadata as { empresa_id?: number } | undefined)
      ?.empresa_id;

    const tipo = activeTab === "derivar" ? "derivacion" : "exclusion";
    const derivarAUid =
      activeTab === "derivar" && modoDerivacion === "seleccionar" && selectedUsuarioUid
        ? selectedUsuarioUid
        : null;
    const derivarATexto =
      activeTab === "derivar" && modoDerivacion === "manual" && derivarTexto.trim()
        ? derivarTexto.trim()
        : null;

    const { data, error } = await supabase
      .from(config.derivacionesTable)
      .insert({
        empresa_id: empresaId,
        proyecto_id: proyectoId,
        tarea_id: selectedTareaId as number,
        tipo,
        solicitante_uid: uid,
        derivar_a_uid: derivarAUid,
        derivar_a_texto: derivarATexto,
        motivo: motivoText.trim(),
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    void supabase
      .rpc("log_usuario_accion", {
        p_accion:
          tipo === "derivacion" ? "CREATE_DERIVACION" : "CREATE_EXCLUSION_SOLICITUD",
        p_tabla: config.derivacionesTable,
        p_registro_id: data?.id ?? "",
        p_datos_prev: null,
        p_datos_new: {
          tarea_id: selectedTareaId,
          tipo,
          derivar_a: derivarAUid ?? derivarATexto ?? null,
        },
        p_proyecto_id: proyectoId,
      })
      .then(undefined, (err: unknown) => console.error("[log derivacion]:", err));

  const nuevaFila: MiDerivacionRow = {
        id: data?.id ?? "",
        tarea_id: selectedTareaId as number,
        tipo,
        estado: "pendiente",
        motivo: motivoText.trim(),
        motivo_rechazo: null,
        derivar_a_nombre:
          usuariosMismoRol.find((u) => u.uid === derivarAUid)?.nombre_completo ?? null,
        derivar_a_texto: derivarATexto,
        created_at: new Date().toISOString(),
        tarea_public_id: tareaSeleccionada?.tarea_public_id ?? "",
        estandar: tareaSeleccionada?.estandar ?? "",
        jerarquia_1: tareaSeleccionada?.jerarquia_1 ?? "",
        jerarquia_2: tareaSeleccionada?.jerarquia_2 ?? "",
      };

      // --- FIX: AVISAR AL ADMINISTRADOR POR CORREO ---
      const tareaLabel = `${tareaSeleccionada?.estandar ?? ""} ${tareaSeleccionada?.jerarquia_1 ?? ""}-${tareaSeleccionada?.jerarquia_2 ?? ""}`;
      try {
        await notificarNuevaSolicitudAdmin({
          solicitanteUid: uid,
          tareaLabel: tareaLabel,
          tipo: tipo as "derivacion" | "exclusion"
        });
      } catch (err) {
        console.error("[correo admin error]:", err);
      }
      // -----------------------------------------------

      toast.success("Solicitud enviada");
      onCreated(nuevaFila);
      setSaving(false);
    }

  const tabBtn = (tab: TabSolicitud, label: string) =>
    `px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-primary-1 text-primary-7"
        : "text-gray-5 hover:text-gray-8"
    }`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-8">Nueva solicitud</h3>
          <button
            onClick={onClose}
            className="text-gray-4 hover:text-gray-7 transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Tabs internas */}
        <div className="flex gap-1 bg-gray-1 rounded-lg p-1 mb-4">
          <button className={tabBtn("derivar", "Derivar")} onClick={() => setActiveTab("derivar")}>
            Derivar
          </button>
          <button className={tabBtn("excluir", "Excluirme")} onClick={() => setActiveTab("excluir")}>
            Excluirme
          </button>
        </div>

        <div className="space-y-4">
          {/* Tarea — campo común */}
          <div>
            <label className="block text-xs font-medium text-gray-6 mb-1">
              Tarea <span className="text-critique-6">*</span>
            </label>
            <select
              value={selectedTareaId}
              onChange={(e) =>
                setSelectedTareaId(e.target.value === "" ? "" : parseInt(e.target.value, 10))
              }
              className="w-full border border-gray-2 rounded-lg px-3 py-2 text-sm text-gray-7 bg-white focus:outline-none focus:ring-2 focus:ring-primary-3"
            >
              <option value="">Seleccionar tarea</option>
              {misTareas.map((t) => (
                <option key={t.tarea_id} value={t.tarea_id}>
                  {t.estandar} {t.jerarquia_1}-{t.jerarquia_2} · {t.jerarquia_2_nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Motivo — campo común */}
          <div>
            <label className="block text-xs font-medium text-gray-6 mb-1">
              Motivo <span className="text-critique-6">*</span>
            </label>
            <textarea
              value={motivoText}
              onChange={(e) => setMotivoText(e.target.value)}
              rows={3}
              className="w-full border border-gray-2 rounded-lg px-3 py-2 text-sm text-gray-7 focus:outline-none focus:ring-2 focus:ring-primary-3 resize-none"
              placeholder={
                activeTab === "derivar"
                  ? "¿Por qué quieres derivar esta tarea?"
                  : "¿Por qué no puedes participar en esta tarea?"
              }
            />
          </div>

          {/* Campos solo tab Derivar */}
          {activeTab === "derivar" && (
            <div className="space-y-3">
              {/* Toggle seleccionar/manual */}
              <div className="flex gap-1 bg-gray-1 rounded-lg p-1">
                <button
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                    modoDerivacion === "seleccionar"
                      ? "bg-white text-gray-8 shadow-sm"
                      : "text-gray-5 hover:text-gray-7"
                  }`}
                  onClick={() => setModoDerivacion("seleccionar")}
                >
                  Seleccionar persona
                </button>
                <button
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                    modoDerivacion === "manual"
                      ? "bg-white text-gray-8 shadow-sm"
                      : "text-gray-5 hover:text-gray-7"
                  }`}
                  onClick={() => setModoDerivacion("manual")}
                >
                  Escribir manualmente
                </button>
              </div>

              {modoDerivacion === "seleccionar" ? (
                usuariosMismoRol.length > 0 ? (
                  <select
                    value={selectedUsuarioUid}
                    onChange={(e) => setSelectedUsuarioUid(e.target.value)}
                    className="w-full border border-gray-2 rounded-lg px-3 py-2 text-sm text-gray-7 bg-white focus:outline-none focus:ring-2 focus:ring-primary-3"
                  >
                    <option value="">Seleccionar persona</option>
                    {usuariosMismoRol.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.nombre_completo}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-4 bg-gray-1 rounded-lg p-3">
                    No hay otros {rol}s disponibles. Usa el modo manual.
                  </p>
                )
              ) : (
                <input
                  type="text"
                  value={derivarTexto}
                  onChange={(e) => setDerivarTexto(e.target.value)}
                  className="w-full border border-gray-2 rounded-lg px-3 py-2 text-sm text-gray-7 focus:outline-none focus:ring-2 focus:ring-primary-3"
                  placeholder="Nombre o email de la persona"
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-5">
          <button
            disabled={!puedeEnviar || saving}
            onClick={handleSubmit}
            className="w-full btn-primary rounded-lg text-sm py-2 disabled:opacity-50"
          >
            {saving ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista principal miembro ────────────────────────────────────────────────

export default function MiembroDerivacionesView({ proyectoId, uid, rol, config }: Props) {
  const [derivaciones, setDerivaciones] = useState<MiDerivacionRow[]>([]);
  const [misTareas, setMisTareas] = useState<TareaOpcion[]>([]);
  const [tareasExcluidasSet, setTareasExcluidasSet] = useState<Set<number>>(new Set());
  const [usuariosMismoRol, setUsuariosMismoRol] = useState<UsuarioOpcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<MiDerivacionRow | null>(null);
  const [nuevaSolicitudOpen, setNuevaSolicitudOpen] = useState(false);

  const misTareasFiltradas = useMemo(() => {
    const tareasConSolicitudActiva = new Set(
      derivaciones
        .filter((d) => d.estado === "pendiente" || d.estado === "aprobada")
        .map((d) => d.tarea_id)
    );
    return misTareas.filter(
      (t) => !tareasConSolicitudActiva.has(t.tarea_id) && !tareasExcluidasSet.has(t.tarea_id)
    );
  }, [misTareas, derivaciones, tareasExcluidasSet]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchAll() {
      // Mis derivaciones (RLS filtra por solicitante_uid = auth.uid())
      const { data: derivData } = await supabase
        .from(config.viewDerivaciones)
        .select(
          "id, tarea_id, tipo, estado, motivo, motivo_rechazo, derivar_a_nombre, derivar_a_texto, created_at, tarea_public_id, estandar, jerarquia_1, jerarquia_2"
        )
        .eq("proyecto_id", proyectoId)
        .eq('solicitante_uid', uid)
        .order("created_at", { ascending: false });

      setDerivaciones((derivData as MiDerivacionRow[]) ?? []);

      const { data: exclusionesData } = await supabase
        .from(config.exclusionesTable)
        .select("tarea_id")
        .eq("user_id", uid);
      setTareasExcluidasSet(new Set(((exclusionesData ?? []) as { tarea_id: number }[]).map((e) => e.tarea_id)));

      // Equipos donde el usuario es miembro
      const { data: equiposData } = await supabase
        .from("equipo_miembros")
        .select("equipo_id")
        .eq("user_id", uid);

      const equipoIds = ((equiposData as { equipo_id: number }[] | null) ?? []).map(
        (e) => e.equipo_id
      );

      // Tareas del proyecto con equipo asignado
      if (equipoIds.length > 0) {
        const { data: tareasData } = await supabase
          .from(config.tareasView)
          .select("tarea_id, public_id, estandar, jerarquia_1, jerarquia_2, jerarquia_2_nombre, equipo_id")
          .eq("proyecto_id", proyectoId)
          .not("equipo_id", "is", null)
          .in("equipo_id", equipoIds);

        const tareas = ((tareasData as {
          tarea_id: number;
          public_id: string;
          estandar: string;
          jerarquia_1: string;
          jerarquia_2: string;
          jerarquia_2_nombre: string;
          equipo_id: number | null;
        }[] | null) ?? []).map((t) => ({
          tarea_id: t.tarea_id,
          tarea_public_id: t.public_id,
          estandar: t.estandar,
          jerarquia_1: t.jerarquia_1,
          jerarquia_2: t.jerarquia_2,
          jerarquia_2_nombre: t.jerarquia_2_nombre,
          equipo_id: t.equipo_id,
        }));

        setMisTareas(tareas);
      }

      // Usuarios con el mismo rol en la empresa (excluyendo al propio usuario)
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(name), usuarios!inner(uid, nombre_completo, activo)")
        .eq("roles.name", rol);

      type RolRow = {
        user_id: string;
        roles: { name: string };
        usuarios: { uid: string; nombre_completo: string; activo: boolean };
      };

      const opciones = ((rolesData as unknown as RolRow[]) ?? [])
        .filter(
          (r) =>
            r.usuarios?.activo === true &&
            r.usuarios?.uid !== uid
        )
        .map((r) => ({
          uid: r.usuarios.uid,
          nombre_completo: r.usuarios.nombre_completo,
        }));

      setUsuariosMismoRol(opciones);
      setLoading(false);
    }

    void fetchAll().catch(() => {
      toast.error("Error al cargar derivaciones");
      setLoading(false);
    });
  }, [proyectoId, uid, rol]);

  function handleCreated(row: MiDerivacionRow) {
    setDerivaciones((prev) => [row, ...prev]);
    setNuevaSolicitudOpen(false);
  }

  const pendienteCount = derivaciones.filter((d) => d.estado === "pendiente").length;

  return (
    <section className="flex flex-col h-[calc(100vh-240px)] overflow-hidden pb-8">
      <header className="shrink-0 flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-8">Mis solicitudes</span>
          {pendienteCount > 0 && (
            <span className="rounded-full bg-warning-1 text-warning-7 px-2 py-0.5 text-xs font-medium">
              {pendienteCount} pendiente{pendienteCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setNuevaSolicitudOpen(true)}
            className="btn-primary rounded-lg text-sm px-4 py-1.5"
          >
            + Nueva solicitud
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-2 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-1 border-b border-gray-2">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Tarea</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Estado</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Derivar a</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-6 whitespace-nowrap">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonFilas />}

            {!loading && derivaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-4">
                  No tienes solicitudes de derivación en este proyecto.
                </td>
              </tr>
            )}

            {!loading &&
              derivaciones.map((d) => {
                const tb = tipoBadge(d.tipo);
                const eb = estadoBadge(d.estado);
                const derivarA =
                  d.tipo === "derivacion"
                    ? (d.derivar_a_nombre ?? d.derivar_a_texto ?? "—")
                    : "—";
                return (
                  <tr
                    key={d.id}
                    className="border-b border-gray-1 hover:bg-gray-1 transition-colors"
                  >
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
                    <td className="px-4 py-3 text-gray-6 whitespace-nowrap">{derivarA}</td>
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
        <DetalleModal derivacion={detalle} onClose={() => setDetalle(null)} />
      )}

      {nuevaSolicitudOpen && (
        <NuevaSolicitudModal
          proyectoId={proyectoId}
          uid={uid}
          rol={rol}
          misTareas={misTareasFiltradas}
          usuariosMismoRol={usuariosMismoRol}
          onClose={() => setNuevaSolicitudOpen(false)}
          onCreated={handleCreated}
          config={config}
        />
      )}
    </section>
  );
}
