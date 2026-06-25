"use client";

import { useAuthStore } from "@/lib/store/auth";

export default function MiEmpresaPage() {
  const appConfig = useAuthStore((s) => s.appConfig);
  const usuarioActual = useAuthStore((s) => s.usuarioActual);

  console.log("[MiEmpresaPage] empresa:", appConfig?.empresa.nombre);

  if (!appConfig) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-gray-5">Cargando…</span>
      </div>
    );
  }

  const isAdmin = usuarioActual?.rol === "administrador";

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-9">Mi Empresa</h1>
        <p className="mt-1 text-sm text-gray-5">
          Información de tu organización
        </p>
      </div>

      {/* Card */}
      <div className="rounded-lg border border-gray-2 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-5">
                Nombre
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-9">
                {appConfig.empresa.nombre}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-5">
                Plan
              </p>
              <p className="mt-1 text-sm font-medium text-gray-8">
                {appConfig.empresa.plan}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-5">
                Dominio
              </p>
              <p className="mt-1 text-sm font-medium text-gray-8">
                {appConfig.dominioShort}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              disabled
              className="btn btn-outline h-10 px-4 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
