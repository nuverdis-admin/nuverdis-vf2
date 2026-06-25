import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProyectoByRef } from "@/lib/proyecto/data";
import { getReporteConfig } from "@/lib/reportes";
import DerivacionesView from "@/components/reportes/DerivacionesView";

interface Props {
  params: { ref: string; tipo: string };
}

export default async function DerivacionesPage({ params }: Props) {
  const config = getReporteConfig(params.tipo);
  if (!config) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const rol =
    (user.app_metadata as { rol?: string } | undefined)?.rol ?? "";
  if (!["administrador", "encargado", "revisor"].includes(rol)) notFound();

  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  return (
    <DerivacionesView
      proyectoId={proyecto.proyecto_id}
      rol={rol}
      uid={user.id}
      config={config}
    />
  );
}
