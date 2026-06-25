"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReporteConfig } from "@/lib/reportes";
import type {
  EvidenciaRow,
  MiembroEquipo,
  RespuestasMap,
  TareaDetalle,
} from "@/lib/tareas/types";
import { canBorrarEvidencia, canEditarRespuestas, canSubirEvidencias } from "@/lib/tareas/permisos";
import type { PermisoCtx } from "@/lib/tareas/permisos";
import { createClient } from "@/lib/supabase/client";
import {
  notificarTareaCompletada,
  notificarTareaEnviadaRevision,
  notificarTareaRetornada,
} from "@/lib/supabase/notificaciones-tarea";
import { enviarEmailCambioEstado } from "@/app/actions/notificaciones-email";
import { useTareaDraft } from "@/hooks/useTareaDraft";
import { useEvidencias } from "@/hooks/useEvidencias";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { usePresenciaTarea } from "@/hooks/usePresenciaTarea";
import { useTareaDetalle } from "@/hooks/useTareaDetalle";
import { useChatTarea } from "@/hooks/useChatTarea";
import { useAuthStore } from "@/lib/store/auth";
import { TareaHeader } from "./TareaHeader";
import { RespuestasForm } from "./RespuestasForm";
import { AccionesBar } from "./AccionesBar";
import { EvidenciasDropzone } from "./EvidenciasDropzone";
import { EvidenciasList } from "./EvidenciasList";
import { DetallesPanel, DetallesModal } from "./DetallesPanel";
import { ConflictoVersionModal } from "./ConflictoVersionModal";
import { GuardarOPerderModal } from "./GuardarOPerderModal";
import { RechazarTareaModal } from "./RechazarTareaModal";
import { EliminarTareaModal } from "./EliminarTareaModal";

interface Props {
  config: ReporteConfig;
  tarea: TareaDetalle;
  miembros: MiembroEquipo[];
  evidencias: EvidenciaRow[];
  uid: string;
  esAdmin: boolean;
  esEncargado: boolean;
  esRevisor: boolean;
  empresaRef: string;
  proyectoRef: string;
  proyectoNombre: string;
  tipo: string;
}

interface GuardarResult {
  ok?: boolean;
  error?: string;
  mensaje?: string;
  version?: number;
  version_actual?: number;
}

interface CambioEstadoResult {
  ok?: boolean;
  error?: string;
  estado?: string;
}

export function TareaDetalleView({
  config,
  tarea,
  miembros,
  evidencias: evidenciasIniciales,
  uid,
  esAdmin,
  esEncargado,
  esRevisor,
  empresaRef,
  proyectoRef,
  proyectoNombre,
  tipo,
}: Props) {
  const router = useRouter();
  const authStore = useAuthStore();
  const nombreUsuario = authStore.usuarioActual?.nombreCompleto ?? "";
  const rolUsuario = esAdmin ? "administrador" : esEncargado ? "encargado" : "revisor";

  const [tareaLocal, setTareaLocal] = useState(tarea);
  const [adminModoEdicion, setAdminModoEdicion] = useState(false);
  const [version, setVersion] = useState(tarea.version);
  const [saving, setSaving] = useState(false);
  const [detallesAbierto, setDetallesAbierto] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);

  const [conflictoOpen, setConflictoOpen] = useState(false);
  const [conflictoVersion, setConflictoVersion] = useState<number | undefined>(undefined);
  const [rechazarOpen, setRechazarOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [bloqueoNavOpen, setBloqueoNavOpen] = useState(false);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const navIntentRef = useRef<string | null>(null);

  const draft = useTareaDraft(tarea.respuestas);
  const evidenciasHook = useEvidencias(evidenciasIniciales, config.tareasTable, config.evidenciasTable);

  // ── Fase 2: presencia, realtime estado, chat ───────────────────────────────
  const { presentes } = usePresenciaTarea(tarea.public_id, {
    uid,
    nombre: nombreUsuario,
    rol: rolUsuario,
  });

  const { versionRemota, resetVersionRemota } = useTareaDetalle(tarea.tarea_id, version, config.tareasTable);

  const chat = useChatTarea(tarea.tarea_id, uid, tarea.empresa_id, config.mensajesTable, config.lecturasTable);

  useEffect(() => {
    function check() {
      setIsWideScreen(window.innerWidth > 1600);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const ctx: PermisoCtx = useMemo(
    () => ({
      uid,
      tarea: { ...tarea, version },
      esAdmin,
      esEncargado,
      esRevisor,
      adminModoEdicion,
    }),
    [uid, tarea, version, esAdmin, esEncargado, esRevisor, adminModoEdicion]
  );

  const editable = canEditarRespuestas(ctx);
  const puedeSubirEvidencias = canSubirEvidencias(ctx);

  const subiendoArchivo = evidenciasHook.uploads.length > 0;
  const uiBloqueada = saving || enviandoRevision || subiendoArchivo;

  // ── Optimistic locking: guardar ────────────────────────────────────────────
  const handleGuardar = useCallback(async (): Promise<boolean> => {
    if (!draft.isDirty || saving) return true;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc(config.rpcGuardarRespuestas, {
      p_public_id: tarea.public_id,
      p_respuestas: draft.respuestas,
      p_version: version,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    const result = (data as GuardarResult | null) ?? {};
    if (result.error === "conflict") {
      setConflictoVersion(result.version_actual);
      setConflictoOpen(true);
      return false;
    }
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    if (result.version) setVersion(result.version);
    draft.commitSnapshot(draft.respuestas);
    setTareaLocal((prev) => ({ ...prev, respuestas: draft.respuestas }));
    toast.success("Respuestas guardadas");
    return true;
  }, [draft, saving, tarea.public_id, version]);

  // ── Cambios de estado ──────────────────────────────────────────────────────
  const cambiarEstado = useCallback(
    async (nuevoEstado: "en_revision" | "completada" | "retornada", motivo?: string, asAdmin?: boolean, modoEdicionAdmin?: boolean) => {
      setSaving(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc(config.rpcCambiarEstado, {
        p_public_id: tarea.public_id,
        p_nuevo_estado: nuevoEstado,
        p_motivo: motivo ?? null,
        p_as_admin: asAdmin ?? false,
        p_modo_edicion_admin: modoEdicionAdmin ?? false,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return false;
      }
      const result = (data as CambioEstadoResult | null) ?? {};
      if (result.error) {
        toast.error(result.error);
        return false;
      }
      return true;
    },
    [tarea.public_id]
  );

  const handleEnviarRevision = useCallback(async () => {
    setEnviandoRevision(true);
    try {
      if (draft.isDirty) {
        const ok = await handleGuardar();
        if (!ok) { setEnviandoRevision(false); return; }
      }
      const ok = await cambiarEstado("en_revision", undefined, false, esAdmin && adminModoEdicion);
      if (!ok) { setEnviandoRevision(false); return; }
      void notificarTareaEnviadaRevision({
        proyectoId: tarea.proyecto_id,
        proyectoRef,
        publicId: tarea.public_id,
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        tipoReporte: config.tipo,
        equipoId: tarea.equipo_id,
      }).catch((err) => console.error("[notificarTareaEnviadaRevision]", err));
      void enviarEmailCambioEstado({
        equipoId: tarea.equipo_id,
        proyectoRef,
        proyectoNombre,
        publicId: tarea.public_id,
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        tipoReporte: config.tipo,
        nuevoEstado: "en_revision",
        quienActuo: nombreUsuario,
      }).catch((err) => console.error("[emailEnviarRevision]", err));
      toast.success("Tarea enviada a revisión");
      // El estado se limpia automáticamente cuando el componente se remonta via key prop.
      router.refresh();
    } catch {
      setEnviandoRevision(false);
      toast.error("Error al enviar a revisión");
    }
  }, [adminModoEdicion, cambiarEstado, config.tipo, draft.isDirty, esAdmin, handleGuardar, proyectoRef, router, tarea.equipo_id, tarea.jerarquia_2_nombre, tarea.proyecto_id, tarea.public_id]);

  const handleAprobar = useCallback(async () => {
    const ok = await cambiarEstado("completada");
    if (!ok) return;
    void notificarTareaCompletada({
      proyectoId: tarea.proyecto_id,
      proyectoRef,
      publicId: tarea.public_id,
      jerarquia2Nombre: tarea.jerarquia_2_nombre,
      tipoReporte: config.tipo,
      equipoId: tarea.equipo_id,
    }).catch((err) => console.error("[notificarTareaCompletada]", err));
    void enviarEmailCambioEstado({
      equipoId: tarea.equipo_id,
      proyectoRef,
      proyectoNombre,
      publicId: tarea.public_id,
      jerarquia2Nombre: tarea.jerarquia_2_nombre,
      tipoReporte: config.tipo,
      nuevoEstado: "completada",
      quienActuo: nombreUsuario,
    }).catch((err) => console.error("[emailAprobar]", err));
    toast.success("Tarea aprobada");
    resetVersionRemota();
    router.refresh();
  }, [cambiarEstado, config.tipo, proyectoRef, resetVersionRemota, router, tarea.equipo_id, tarea.jerarquia_2_nombre, tarea.proyecto_id, tarea.public_id]);

  const handleAprobarAdmin = useCallback(async () => {
    const ok = await cambiarEstado("completada", undefined, true);
    if (!ok) return;
    void notificarTareaCompletada({
      proyectoId: tarea.proyecto_id,
      proyectoRef,
      publicId: tarea.public_id,
      jerarquia2Nombre: tarea.jerarquia_2_nombre,
      tipoReporte: config.tipo,
      equipoId: tarea.equipo_id,
    }).catch((err) => console.error("[notificarTareaCompletada]", err));
    void enviarEmailCambioEstado({
      equipoId: tarea.equipo_id,
      proyectoRef,
      proyectoNombre,
      publicId: tarea.public_id,
      jerarquia2Nombre: tarea.jerarquia_2_nombre,
      tipoReporte: config.tipo,
      nuevoEstado: "completada",
      quienActuo: nombreUsuario,
    }).catch((err) => console.error("[emailAprobarAdmin]", err));
    toast.success("Aprobada como admin");
    resetVersionRemota();
    router.refresh();
  }, [cambiarEstado, config.tipo, proyectoRef, resetVersionRemota, router, tarea.equipo_id, tarea.estado, tarea.jerarquia_2_nombre, tarea.proyecto_id, tarea.public_id]);

  const handleRechazarConfirm = useCallback(
    async (motivo: string) => {
      const ok = await cambiarEstado("retornada", motivo);
      if (!ok) return;
      void notificarTareaRetornada({
        proyectoId: tarea.proyecto_id,
        proyectoRef,
        publicId: tarea.public_id,
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        tipoReporte: config.tipo,
        equipoId: tarea.equipo_id,
        motivo,
      }).catch((err) => console.error("[notificarTareaRetornada]", err));
      void enviarEmailCambioEstado({
        equipoId: tarea.equipo_id,
        proyectoRef,
        proyectoNombre,
        publicId: tarea.public_id,
        jerarquia2Nombre: tarea.jerarquia_2_nombre,
        tipoReporte: config.tipo,
        nuevoEstado: "retornada",
        motivo,
        quienActuo: nombreUsuario,
      }).catch((err) => console.error("[emailRetornar]", err));
      setRechazarOpen(false);
      toast.success("Tarea retornada");
      router.refresh();
    },
    [cambiarEstado, config.tipo, proyectoRef, router, tarea.equipo_id, tarea.jerarquia_2_nombre, tarea.proyecto_id, tarea.public_id]
  );

  const handleEliminarConfirm = useCallback(async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc(config.rpcEliminar, { p_public_id: tarea.public_id });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tarea eliminada");
    router.push(`/dashboard/proyecto/${proyectoRef}/${tipo.toLowerCase()}/seguimiento`);
  }, [proyectoRef, router, tarea.public_id, tipo]);

  // ── Admin toggle ───────────────────────────────────────────────────────────
  const handleToggleAdminModo = useCallback((next: boolean) => {
    setAdminModoEdicion(next);
  }, []);

  // ── Evidencias ─────────────────────────────────────────────────────────────
  const handleFiles = useCallback(
    (files: File[]) => {
      if (!puedeSubirEvidencias) {
        toast.warning("No puedes subir evidencias en este estado");
        return;
      }
      void evidenciasHook.upload(files, {
        empresaRef,
        proyectoRef,
        j1: tarea.jerarquia_1,
        j2: tarea.jerarquia_2,
        tareaId: tarea.tarea_id,
        empresaId: tarea.empresa_id,
        proyectoId: tarea.proyecto_id,
        uploaderUid: uid,
        uploaderNombre: nombreUsuario,
      });
    },
    [empresaRef, evidenciasHook, nombreUsuario, proyectoRef, puedeSubirEvidencias, tarea.empresa_id, tarea.jerarquia_1, tarea.jerarquia_2, tarea.proyecto_id, tarea.tarea_id, uid]
  );

  // ── Bloqueo de navegación ──────────────────────────────────────────────────
  const handleNavIntent = useCallback(
    (href: string) => {
      if (!draft.isDirty) return true;
      navIntentRef.current = href;
      setBloqueoNavOpen(true);
      return false;
    },
    [draft.isDirty]
  );

  useBlockNavigation({ enabled: draft.isDirty, onIntent: handleNavIntent });

  const handleNavGuardarYSalir = useCallback(async () => {
    const ok = await handleGuardar();
    if (!ok) return;
    setBloqueoNavOpen(false);
    if (navIntentRef.current) {
      const target = navIntentRef.current;
      navIntentRef.current = null;
      router.push(target);
    }
  }, [handleGuardar, router]);

  const handleNavSalirSinGuardar = useCallback(() => {
    draft.resetDraft();
    draft.commitSnapshot(tarea.respuestas);
    setBloqueoNavOpen(false);
    if (navIntentRef.current) {
      const target = navIntentRef.current;
      navIntentRef.current = null;
      router.push(target);
    }
  }, [draft, router, tarea.respuestas]);

  const handleNavCancelar = useCallback(() => {
    navIntentRef.current = null;
    setBloqueoNavOpen(false);
  }, []);

  const handleConflictoRecargar = useCallback(() => {
    setConflictoOpen(false);
    window.location.reload(); // <--- Fuerza la destrucción del estado local
  }, []);

  const handleRecargarRealtime = useCallback(() => {
    window.location.reload(); // <--- Fuerza la destrucción del estado local
  }, []);

  const handleConflictoMantener = useCallback(() => {
    setConflictoOpen(false);
  }, []);


  // ── Chat props ─────────────────────────────────────────────────────────────
  const chatProps = useMemo(
    () => ({
      mensajes: chat.mensajes,
      cargando: chat.cargando,
      noLeidos: chat.noLeidos,
      uid,
      onEnviar: chat.enviar,
      onMarcarLeido: () => void chat.marcarLeido(),
    }),
    [chat, uid]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const mostrarDetallesEnPanel = isWideScreen;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <TareaHeader
          config={config}
          tarea={{ ...tarea, version }}
          esAdmin={esAdmin}
          adminModoEdicion={adminModoEdicion}
          onToggleAdminModo={handleToggleAdminModo}
          onAbrirDetalles={() => setDetallesAbierto(true)}
          showDetallesButton={!mostrarDetallesEnPanel}
          noLeidos={chat.noLeidos}
          proyectoRef={proyectoRef}
          tipo={tipo}
          presentes={presentes}
          versionRemota={versionRemota}
          onRecargar={handleRecargarRealtime}
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-5">
            Respuestas por requerimiento
          </h2>
          <RespuestasForm
            requerimientos={tarea.requerimientos}
            respuestas={draft.respuestas}
            disabled={!editable}
            onChangeLetra={draft.setLetra}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-5">Evidencias</h2>
            <span className="text-xs text-gray-4">{evidenciasHook.evidencias.length} archivo(s)</span>
          </div>
          <EvidenciasDropzone
            disabled={!puedeSubirEvidencias || uiBloqueada}
            uploads={evidenciasHook.uploads}
            onFiles={handleFiles}
          />
          <EvidenciasList
            evidencias={evidenciasHook.evidencias}
            tareaId={tarea.tarea_id}
            canBorrar={(ev) => canBorrarEvidencia(ctx, ev)}
            onBorrar={evidenciasHook.borrar}
            onDescargar={evidenciasHook.descargar}
          />
        </section>

        <AccionesBar
          ctx={ctx}
          respuestasBD={tareaLocal.respuestas}
          isDirty={draft.isDirty}
          saving={saving}
          bloqueada={uiBloqueada}
          onGuardar={() => void handleGuardar()}
          onDeshacer={draft.resetDraft}
          onEnviarRevision={() => void handleEnviarRevision()}
          onAprobar={() => void handleAprobar()}
          onRechazar={() => setRechazarOpen(true)}
          onAprobarAdmin={() => void handleAprobarAdmin()}
          onEliminar={() => setEliminarOpen(true)}
        />
      </div>

      {mostrarDetallesEnPanel && (
        <DetallesPanel
          tarea={tarea}
          miembros={miembros}
          chat={chatProps}
          esAdmin={esAdmin}
          tareaId={tarea.tarea_id}
          empresaId={tarea.empresa_id}
          exclusionesTable={config.exclusionesTable}
          miembrosExtraTable={config.miembrosExtraTable}
        />
      )}

      <DetallesModal
        open={detallesAbierto && !mostrarDetallesEnPanel}
        onClose={() => setDetallesAbierto(false)}
        tarea={tarea}
        miembros={miembros}
        chat={chatProps}
        esAdmin={esAdmin}
        tareaId={tarea.tarea_id}
        empresaId={tarea.empresa_id}
        exclusionesTable={config.exclusionesTable}
        miembrosExtraTable={config.miembrosExtraTable}
      />

      <ConflictoVersionModal
        open={conflictoOpen}
        versionActual={conflictoVersion}
        onRecargar={handleConflictoRecargar}
        onMantener={handleConflictoMantener}
      />

      <GuardarOPerderModal
        open={bloqueoNavOpen}
        saving={saving}
        onGuardarYSalir={() => void handleNavGuardarYSalir()}
        onSalirSinGuardar={handleNavSalirSinGuardar}
        onCancelar={handleNavCancelar}
      />

      <RechazarTareaModal
        open={rechazarOpen}
        saving={saving}
        onConfirmar={(motivo) => void handleRechazarConfirm(motivo)}
        onCancelar={() => setRechazarOpen(false)}
      />

      <EliminarTareaModal
        open={eliminarOpen}
        saving={saving}
        tareaNombre={tarea.jerarquia_2_nombre}
        onConfirmar={() => void handleEliminarConfirm()}
        onCancelar={() => setEliminarOpen(false)}
      />

      {enviandoRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5 flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-primary-2 border-t-primary-5 animate-spin" />
            <div className="text-center">
              <p className="text-base font-semibold text-gray-9">Enviando tarea a revisión...</p>
              <p className="mt-1 text-sm text-gray-5">Estamos actualizando los permisos y notificando al equipo.</p>
            </div>
            <div className="flex w-full flex-col gap-2 pt-1">
              <button
                type="button"
                className="btn btn-primary rounded-lg w-full"
                onClick={() => router.push(`/dashboard/proyecto/${proyectoRef}/${tipo.toLowerCase()}/seguimiento`)}
              >
                Ir a mis tareas
              </button>
              <button
                type="button"
                disabled
                className="btn btn-outline rounded-lg w-full flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              >
                <span className="h-4 w-4 rounded-full border-2 border-gray-4 border-t-gray-6 animate-spin" />
                Volver al detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

