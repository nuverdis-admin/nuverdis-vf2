"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { logoutAction } from "@/lib/supabase/logout";
import { LifeBuoy } from "lucide-react";
import { useSoporte } from "@/components/soporte/SoporteContext";

function getIniciales(nombre?: string | null, email?: string | null): string {
  const fuente = (nombre ?? email ?? "").trim();
  if (!fuente) return "?";
  const partes = fuente.split(/[\s@.]+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function UserMenu() {
  const usuarioActual = useAuthStore((s) => s.usuarioActual);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { open: openSoporte } = useSoporte();

  const nombre = usuarioActual?.nombreCompleto ?? null;
  const email = usuarioActual?.email ?? null;
  const iniciales = getIniciales(nombre, email);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={nombre ?? email ?? "Usuario"}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-2 text-sm font-bold text-primary-7 transition-colors hover:bg-primary-3 focus:outline-none focus:ring-2 focus:ring-primary-5"
      >
        {iniciales}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gray-2 bg-white shadow-modal"
        >
          <div className="border-b border-gray-2 px-4 py-3">
            <p className="text-sm font-bold text-gray-9 truncate">
              {nombre ?? "Sin nombre"}
            </p>
            {email && (
              <p className="mt-0.5 text-xs text-gray-5 truncate">{email}</p>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); openSoporte(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-8 transition-colors hover:bg-gray-1"
          >
            <LifeBuoy className="h-4 w-4 text-gray-5" strokeWidth={2} />
            Soporte
          </button>

          <div className="border-t border-gray-2">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-critique-6 transition-colors hover:bg-critique-1 hover:text-critique-7"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
