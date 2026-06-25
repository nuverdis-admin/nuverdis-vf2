import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/auth-guard";
import { getDetalleEmpresa } from "@/app/actions/admin-empresas";
import { EmpresaDetallePanel } from "../../components/EmpresaDetallePanel";

export const metadata = {
  title: "Detalle Empresa · God Mode",
  robots: { index: false, follow: false },
};

export default async function EmpresaDetallePage({
  params,
}: {
  params: { ref: string };
}) {
  try {
    await requireSuperadmin();
  } catch {
    notFound();
  }

  const res = await getDetalleEmpresa(params.ref);
  if (!res.ok) notFound();

  return <EmpresaDetallePanel empresa={res.empresa} />;
}
