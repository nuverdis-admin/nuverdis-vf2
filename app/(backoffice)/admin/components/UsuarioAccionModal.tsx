"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  cambiarRolUsuario,
  moverUsuarioEmpresa,
} from "@/app/actions/admin-comando";
import type { UsuarioGlobalRow } from "@/app/actions/admin-usuarios";
import type { EmpresaRow } from "@/app/actions/admin-empresas";

// Modal de comando de usuario — cambiar rol y/o mover de empresa (tema oscuro).
// Borde azul (edición). Backdrop inerte.

const ROLES = ["administrador", "encargado", "revisor"] as const;
const INPUT =
  "w-full rounded-lg border border-[#2A2A2A] bg-[#202020] px-3 py-2 text-sm text-[#EDEDED] outline-none focus:border-info-5";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#A1A1A1]">
        {label}
      </span>
      {children}
    </label>
  );
}

interface Props {
  usuario: UsuarioGlobalRow;
  empresas: EmpresaRow[];
  onClose: () => void;
  onSaved: (uid: string, cambios: Partial<UsuarioGlobalRow>) => void;
}

export function UsuarioAccionModal({
  usuario,
  empresas,
  onClose,
  onSaved,
}: Props) {
  const [rol, setRol] = useState<string>(usuario.rol ?? "");
  const [empresaId, setEmpresaId] = useState<string>(
    usuario.empresaId != null ? String(usuario.empresaId) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const rolCambia = rol !== "" && rol !== usuario.rol;
  const empresaCambia =
    empresaId !== "" && Number(empresaId) !== usuario.empresaId;

  async function handleSubmit() {
    setError(null);
    setGuardando(true);
    const cambios: Partial<UsuarioGlobalRow> = {};

    if (rolCambia) {
      const res = await cambiarRolUsuario({ uid: usuario.uid, rol });
      if (!res.ok) {
        setError(res.error);
        setGuardando(false);
        return;
      }
      cambios.rol = rol;
    }

    if (empresaCambia) {
      const res = await moverUsuarioEmpresa({
        uid: usuario.uid,
        empresa_id: Number(empresaId),
      });
      if (!res.ok) {
        setError(res.error);
        setGuardando(false);
        return;
      }
      const emp = empresas.find((e) => e.empresa_id === Number(empresaId));
      cambios.empresaId = Number(empresaId);
      cambios.empresaNombre = emp?.nombre ?? `#${empresaId}`;
    }

    setGuardando(false);
    toast.success("Usuario actualizado");
    onSaved(usuario.uid, cambios);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative w-full max-w-sm rounded-xl border-t-4 border-info-5 bg-[#161616] p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-[#EDEDED]">Gestionar usuario</h2>
        <p className="mt-1 truncate text-xs text-[#8C8C8C]">{usuario.email}</p>

        <div className="mt-5 space-y-4">
          <Campo label="Rol en su equipo">
            <select
              aria-label="Rol en su equipo"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className={INPUT}
            >
              <option value="" className="bg-[#202020]">
                — sin rol —
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r} className="bg-[#202020]">
                  {r}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Empresa">
            <select
              aria-label="Empresa"
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className={INPUT}
            >
              <option value="" className="bg-[#202020]">
                — sin empresa —
              </option>
              {empresas.map((e) => (
                <option
                  key={e.empresa_id}
                  value={e.empresa_id}
                  className="bg-[#202020]"
                >
                  {e.nombre}
                </option>
              ))}
            </select>
          </Campo>

          {error && (
            <p className="rounded-lg border border-critique-7 bg-critique-9 px-3 py-2 text-xs text-critique-3">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={guardando || (!rolCambia && !empresaCambia)}
            className="rounded-lg bg-info-5 px-4 py-2 text-sm font-semibold text-white hover:bg-info-7 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
