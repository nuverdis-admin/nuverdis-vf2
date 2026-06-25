import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProyectoByRef } from "@/lib/proyecto/data";
import { HistorialCambios } from "@/components/reportes/HistorialCambios";

export default async function CambiosPage({
  params,
}: {
  params: { ref: string; tipo: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rol = (user?.app_metadata as { rol?: string } | undefined)?.rol ?? "";
  if (rol !== "administrador") notFound();

  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  return <HistorialCambios proyectoId={proyecto.proyecto_id} tipoReporte={params.tipo} />;
}
