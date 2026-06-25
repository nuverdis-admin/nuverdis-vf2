"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldAlert,
  ExternalLink,
  LogOut,
  Database,
  LifeBuoy,
} from "lucide-react";
import { logoutAction } from "@/lib/supabase/logout";

// Sidenav del backoffice — estilo oscuro Vercel/Supabase.

const NAV = [
  { href: "/admin/overview", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", Icon: Building2 },
  { href: "/admin/acciones", label: "Usuarios", Icon: Users },
  {
    href: "/admin/acciones-criticas",
    label: "Acciones críticas",
    Icon: ShieldAlert,
  },
  { href: "/admin/redis", label: "Redis · Upstash", Icon: Database },
  { href: "/admin/tickets", label: "Tickets Soporte", Icon: LifeBuoy },
];

export function BackofficeSidebar({
  email,
  rolGlobal,
}: {
  email: string;
  rolGlobal: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#1F1F1F] bg-[#0A0A0A]">
      <div className="border-b border-[#1F1F1F] px-5 py-4">
        <p className="text-base font-bold text-[#EDEDED]">NuVerdis</p>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-4">
          God Mode · CTO
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, Icon }) => {
          const activo = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activo
                  ? "bg-[#1F1F1F] text-[#EDEDED]"
                  : "text-[#8C8C8C] hover:bg-[#161616] hover:text-[#EDEDED]"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${activo ? "text-primary-4" : ""}`}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[#1F1F1F] p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#8C8C8C] transition-colors hover:bg-[#161616] hover:text-[#EDEDED]"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          Visión clientes
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-critique-7 px-3 py-2 text-xs font-semibold text-critique-5 transition-colors hover:bg-critique-6 hover:text-[#EDEDED]"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            Cerrar sesión
          </button>
        </form>

        <div className="px-1 pt-1">
          <p className="truncate text-[11px] text-[#707070]">{email}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-4">
            {rolGlobal ?? "sin rol"}
          </p>
        </div>
      </div>
    </aside>
  );
}
