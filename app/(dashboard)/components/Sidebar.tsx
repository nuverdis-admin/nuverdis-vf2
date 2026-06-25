"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { GLOBAL_NAV } from "@/lib/nav/globalNav";

export function Sidebar() {
  const pathname = usePathname();
  const appConfig = useAuthStore((s) => s.appConfig);
  const rol = useAuthStore((s) => s.usuarioActual?.rol ?? "");
  const empresaRef = appConfig?.empresa?.ref ?? "";

  const navItems = GLOBAL_NAV.filter((item) => !item.soloAdmin || rol === "administrador");

  function isActive(href: string, matchPrefix?: string) {
    return pathname === href || (!!matchPrefix && pathname.startsWith(matchPrefix));
  }

  function linkClass(href: string, matchPrefix?: string) {
    const active = isActive(href, matchPrefix);
    return `flex h-12 shrink-0 items-center rounded-md px-3 transition-colors ${
      active ? "bg-primary-3 text-primary-7" : "text-gray-9 hover:bg-primary-2"
    }`;
  }

  return (
    <aside className="group absolute inset-y-0 left-0 z-40 hidden w-16 flex-col overflow-hidden border-r border-primary-5 bg-primary-1 transition-[width] duration-300 ease-in-out hover:w-64 md:flex">
      <nav className="flex flex-1 flex-col gap-2 px-2 py-6">
        {navItems.map((item) => {
          const href = item.buildHref(empresaRef);
          const Icon = item.icon; // Extraemos el componente
          
          return (
            <Link key={item.slug} href={href} className={linkClass(href, item.matchPrefix)}>
              <Icon className="h-5 w-5 shrink-0" /> {/* Más limpio que el <svg> manual */}
              <span className="ml-4 whitespace-nowrap font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
