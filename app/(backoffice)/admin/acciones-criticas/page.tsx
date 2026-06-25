import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/auth-guard";
import { AccionesCriticasPanel } from "../components/AccionesCriticasPanel";

// God Mode — Acciones críticas. Server Component.
// SEGURIDAD: verifica rol_global === "superadmin" → notFound() si falla.

export const metadata = {
  title: "Acciones críticas · God Mode",
  robots: { index: false, follow: false },
};

export default async function AccionesCriticasPage() {
  try {
    await requireSuperadmin();
  } catch {
    notFound();
  }
  return <AccionesCriticasPanel />;
}
