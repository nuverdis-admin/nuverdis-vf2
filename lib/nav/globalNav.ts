import { Box, BookUser, BriefcaseBusiness, type LucideIcon } from "lucide-react";

export interface GlobalNavItem {
  slug: "proyectos" | "usuarios" | "mi-empresa";
  label: string;
  icon: LucideIcon;
  buildHref: (empresaRef: string) => string;
  soloAdmin?: boolean;
  matchPrefix?: string;
}

export const GLOBAL_NAV: GlobalNavItem[] = [
  {
    slug: "proyectos",
    label: "Proyectos",
    icon: Box,
    buildHref: (ref) => `/dashboard/org/${ref}`,
    matchPrefix: "/dashboard/proyecto/",
  },
  {
    slug: "usuarios",
    label: "Usuarios",
    icon: BookUser,
    buildHref: (ref) => `/dashboard/org/${ref}/usuarios`,
    soloAdmin: true,
  },
  {
    slug: "mi-empresa",
    label: "Mi empresa",
    icon: BriefcaseBusiness,
    buildHref: (ref) => `/dashboard/org/${ref}/mi-empresa`,
    soloAdmin: true,
  },
];