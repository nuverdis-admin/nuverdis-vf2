"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShieldAlert, Mail, Server } from "lucide-react";
import { forceLogoutAll } from "@/app/actions/admin-comando";
import {
  getPlatformConfig,
  updatePlatformConfig,
  enviarCorreoMantenimientoGlobal,
  type PlatformConfig,
} from "@/app/actions/admin-config";

// God Mode — Acciones críticas (tema oscuro).
// Mantenimiento de plataforma + acciones nucleares. Aislado del control de usuarios.

function isoToLocalString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIsoString(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function AccionesCriticasPanel() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);

  useEffect(() => {
    getPlatformConfig().then((data) => setConfig(data));
  }, []);

  async function handleCheckboxChange(
    campo: keyof PlatformConfig,
    valor: boolean
  ) {
    if (!config) return;
    setConfig({ ...config, [campo]: valor });
    const res = await updatePlatformConfig({ [campo]: valor });
    if (!res.ok) toast.error("No se pudo actualizar el permiso");
  }

  async function handleDateChange(
    campo: "inicio_mantenimiento" | "fin_mantenimiento",
    valorStr: string
  ) {
    if (!config) return;
    const isoVal = localToIsoString(valorStr);
    setConfig({ ...config, [campo]: isoVal });
    const res = await updatePlatformConfig({ [campo]: isoVal });
    if (!res.ok) toast.error("No se pudo guardar la planificación temporal");
  }

  async function toggleMantenimiento() {
    if (!config) return;
    setCargandoConfig(true);
    try {
      const nuevoEstado = !config.modo_mantenimiento;
      const res = await updatePlatformConfig({
        modo_mantenimiento: nuevoEstado,
      });
      if (res.ok) {
        setConfig({ ...config, modo_mantenimiento: nuevoEstado });
        toast.success(
          nuevoEstado
            ? "Modo mantenimiento ACTIVADO"
            : "Plataforma EN LÍNEA"
        );
      } else {
        toast.error("Error al mutar estado de red");
      }
    } finally {
      setCargandoConfig(false);
    }
  }

  async function handleEnviarCorreos() {
    setEnviandoCorreo(true);
    try {
      const res = await enviarCorreoMantenimientoGlobal();
      if (res.ok) {
        toast.success(
          `Correos despachados correctamente a ${res.usuarios} usuarios`
        );
      } else {
        toast.error(res.error || "Fallo en envío");
      }
    } finally {
      setEnviandoCorreo(false);
    }
  }

  async function handleLogoutAll() {
    setEjecutando(true);
    try {
      const res = await forceLogoutAll();
      if (res.ok) {
        toast.success(`${res.sesiones} sesiones liquidadas del servidor.`);
      } else {
        toast.error(res.error);
      }
    } finally {
      setEjecutando(false);
      setConfirmando(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <header className="mb-4 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-4">
          God Mode
        </p>
        <h1 className="text-xl font-bold text-[#EDEDED]">Acciones críticas</h1>
        <p className="mt-1 text-xs text-[#8C8C8C]">
          Mantenimiento de plataforma y acciones nucleares que afectan a todos
          los usuarios.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {/* MANTENIMIENTO */}
        <section className="flex shrink-0 flex-col rounded-xl border border-[#2A2A2A] border-t-4 border-t-warning-5 bg-[#161616] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-warning-5" />
            <h2 className="text-sm font-bold text-[#EDEDED]">
              Gestión de Operaciones e Infraestructura Técnica
            </h2>
          </div>

          <div className="space-y-4 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] p-3">
            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#EDEDED]">
                  Estado de Plataforma
                </p>
                <p
                  className={`text-[10px] font-semibold ${
                    config?.modo_mantenimiento
                      ? "text-critique-5"
                      : "text-primary-5"
                  }`}
                >
                  {config?.modo_mantenimiento
                    ? "MODO MANTENIMIENTO"
                    : "PLATAFORMA OPERATIVA"}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleMantenimiento}
                disabled={cargandoConfig || !config}
                className={`rounded px-3 py-1 text-[10px] font-bold transition-all ${
                  config?.modo_mantenimiento
                    ? "bg-primary-6 text-white hover:bg-primary-7"
                    : "bg-critique-6 text-white hover:bg-critique-7"
                }`}
              >
                {cargandoConfig
                  ? "PROCESANDO..."
                  : config?.modo_mantenimiento
                    ? "RESTAURAR"
                    : "APAGAR"}
              </button>
            </div>

            {/* CHECKBOXES */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-[#8C8C8C]">
                Exclusiones permitidas durante mantenimiento
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Admin", key: "permitir_admins" as const },
                  { label: "Encargado", key: "permitir_encargados" as const },
                  { label: "Revisor", key: "permitir_revisores" as const },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded border border-[#2A2A2A] bg-[#202020] p-2 transition-all hover:border-warning-5"
                  >
                    <input
                      type="checkbox"
                      checked={config?.[item.key] ?? false}
                      disabled={!config}
                      onChange={(e) =>
                        handleCheckboxChange(item.key, e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-gray-600 bg-black text-warning-5 focus:ring-0"
                    />
                    <span className="text-[9px] uppercase text-[#A1A1A1]">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* FECHAS */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-[#8C8C8C]">
                Ventana programada
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] text-[#8C8C8C]">
                    Inicio
                  </label>
                  <input
                    type="datetime-local"
                    aria-label="Inicio de mantenimiento"
                    disabled={!config}
                    value={isoToLocalString(config?.inicio_mantenimiento ?? null)}
                    onChange={(e) =>
                      handleDateChange("inicio_mantenimiento", e.target.value)
                    }
                    className="w-full rounded border border-[#2A2A2A] bg-[#202020] p-1.5 text-[10px] text-[#EDEDED] outline-none focus:border-warning-5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] text-[#8C8C8C]">
                    Fin
                  </label>
                  <input
                    type="datetime-local"
                    aria-label="Fin de mantenimiento"
                    disabled={!config}
                    value={isoToLocalString(config?.fin_mantenimiento ?? null)}
                    onChange={(e) =>
                      handleDateChange("fin_mantenimiento", e.target.value)
                    }
                    className="w-full rounded border border-[#2A2A2A] bg-[#202020] p-1.5 text-[10px] text-[#EDEDED] outline-none focus:border-warning-5"
                  />
                </div>
              </div>
            </div>

            {/* BANNER */}
            {config?.banner_aviso_activo && (
              <div className="rounded border border-warning-5/30 bg-warning-5/10 px-3 py-2 text-[10px] font-semibold text-warning-5">
                AVISO GLOBAL ACTIVO
              </div>
            )}

            {/* ACCIÓN */}
            <button
              type="button"
              onClick={async () => {
                if (!config?.inicio_mantenimiento) {
                  return toast.error("Debes configurar fecha de inicio");
                }
                await handleCheckboxChange("banner_aviso_activo", true);
                await handleEnviarCorreos();
                toast.success("Ventana de mantenimiento programada");
              }}
              disabled={enviandoCorreo || !config}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-warning-5 px-3 py-2 text-xs font-bold text-[#161616] transition-colors hover:bg-warning-4 disabled:opacity-40"
            >
              <Mail className="h-3.5 w-3.5" />
              {enviandoCorreo ? "ENVIANDO..." : "PROGRAMAR Y NOTIFICAR"}
            </button>
          </div>
        </section>

        {/* DANGER ZONE */}
        <section className="flex shrink-0 flex-col rounded-xl border border-critique-7 border-t-4 border-t-critique-6 bg-[#161616] p-4">
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-critique-5" />
            <h2 className="text-sm font-bold text-critique-5">
              Zona de peligro
            </h2>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-critique-9 bg-[#1A1012] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#EDEDED]">
                Forzar cierre de sesión global
              </p>
              <p className="text-[11px] text-[#8C8C8C]">
                Destruye de forma masiva el árbol de sesiones en{" "}
                <code>auth.sessions</code>. Obliga a refrescar los claims del JWT.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="shrink-0 rounded-lg bg-critique-6 px-3 py-1.5 text-xs font-semibold text-white hover:bg-critique-7"
            >
              Ejecutar
            </button>
          </div>
        </section>
      </div>

      {/* MODAL CONFIRMACIÓN */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-sm rounded-xl border-t-4 border-critique-6 bg-[#161616] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-critique-5">
              ¿Cerrar todas las sesiones?
            </h2>
            <p className="mt-2 text-sm text-[#A1A1A1]">
              Todos los usuarios de la plataforma —incluido tú— deberán volver a
              iniciar sesión. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={ejecutando}
                className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={ejecutando}
                className="rounded-lg bg-critique-6 px-4 py-2 text-sm font-semibold text-white hover:bg-critique-7 disabled:opacity-50"
              >
                {ejecutando ? "Ejecutando…" : "Sí, cerrar todo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
