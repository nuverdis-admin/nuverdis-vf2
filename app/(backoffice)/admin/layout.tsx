import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackofficeSidebar } from "./components/BackofficeSidebar";

export const metadata = {
  title: "NuVerdis · Backoffice",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Backoffice (God Mode) — panel interno oscuro, AISLADO de la app de clientes.
//
// Escudo 1 (este layout) — Hard-block por UID (INTERNAL_ADMIN_UIDS). No consulta
// la base de datos. Escudo 2 (rol_global === 'superadmin') lo aplican las páginas
// y los Server Actions vía requireSuperadmin() / getSuperAdminClient().
//
// Altura fija a la pantalla (h-screen + overflow-hidden): nunca hay scroll
// global; cada módulo gestiona su propio scroll interno.
// ─────────────────────────────────────────────────────────────────────────────

function uidsPermitidos(): string[] {
  return (process.env.INTERNAL_ADMIN_UIDS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();
  const permitidos = uidsPermitidos();
  if (permitidos.length === 0 || !permitidos.includes(user.id)) {
    notFound();
  }

  const rolGlobal =
    (user.app_metadata as { rol_global?: string }).rol_global ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
      <BackofficeSidebar email={user.email ?? ""} rolGlobal={rolGlobal} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
