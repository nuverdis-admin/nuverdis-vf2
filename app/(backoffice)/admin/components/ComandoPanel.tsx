"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InquilinosTab } from "./InquilinosTab";
import { UsuariosTab } from "./UsuariosTab";
import { CrearUsuarioGlobalModal } from "./CrearUsuarioGlobalModal";
import type { EmpresasListResult } from "@/app/actions/admin-empresas";
import type { UsuariosGlobalResult } from "@/app/actions/admin-usuarios";

// God Mode — Control de Usuarios (tema oscuro).
// Sólo gestión de inquilinos (empresas) y usuarios. Las acciones críticas
// (mantenimiento, force-logout) viven en /admin/acciones-criticas.

export function ComandoPanel({
  empresasRes,
  usuariosRes,
}: {
  empresasRes: EmpresasListResult;
  usuariosRes: UsuariosGlobalResult;
}) {
  const router = useRouter();
  const empresas = empresasRes.ok ? empresasRes.empresas : [];
  const totalUsuarios = usuariosRes.ok ? usuariosRes.usuarios.length : 0;

  const [crearUsuario, setCrearUsuario] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <header className="mb-4 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-4">
          God Mode
        </p>
        <h1 className="text-xl font-bold text-[#EDEDED]">
          Centro de control de usuarios
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* INQUILINOS — 50% */}
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#2A2A2A] border-t-4 border-t-primary-5 bg-[#161616] p-4">
          <h2 className="mb-2 shrink-0 text-sm font-bold text-[#EDEDED]">
            Inquilinos · empresas
          </h2>
          <div className="min-h-0 flex-1">
            <InquilinosTab empresasRes={empresasRes} />
          </div>
        </section>

        {/* USUARIOS — 50% */}
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#2A2A2A] border-t-4 border-t-info-5 bg-[#161616] p-4">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h2 className="text-sm font-bold text-[#EDEDED]">Usuarios</h2>
            <button
              type="button"
              onClick={() => setCrearUsuario(true)}
              className="rounded-lg bg-info-5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-info-7"
            >
              + Crear usuario
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <UsuariosTab
              key={`usuarios-${totalUsuarios}`}
              usuariosRes={usuariosRes}
              empresas={empresas}
            />
          </div>
        </section>
      </div>

      {crearUsuario && (
        <CrearUsuarioGlobalModal
          empresas={empresas}
          onClose={() => setCrearUsuario(false)}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
