import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/auth-guard";
import { listarEmpresas } from "@/app/actions/admin-empresas";
import { listarUsuariosGlobal } from "@/app/actions/admin-usuarios";
import { ComandoPanel } from "../components/ComandoPanel";

// God Mode — Módulo Comando. Server Component.
// SEGURIDAD: verifica rol_global === "superadmin" → notFound() si falla.

export const metadata = {
  title: "Comando · God Mode",
  robots: { index: false, follow: false },
};

export default async function AccionesPage() {
  try {
    await requireSuperadmin();
  } catch {
    notFound();
  }

  const [empresasRes, usuariosRes] = await Promise.all([
    listarEmpresas(),
    listarUsuariosGlobal(),
  ]);

  return <ComandoPanel empresasRes={empresasRes} usuariosRes={usuariosRes} />;
}
