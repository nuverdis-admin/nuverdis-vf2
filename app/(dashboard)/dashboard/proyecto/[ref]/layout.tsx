import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { ProyectoSidenav } from "@/components/reportes/ProyectoSidenav";
import { requireSession } from "@/lib/supabase/auth-guard";
import {
  getCurrentEmpresa,
  getProyectoByRef,
  getReportesHabilitados,
  getConteoTareasGRI,
  getConteoTareasNCG,
} from "@/lib/proyecto/data";

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { ref: string };
}) {
  const [empresa, proyecto] = await Promise.all([
    getCurrentEmpresa(),
    getProyectoByRef(params.ref),
  ]);

  if (!proyecto) notFound();

  // Proyecto archivado: solo admins pueden acceder
  if (proyecto.archivado_at) {
    const actor = await requireSession();
    if (actor.rol !== "administrador") {
      redirect(`/dashboard/org/${empresa?.ref ?? ""}`);
    }
  }

  const [reportes, conteoGri, conteoNcg] = await Promise.all([
    getReportesHabilitados(proyecto.proyecto_id),
    getConteoTareasGRI(proyecto.proyecto_id),
    getConteoTareasNCG(proyecto.proyecto_id),
  ]);

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] overflow-hidden md:-m-8">
      <ProyectoSidenav
        empresaRef={empresa?.ref ?? ""}
        empresaNombre={empresa?.nombre ?? "Org"}
        proyecto={proyecto}
        reportesHabilitados={reportes}
        conteos={{ GRI: conteoGri, NCG: conteoNcg }}
      />
      <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">{children}</div>
    </div>
  );
}
