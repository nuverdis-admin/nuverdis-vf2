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
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";

interface ParsedRoute {
  proyectoRef: string | null;
  colRef: string | null;
}

function parsePathname(pathname: string | null): ParsedRoute {
  if (!pathname) return { proyectoRef: null, colRef: null };
  const m = pathname.match(/^\/dashboard\/proyecto\/([^/]+)(?:\/coleccion\/([^/]+))?/);
  if (!m) return { proyectoRef: null, colRef: null };
  return { proyectoRef: m[1] ?? null, colRef: m[2] ?? null };
}

interface Coleccion {
  public_id: string;
  nombre: string;
  estandar: string;
}

function useColeccionesProyecto(proyectoRef: string | null, enabled: boolean) {
  const [colecciones, setColecciones] = useState<Coleccion[] | null>(null);
  useEffect(() => {
    if (!enabled || !proyectoRef) {
      setColecciones(null);
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
        .from("vf2_coleccion")
        .select("public_id, nombre, estandar")
        .eq("proyecto_id", proyecto.proyecto_id)
        .order("created_at", { ascending: true });
      if (cancelado) return;
      setColecciones((data ?? []) as Coleccion[]);
    })();
    return () => { cancelado = true; };
  }, [proyectoRef, enabled]);
  return colecciones;
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
        active ? "bg-primary-2 text-primary-7" : "text-gray-8 hover:bg-gray-1"
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
  const { proyectoRef, colRef } = parsePathname(pathname);

  const navItems = GLOBAL_NAV.filter(
    (item) => !item.soloAdmin || rol === "administrador"
  );

  const colecciones = useColeccionesProyecto(
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
          <SectionLabel first>General</SectionLabel>
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

          {/* 2) Proyecto — overview + colecciones vf2 */}
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

                {colecciones === null ? (
                  // Skeleton mientras carga
                  <div className="space-y-1 px-3 py-1">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-4 w-3/4 rounded bg-gray-2 animate-pulse" />
                    ))}
                  </div>
                ) : colecciones.length === 0 ? (
                  <span className="px-3 py-2 text-xs text-gray-4">
                    Sin colecciones
                  </span>
                ) : (
                  colecciones.map((col) => {
                    const href = `/dashboard/proyecto/${proyectoRef}/coleccion/${col.public_id}`;
                    const active = pathname.startsWith(href);
                    return (
                      <NavLink key={col.public_id} href={href} active={active}>
                        <span className="mr-2 text-[10px] font-bold text-gray-4 bg-gray-2 px-1 rounded">
                          {col.estandar}
                        </span>
                        <span className="truncate">{col.nombre}</span>
                      </NavLink>
                    );
                  })
                )}
              </div>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
