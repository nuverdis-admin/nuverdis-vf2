import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProyectoByRef } from "@/lib/proyecto/data";
import { getEquiposTab } from "@/lib/proyecto/equipos-tab";
import { getReporteConfig } from "@/lib/reportes";
import { EquiposView } from "@/components/reportes/EquiposView";

export default async function EquiposPage({
  params,
}: {
  params: { ref: string; tipo: string };
}) {
  const config = getReporteConfig(params.tipo);
  if (!config) notFound();

  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const uid = user.id;
  const rol =
    (user.app_metadata as { rol?: string } | undefined)?.rol ?? "";
  const esAdmin = rol === "administrador";

  const proyectoId = parseInt(proyecto.proyecto_id, 10);
  const equipos = await getEquiposTab(proyectoId, uid, esAdmin, config.viewEquiposTab, config.exclusionesTable, config.miembrosExtraTable);

  return (
    <EquiposView
      equipos={equipos}
      esAdmin={esAdmin}
      proyectoRef={params.ref}
      tipo={params.tipo}
    />
  );
}
