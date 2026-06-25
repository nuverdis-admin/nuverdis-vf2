import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TipoTabs } from "@/components/reportes/TipoTabs";
import {
  getProyectoByRef,
  getReportesHabilitados,
  getEquiposEmpresa,
} from "@/lib/proyecto/data";

export default async function TipoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { ref: string; tipo: string };
}) {
  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  const reportes = await getReportesHabilitados(proyecto.proyecto_id);
  const tipoUpper = params.tipo.toUpperCase();
  const habilitado = reportes.find((r) => r.tipo_reporte === tipoUpper);
  if (!habilitado) notFound();

  // Pre-warm cache de equipos para que las pages hijas no paguen latencia adicional.
  await getEquiposEmpresa();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rol = (user?.app_metadata as { rol?: string } | undefined)?.rol ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-primary-1 px-3 py-1 text-sm font-semibold text-primary-7 border border-primary-3">
          {tipoUpper}
        </span>
        <h2 className="text-lg font-semibold text-gray-8">Reporte {tipoUpper}</h2>
      </div>

      <TipoTabs proyectoRef={params.ref} tipo={params.tipo} rol={rol} />

      {children}
    </div>
  );
}
