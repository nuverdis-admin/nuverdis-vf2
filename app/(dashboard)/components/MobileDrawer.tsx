"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNavDrawer } from "./NavDrawerContext";
import { GLOBAL_NAV } from "@/lib/nav/globalNav";
import { TABS } from "@/components/reportes/TipoTabs";
import { TIPOS_REPORTE } from "@/lib/reportes";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";

interface ParsedRoute {
  proyectoRef: string | null;
  tipo: string | null;
}

function parsePathname(pathname: string | null): ParsedRoute {
  if (!pathname) return { proyectoRef: null, tipo: null };
  const m = pathname.match(/^\/dashboard\/proyecto\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return { proyectoRef: null, tipo: null };
  return { proyectoRef: m[1], tipo: m[2] ?? null };
}

function useReportesHabilitados(proyectoRef: string | null, enabled: boolean) {
  const [tipos, setTipos] = useState<string[] | null>(null);
  useEffect(() => {
    if (!enabled || !proyectoRef) {
      setTipos(null);
      return;
    }
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data: proyecto } = await supabase
        .from("proyectos")
        .select("proyecto_id")
        .eq("ref", proyectoRef)
        .maybeSingle();
      if (!proyecto || cancelado) return;
      const { data } = await supabase
        .from("proyectos_reportes")
        .select("reportes(tipo_reporte)")
        .eq("proyecto_id", proyecto.proyecto_id);
      if (cancelado) return;
      const arr =
        (data as { reportes: { tipo_reporte: string } | null }[] | null)
          ?.map((r) => r.reportes?.tipo_reporte)
          .filter((t): t is string => Boolean(t)) ?? [];
      setTipos(arr);
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoRef, enabled]);
  return tipos;
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-2 text-primary-7"
          : "text-gray-8 hover:bg-gray-1"
      }`}
    >
      {children}
    </Link>
  );
}

function SectionLabel({
  children,
  first = false,
}: {
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <p
      className={`px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-4 ${
        first ? "pt-4" : "mt-2 border-t border-gray-2 pt-4"
      }`}
    >
      {children}
    </p>
  );
}

export function MobileDrawer({ empresaRef }: { empresaRef: string }) {
  const { isOpen, close } = useNavDrawer();
  const pathname = usePathname();
  const rol = useAuthStore((s) => s.usuarioActual?.rol ?? "");
  const { proyectoRef, tipo } = parsePathname(pathname);

  const navItems = GLOBAL_NAV.filter((item) => !item.soloAdmin || rol === "administrador");
  const tabsVisibles = TABS.filter((tab) => {
    if (tab.soloAdmin) return rol === "administrador";
    if (tab.rolesPermitidos) return tab.rolesPermitidos.includes(rol);
    return true;
  });

  const tipoLower = tipo?.toLowerCase() ?? null;
  const reportesHabilitados = useReportesHabilitados(
    proyectoRef,
    isOpen && !!proyectoRef
  );

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : close())}>
      <SheetContent side="left" className="flex flex-col p-0 md:hidden">
        <SheetHeader>
          <SheetTitle>Navegación</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {/* 1) Global */}
          <SectionLabel>General</SectionLabel>
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const href = item.buildHref(empresaRef);
              const active = pathname === href;
              const Icon = item.icon;

              return (
                <NavLink key={item.slug} href={href} active={active}>
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {/* 2) Proyecto */}
          {proyectoRef && (
            <>
              <SectionLabel>Proyecto</SectionLabel>
              <div className="flex flex-col gap-1">
                <NavLink
                  href={`/dashboard/proyecto/${proyectoRef}`}
                  active={pathname === `/dashboard/proyecto/${proyectoRef}`}
                >
                  Overview
                </NavLink>
                {TIPOS_REPORTE.map((t) => {
                  const habilitado =
                    reportesHabilitados === null
                      ? false
                      : reportesHabilitados.includes(t);
                  const tLower = t.toLowerCase();
                  const href = `/dashboard/proyecto/${proyectoRef}/${tLower}/seguimiento`;
                  const active = tipoLower === tLower;
                  if (!habilitado) {
                    return (
                      <span
                        key={t}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-4"
                      >
                        {t}
                        <span className="rounded border border-gray-2 px-1 py-0.5 text-[10px] text-gray-3">
                          no habilitado
                        </span>
                      </span>
                    );
                  }
                  return (
                    <NavLink key={t} href={href} active={active}>
                      {t}
                    </NavLink>
                  );
                })}
              </div>
            </>
          )}

          {/* 3) Tabs del tipo activo */}
          {proyectoRef && tipoLower && (
            <>
              <SectionLabel>{tipoLower.toUpperCase()} · Secciones</SectionLabel>
              <div className="flex flex-col gap-1">
                {tabsVisibles.map((tab) => {
                  const href = `/dashboard/proyecto/${proyectoRef}/${tipoLower}/${tab.slug}`;
                  const active = pathname === href;
                  if (!tab.implementado) {
                    return (
                      <span
                        key={tab.slug}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-4"
                      >
                        {tab.label}
                        <span className="rounded border border-gray-2 px-1 py-0.5 text-[10px] text-gray-3">
                          pronto
                        </span>
                      </span>
                    );
                  }
                  return (
                    <NavLink key={tab.slug} href={href} active={active}>
                      {tab.label}
                    </NavLink>
                  );
                })}
              </div>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
