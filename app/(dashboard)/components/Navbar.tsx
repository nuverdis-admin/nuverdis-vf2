"use client";

import { useAuthStore } from "@/lib/store/auth";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { useNavDrawer } from "./NavDrawerContext";
import { LifeBuoy } from "lucide-react";
import { useSoporte } from "@/components/soporte/SoporteContext";

export function Navbar() {
  const { toggle } = useNavDrawer();
  const appConfig = useAuthStore((s) => s.appConfig);
  const { open: openSoporte } = useSoporte();

  return (
    // z-50 es crucial aquí para que pase por encima del sidebar
    <nav className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-primary-5 bg-primary-1 px-4 md:px-6">
      {/* Lado Izquierdo: Hamburguesa (mobile) + Logo y Título */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menú"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-gray-9 transition-colors hover:bg-primary-2 md:hidden"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        
        <div className="flex cursor-pointer items-center gap-2">
          {/* LÓGICA DEL LOGO: Si hay icono lo muestra, si no, muestra el SVG por defecto */}
          {appConfig?.empresa?.icono ? (
            <img
              src={appConfig.empresa.icono}
              alt={`Logo de ${appConfig?.empresa?.nombre || "la empresa"}`}
              className="h-6 w-6 object-contain" 
            />
          ) : (
            <svg
              className="h-6 w-6 text-gray-9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          )}
          <span className="text-base font-bold text-gray-9">
            {appConfig?.empresa?.nombre || "NuVerdis"}
          </span>
          {/* Le quitamos el 'hidden' y el 'sm:inline' para que siempre esté visible */}
          <span className="rounded bg-black px-1.5 py-0.5 text-xs font-medium text-white">
            {appConfig?.empresa?.plan || "starter"}
          </span>
        </div>
      </div>

      {/* Lado Derecho: Soporte + Bell + UserMenu */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          type="button"
          onClick={openSoporte}
          title="Centro de soporte"
          aria-label="Abrir soporte"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-6 transition-colors hover:bg-primary-2 hover:text-primary-7"
        >
          <LifeBuoy className="h-5 w-5" strokeWidth={2} />
        </button>
        <NotificationBell />
        <UserMenu />
      </div>
    </nav>
  );
}
