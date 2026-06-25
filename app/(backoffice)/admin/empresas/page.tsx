import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/auth-guard";
import { listarEmpresas } from "@/app/actions/admin-empresas";
import { EmpresasPanel } from "../components/EmpresasPanel";

export const metadata = {
  title: "Empresas · God Mode",
  robots: { index: false, follow: false },
};

export default async function EmpresasPage() {
  try {
    await requireSuperadmin();
  } catch {
    notFound();
  }

  const empresasRes = await listarEmpresas();

  return <EmpresasPanel empresasRes={empresasRes} />;
}
