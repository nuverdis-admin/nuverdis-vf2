import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth-guard";

// Server-side guard: solo administradores activos de empresa activa.
// La UI cliente puede ocultar botones, pero ESTE es el muro real:
// la página entera no se renderiza para no-admins ni usuarios inactivos.
export default async function UsuariosLayout({
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
