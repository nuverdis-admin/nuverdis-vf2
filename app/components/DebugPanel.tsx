"use client";

import { useAuthStore } from "@/lib/store/auth";

export function DebugPanel() {
  const { appConfig, usuarioActual, proyectos } = useAuthStore();

  // Solo visible en desarrollo
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-critique-9 p-4 font-mono text-xs text-white shadow-modal">
      <p className="mb-1 font-bold tracking-wider text-critique-3">APPCONFIG</p>
      <p>dominioShort: {appConfig?.dominioShort ?? "—"}</p>
      <p>empresa_id: {appConfig?.empresa.empresa_id ?? "—"}</p>
      <p>plan: {appConfig?.empresa.plan ?? "—"}</p>
      <p>isDev: {String(appConfig?.isDev ?? "—")}</p>

      <p className="mb-1 mt-3 font-bold tracking-wider text-critique-3">USUARIO</p>
      <p className="break-all">uid: {usuarioActual?.uid ?? "—"}</p>
      <p className="break-all">email: {usuarioActual?.email ?? "—"}</p>
      <p>rol: {usuarioActual?.rol ?? "—"}</p>
      <p>activo: {String(usuarioActual?.activo ?? "—")}</p>

      <p className="mb-1 mt-3 font-bold tracking-wider text-critique-3">
        PROYECTOS: {proyectos.length}
      </p>
      {proyectos.slice(0, 3).map((p) => (
        <p key={p.proyecto_id} className="text-critique-2">
          · {p.ref} ({p.anio_reporte})
        </p>
      ))}
      {proyectos.length > 3 && (
        <p className="text-critique-2">…y {proyectos.length - 3} más</p>
      )}
    </div>
  );
}
