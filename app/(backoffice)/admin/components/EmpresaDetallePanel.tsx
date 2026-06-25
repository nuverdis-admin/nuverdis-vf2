"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Users,
  FolderOpen,
  ShieldAlert,
  Play,
  Pause,
  Pencil,
  CheckCircle2,
  Archive,
  XCircle,
  Trash2,
} from "lucide-react";
import {
  activarPausaEmpresa,
  reactivarPausaEmpresa,
  purgarEmpresa,
  type EmpresaDetalle,
  type UsuarioEmpresaRow,
  type ProyectoEmpresaRow,
} from "@/app/actions/admin-empresas";
import { suprimirUsuario } from "@/app/actions/admin-usuarios";

const ROL_STYLE: Record<string, string> = {
  administrador: "bg-primary-8 text-primary-2",
  encargado: "bg-info-8 text-info-2",
  revisor: "bg-[#2A2A2A] text-[#A1A1A1]",
};

const PLAN_STYLE: Record<string, string> = {
  starter: "bg-[#2A2A2A] text-[#A1A1A1]",
  pro: "bg-info-7 text-info-1",
  enterprise: "bg-primary-7 text-primary-1",
};

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Hoy";
  if (d === 1) return "Ayer";
  if (d < 30) return `Hace ${d} días`;
  if (d < 365) return `Hace ${Math.floor(d / 30)} meses`;
  return `Hace ${Math.floor(d / 365)} años`;
}

function estadoProyecto(p: ProyectoEmpresaRow) {
  if (p.archivado_at) return { label: "Archivado", color: "text-warning-4", Icon: Archive };
  if (p.estado === "cerrado") return { label: "Cerrado", color: "text-[#707070]", Icon: XCircle };
  return { label: "Activo", color: "text-primary-4", Icon: CheckCircle2 };
}

type Seccion = "info" | "usuarios" | "proyectos" | "ciclo";

export function EmpresaDetallePanel({ empresa: inicial }: { empresa: EmpresaDetalle }) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<EmpresaDetalle>(inicial);
  const [seccion, setSeccion] = useState<Seccion>("info");
  const [pausando, setPausando] = useState(false);
  const [modalPurga, setModalPurga] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [purgando, setPurgando] = useState(false);
  const [modalSuprimir, setModalSuprimir] = useState<UsuarioEmpresaRow | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [suprimiendo, setSuprimiendo] = useState(false);

  async function handleSuprimir() {
    if (!modalSuprimir) return;
    setSuprimiendo(true);
    const res = await suprimirUsuario({ uid: modalSuprimir.uid });
    setSuprimiendo(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Usuario suprimido correctamente");
    setModalSuprimir(null);
    setConfirmEmail("");
    // Actualizar lista local: marcar como anonimizado
    setEmpresa((prev) => ({
      ...prev,
      usuarios: prev.usuarios.map((u) =>
        u.uid === modalSuprimir.uid
          ? { ...u, nombre_completo: "[ANONIMIZADO]", email: "[ANONIMIZADO]", activo: false }
          : u
      ),
    }));
  }

  async function handleTogglePausa() {
    setPausando(true);
    const enPausa = !!empresa.pausa_activada_at;
    const res = enPausa
      ? await reactivarPausaEmpresa(empresa.empresa_id)
      : await activarPausaEmpresa(empresa.empresa_id);
    setPausando(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(res.mensaje);
    setEmpresa((prev) => ({
      ...prev,
      activa: enPausa ? true : false,
      pausa_activada_at: enPausa ? null : new Date().toISOString(),
    }));
  }

  const NAV: { id: Seccion; label: string; Icon: React.ElementType; count?: number }[] = [
    { id: "info", label: "Información", Icon: Building2 },
    { id: "usuarios", label: "Usuarios", Icon: Users, count: empresa.total_usuarios },
    { id: "proyectos", label: "Proyectos", Icon: FolderOpen, count: empresa.total_proyectos },
    { id: "ciclo", label: "Ciclo de vida", Icon: ShieldAlert },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#1F1F1F] bg-[#0F0F0F] px-6 py-4">
        <Link
          href="/admin/empresas"
          className="flex items-center gap-1.5 text-xs text-[#707070] transition-colors hover:text-[#EDEDED]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Empresas
        </Link>
        <span className="text-[#2A2A2A]">/</span>
        <span className="flex items-center gap-2 text-sm font-semibold text-[#EDEDED]">
          {empresa.icono ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.icono} alt="" className="h-5 w-5 rounded object-contain" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#2A2A2A] text-[9px] font-bold text-[#707070]">
              {empresa.nombre.charAt(0).toUpperCase()}
            </span>
          )}
          {empresa.nombre}
        </span>
        <span
          className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            PLAN_STYLE[empresa.plan] ?? "bg-[#2A2A2A] text-[#A1A1A1]"
          }`}
        >
          {empresa.plan}
        </span>
        {empresa.pausa_activada_at && (
          <span className="rounded-full bg-warning-8 px-2 py-0.5 text-[11px] font-semibold text-warning-3">
            En pausa
          </span>
        )}
        {!empresa.activa && !empresa.pausa_activada_at && (
          <span className="rounded-full bg-[#2A2A2A] px-2 py-0.5 text-[11px] font-semibold text-[#707070]">
            Inactiva
          </span>
        )}
      </div>

      {/* Tabs nav */}
      <div className="flex shrink-0 gap-1 border-b border-[#1F1F1F] bg-[#0A0A0A] px-6">
        {NAV.map(({ id, label, Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSeccion(id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              seccion === id
                ? "border-primary-4 text-[#EDEDED]"
                : "border-transparent text-[#707070] hover:text-[#A1A1A1]"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
            {count !== undefined && (
              <span className="rounded-full bg-[#2A2A2A] px-1.5 py-0.5 text-[10px] font-bold text-[#8C8C8C]">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">

        {/* ── INFO ── */}
        {seccion === "info" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoCard label="ID interno" valor={String(empresa.empresa_id)} />
            <InfoCard label="Ref / slug" valor={empresa.ref} mono />
            <InfoCard label="Dominio" valor={empresa.dominio_short} mono />
            <InfoCard label="Plan" valor={empresa.plan} />
            <InfoCard label="Activa" valor={empresa.activa ? "Sí" : "No"} />
            <InfoCard
              label="Pausa activada"
              valor={empresa.pausa_activada_at ? fechaCorta(empresa.pausa_activada_at) : "—"}
            />
            <InfoCard
              label="Membresía vence"
              valor={empresa.membresia_vence_at ? fechaCorta(empresa.membresia_vence_at) : "—"}
            />
            <InfoCard label="Creada" valor={fechaCorta(empresa.created_at)} />
            <InfoCard label="Actualizada" valor={fechaCorta(empresa.updated_at)} />
            <InfoCard label="Total usuarios activos" valor={String(empresa.total_usuarios)} />
            <InfoCard label="Total proyectos" valor={String(empresa.total_proyectos)} />
          </div>
        )}

        {/* ── USUARIOS ── */}
        {seccion === "usuarios" && (
          <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#161616] text-left text-xs text-[#707070]">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Último acceso</th>
                  <th className="px-4 py-3 font-semibold">Creado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresa.usuarios.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-[#707070]" colSpan={6}>
                      Sin usuarios registrados.
                    </td>
                  </tr>
                ) : (
                  empresa.usuarios.map((u) => (
                    <UsuarioRow
                      key={u.uid}
                      u={u}
                      onSuprimir={() => { setConfirmEmail(""); setModalSuprimir(u); }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PROYECTOS ── */}
        {seccion === "proyectos" && (
          <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#161616] text-left text-xs text-[#707070]">
                  <th className="px-4 py-3 font-semibold">Proyecto</th>
                  <th className="px-4 py-3 font-semibold">Año</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Cerrado</th>
                  <th className="px-4 py-3 font-semibold">Creado</th>
                </tr>
              </thead>
              <tbody>
                {empresa.proyectos.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-[#707070]" colSpan={5}>
                      Sin proyectos registrados.
                    </td>
                  </tr>
                ) : (
                  empresa.proyectos.map((p) => {
                    const est = estadoProyecto(p);
                    const EstIcon = est.Icon;
                    return (
                      <tr
                        key={p.proyecto_id}
                        className="border-b border-[#1F1F1F] bg-[#0F0F0F] transition-colors hover:bg-[#161616]"
                      >
                        <td className="px-4 py-3 font-medium text-[#EDEDED]">
                          {p.nombre_proyecto}
                          <span className="ml-2 font-mono text-[11px] text-[#707070]">
                            {p.ref}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#8C8C8C]">{p.anio_reporte}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs font-medium ${est.color}`}>
                            <EstIcon className="h-3.5 w-3.5" strokeWidth={2} />
                            {est.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#707070]">{fechaCorta(p.cerrado_at)}</td>
                        <td className="px-4 py-3 text-[#707070]">{fechaCorta(p.created_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── CICLO DE VIDA ── */}
        {seccion === "ciclo" && (
          <div className="max-w-xl space-y-4">

            {/* Estado actual */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
              <h3 className="mb-3 text-sm font-bold text-[#EDEDED]">Estado de la empresa</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[#0F0F0F] p-3">
                  <p className="text-[11px] text-[#707070]">Cuenta</p>
                  <p className={`mt-0.5 font-semibold ${empresa.activa ? "text-primary-4" : "text-[#707070]"}`}>
                    {empresa.activa ? "Activa" : "Inactiva"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#0F0F0F] p-3">
                  <p className="text-[11px] text-[#707070]">Modo pausa</p>
                  <p className={`mt-0.5 font-semibold ${empresa.pausa_activada_at ? "text-warning-4" : "text-[#707070]"}`}>
                    {empresa.pausa_activada_at
                      ? `Desde ${fechaCorta(empresa.pausa_activada_at)}`
                      : "No en pausa"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#0F0F0F] p-3">
                  <p className="text-[11px] text-[#707070]">Membresía vence</p>
                  <p className="mt-0.5 font-semibold text-[#A1A1A1]">
                    {empresa.membresia_vence_at ? fechaCorta(empresa.membresia_vence_at) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#0F0F0F] p-3">
                  <p className="text-[11px] text-[#707070]">Proyectos activos</p>
                  <p className="mt-0.5 font-semibold text-[#A1A1A1]">
                    {empresa.proyectos.filter((p) => p.estado !== "cerrado" && !p.archivado_at).length}
                  </p>
                </div>
              </div>
            </div>

            {/* Acción: pausa / reactivar */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
              <h3 className="mb-1 text-sm font-bold text-[#EDEDED]">
                {empresa.pausa_activada_at ? "Reactivar empresa" : "Activar modo pausa"}
              </h3>
              <p className="mb-4 text-xs text-[#707070]">
                {empresa.pausa_activada_at
                  ? "La empresa lleva en pausa desde " +
                    fechaCorta(empresa.pausa_activada_at) +
                    ". Al reactivar se desbloquea el acceso inmediatamente. La fecha de membresía no se modifica."
                  : "Bloquea el acceso de todos los usuarios del tenant. Los datos permanecen intactos. Solo ejecutar tras acuerdo con ventas (Fee de mantención)."}
              </p>
              <button
                type="button"
                disabled={pausando}
                onClick={handleTogglePausa}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  empresa.pausa_activada_at
                    ? "bg-primary-6 text-white hover:bg-primary-5"
                    : "border border-warning-6 text-warning-4 hover:bg-[#2A2218]"
                }`}
              >
                {empresa.pausa_activada_at ? (
                  <><Play className="h-4 w-4" strokeWidth={2} /> {pausando ? "Procesando…" : "Reactivar empresa"}</>
                ) : (
                  <><Pause className="h-4 w-4" strokeWidth={2} /> {pausando ? "Procesando…" : "Activar pausa"}</>
                )}
              </button>
            </div>

            {/* Acción: editar membresía */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
              <h3 className="mb-1 text-sm font-bold text-[#EDEDED]">Membresía</h3>
              <p className="mb-4 text-xs text-[#707070]">
                La fecha de vencimiento la fija el equipo de facturación. Actualmente:{" "}
                <span className="font-semibold text-[#A1A1A1]">
                  {empresa.membresia_vence_at ? fechaCorta(empresa.membresia_vence_at) : "Sin fecha"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => toast.info("Edición de membresía — próximamente")}
                className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-medium text-[#A1A1A1] transition-colors hover:bg-[#202020] hover:text-[#EDEDED]"
              >
                <Pencil className="h-4 w-4" strokeWidth={2} />
                Editar fecha de membresía
              </button>
            </div>

            {/* Danger Zone: purgar datos */}
            <div className="rounded-xl border border-critique-7 bg-[#161616] p-5">
              <h3 className="mb-1 text-sm font-bold text-critique-4">Zona de peligro</h3>
              <p className="mb-4 text-xs text-[#707070]">
                Purgar datos elimina <span className="font-semibold text-critique-4">permanentemente</span> todos los
                proyectos, tareas, respuestas, evidencias, chat y usuarios de esta empresa. Esta acción no se
                puede deshacer. Solo ejecutar al cierre definitivo de contrato.
              </p>
              <button
                type="button"
                onClick={() => { setConfirmInput(""); setModalPurga(true); }}
                className="flex items-center gap-2 rounded-lg border border-critique-6 bg-critique-9 px-4 py-2 text-sm font-semibold text-critique-4 transition-colors hover:bg-critique-8"
              >
                <ShieldAlert className="h-4 w-4" strokeWidth={2} />
                Purgar datos de la empresa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal supresión usuario */}
      {modalSuprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-critique-6 bg-[#161616] p-6">
            <Trash2 className="mb-3 h-7 w-7 text-critique-4" strokeWidth={2} />
            <h2 className="mb-1 text-base font-bold text-critique-4">Suprimir usuario</h2>
            <p className="mb-1 text-sm text-[#8C8C8C]">
              <span className="font-semibold text-[#EDEDED]">{modalSuprimir.nombre_completo}</span>
            </p>
            <p className="mb-4 text-xs text-[#707070]">
              Esta acción es <span className="font-semibold text-critique-4">irreversible</span>.
              Anonimiza nombre, email y PII en logs. Elimina de auth.users, equipos y roles.
              Escribe el email del usuario para confirmar:
            </p>
            <p className="mb-1 text-[11px] text-[#707070]">
              Email:{" "}
              <span className="font-mono text-[#A1A1A1]">{modalSuprimir.email}</span>
            </p>
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={modalSuprimir.email}
              className="mb-5 w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-[#EDEDED] placeholder-[#707070] outline-none focus:border-critique-5"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={suprimiendo}
                onClick={() => setModalSuprimir(null)}
                className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-medium text-[#A1A1A1] hover:bg-[#202020]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={suprimiendo || confirmEmail.trim() !== modalSuprimir.email}
                onClick={handleSuprimir}
                className="rounded-lg bg-critique-6 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-critique-7 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {suprimiendo ? "Suprimiendo…" : "Suprimir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación purga */}
      {modalPurga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-critique-6 bg-[#161616] p-6">
            <ShieldAlert className="mb-3 h-8 w-8 text-critique-4" strokeWidth={2} />
            <h2 className="mb-2 text-base font-bold text-critique-4">
              Purgar empresa: {empresa.nombre}
            </h2>
            <p className="mb-4 text-xs text-[#8C8C8C]">
              Esta acción es <span className="font-semibold text-critique-4">irreversible</span>. Escribe{" "}
              <span className="rounded bg-[#2A2A2A] px-1 font-mono text-[#EDEDED]">
                {empresa.ref}
              </span>{" "}
              para confirmar.
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={empresa.ref}
              className="mb-5 w-full rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] px-3 py-2 text-sm text-[#EDEDED] placeholder-[#707070] outline-none focus:border-critique-5"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalPurga(false)}
                className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-medium text-[#A1A1A1] hover:bg-[#202020]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmInput.trim() !== empresa.ref || purgando}
                onClick={async () => {
                  setPurgando(true);
                  const res = await purgarEmpresa(empresa.empresa_id);
                  setPurgando(false);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  const hayAdvertencias = res.storage_errors > 0 || res.auth_errors.length > 0;
                  const storageMsg =
                    res.storage_errors > 0
                      ? `${res.storage_files} archivos borrados, ${res.storage_errors} fallaron (el cron los limpiará).`
                      : `${res.storage_files} archivos borrados.`;
                  const authMsg =
                    res.auth_errors.length > 0
                      ? ` ⚠️ ${res.auth_errors.length} auth.users requieren limpieza manual en Supabase.`
                      : "";
                  if (hayAdvertencias) {
                    toast.warning(
                      `Empresa purgada con advertencias. ${res.uids_eliminados} usuarios eliminados. ${storageMsg}${authMsg}`
                    );
                  } else {
                    toast.success(
                      `Empresa purgada. ${res.uids_eliminados} usuarios eliminados, ${storageMsg}`
                    );
                  }
                  setModalPurga(false);
                  setEmpresa((prev) => ({
                    ...prev,
                    activa: false,
                    nombre: "[PURGADA] " + prev.nombre,
                    usuarios: [],
                    proyectos: [],
                    total_usuarios: 0,
                    total_proyectos: 0,
                  }));
                  router.refresh();
                }}
                className="rounded-lg bg-critique-6 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-critique-7 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {purgando ? "Purgando…" : "Purgar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, valor, mono = false }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#707070]">{label}</p>
      <p className={`mt-1 text-sm font-medium text-[#EDEDED] ${mono ? "font-mono" : ""}`}>{valor}</p>
    </div>
  );
}

function UsuarioRow({ u, onSuprimir }: { u: UsuarioEmpresaRow; onSuprimir: () => void }) {
  const estaAnonimizado = u.nombre_completo === "[ANONIMIZADO]";
  return (
    <tr className="border-b border-[#1F1F1F] bg-[#0F0F0F] transition-colors hover:bg-[#161616]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A] text-[11px] font-bold text-[#8C8C8C]">
            {u.nombre_completo.charAt(0).toUpperCase()}
          </span>
          <span className={`font-medium ${estaAnonimizado ? "italic text-[#707070]" : "text-[#EDEDED]"}`}>
            {u.nombre_completo}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-[#8C8C8C]">{u.email}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            ROL_STYLE[u.rol] ?? "bg-[#2A2A2A] text-[#A1A1A1]"
          }`}
        >
          {u.rol}
        </span>
      </td>
      <td className="px-4 py-3">
        {u.activo ? (
          <span className="text-xs font-medium text-primary-4">Activo</span>
        ) : (
          <span className="text-xs font-medium text-[#707070]">Inactivo</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[#707070]">
        <span title={u.last_sign_in_at ?? ""}>{tiempoRelativo(u.last_sign_in_at)}</span>
      </td>
      <td className="px-4 py-3 text-xs text-[#707070]">{fechaCorta(u.created_at)}</td>
      <td className="px-4 py-3 text-right">
        {!estaAnonimizado && (
          <button
            type="button"
            onClick={onSuprimir}
            title="Suprimir usuario (RGPD)"
            className="flex items-center gap-1 rounded-lg border border-critique-7 px-2 py-1 text-[11px] font-semibold text-critique-5 transition-colors hover:bg-critique-9"
          >
            <Trash2 className="h-3 w-3" strokeWidth={2} />
            Suprimir
          </button>
        )}
        {estaAnonimizado && (
          <span className="text-[11px] italic text-[#707070]">Suprimido</span>
        )}
      </td>
    </tr>
  );
}
