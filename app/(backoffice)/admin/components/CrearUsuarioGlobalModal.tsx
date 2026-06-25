"use client";

import { useState } from "react";
import { toast } from "sonner";
import { crearUsuarioGlobal } from "@/app/actions/admin-usuarios";
import type { EmpresaRow } from "@/app/actions/admin-empresas";

// Modal de soporte — crear un usuario para CUALQUIER empresa (tema oscuro).
// Borde verde (creación). Backdrop inerte.

const ROLES = ["administrador", "encargado", "revisor"] as const;
const INPUT =
  "w-full rounded-lg border border-[#2A2A2A] bg-[#202020] px-3 py-2 text-sm text-[#EDEDED] outline-none focus:border-primary-5";

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

export function CrearUsuarioGlobalModal({
  empresas,
  onClose,
  onCreated,
}: {
  empresas: EmpresaRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [empresaId, setEmpresaId] = useState("");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<string>("encargado");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit() {
    setError(null);
    setGuardando(true);
    const res = await crearUsuarioGlobal({
      empresa_id: Number(empresaId),
      email,
      nombre_completo: nombre,
      rol,
    });
    setGuardando(false);
    if (!res.ok) return setError(res.error);
    toast.success("Usuario creado");
    onCreated();
    onClose();
  }

  const deshabilitado =
    guardando || !empresaId || !email.trim() || !nombre.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative w-full max-w-sm rounded-xl border-t-4 border-primary-5 bg-[#161616] p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-[#EDEDED]">Crear usuario</h2>
        <p className="mt-1 text-xs text-[#8C8C8C]">
          Alta de soporte — crea un usuario para cualquier empresa.
        </p>

        <div className="mt-5 space-y-4">
          <Campo label="Empresa">
            <select
              aria-label="Empresa"
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className={INPUT}
            >
              <option value="" className="bg-[#202020]">
                — selecciona empresa —
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

          <Campo label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="usuario@empresa.com"
              className={INPUT}
            />
          </Campo>

          <Campo label="Nombre completo">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={200}
              placeholder="Juan Pérez"
              className={INPUT}
            />
          </Campo>

          <Campo label="Rol">
            <select
              aria-label="Rol"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className={INPUT}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="bg-[#202020]">
                  {r}
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
            disabled={deshabilitado}
            className="rounded-lg bg-primary-5 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-6 disabled:opacity-50"
          >
            {guardando ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}
