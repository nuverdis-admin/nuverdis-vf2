import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth-guard";

// Server-side guard: misma política que /usuarios.
// Bloquea encargados/revisores y cualquier sesión inactiva.
export default async function MiEmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  return <>{children}</>;
}
