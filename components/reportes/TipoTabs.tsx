"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TabDef {
  slug: string;
  label: string;
  implementado: boolean;
  soloAdmin?: boolean;
  rolesPermitidos?: string[];
}

export const TABS: TabDef[] = [
  { slug: "seguimiento",  label: "Seguimiento",  implementado: true  },
  { slug: "asignaciones", label: "Asignaciones", implementado: true, soloAdmin: true },
  { slug: "derivaciones", label: "Derivaciones", implementado: true, rolesPermitidos: ["administrador", "encargado", "revisor"] },
  { slug: "cambios",      label: "Historial",    implementado: true, soloAdmin: true },
  { slug: "equipos",      label: "Equipos",      implementado: true  },
];

export function TipoTabs({
  proyectoRef,
  tipo,
  rol,
}: {
  proyectoRef: string;
  tipo: string;
  rol: string;
}) {
  const pathname = usePathname();
  const baseTipo = `/dashboard/proyecto/${proyectoRef}/${tipo.toLowerCase()}`;

  const tabsVisibles = TABS.filter((tab) => {
    if (tab.soloAdmin) return rol === "administrador";
    if (tab.rolesPermitidos) return tab.rolesPermitidos.includes(rol);
    return true;
  });

  return (
    <div className="border-b border-gray-2 -mx-4 md:mx-0">
      <div className="flex gap-0 overflow-x-auto whitespace-nowrap px-4 md:px-0">
        {tabsVisibles.map((tab) => {
          const href = `${baseTipo}/${tab.slug}`;
          const active = pathname.endsWith(`/${tab.slug}`);
          const className = `relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
            active ? "text-primary-7" : "text-gray-5 hover:text-gray-8"
          } ${!tab.implementado ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`;

          if (!tab.implementado) {
            return (
              <span key={tab.slug} aria-disabled className={className}>
                {tab.label}
                <span className="ml-1.5 rounded border border-gray-2 px-1 text-[10px] text-gray-3">
                  pronto
                </span>
              </span>
            );
          }

          const label =
            tab.slug === "equipos" && rol !== "administrador"
              ? "Mis Equipos"
              : tab.label;

          return (
            <Link key={tab.slug} href={href} prefetch className={className}>
              {label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary-5" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
