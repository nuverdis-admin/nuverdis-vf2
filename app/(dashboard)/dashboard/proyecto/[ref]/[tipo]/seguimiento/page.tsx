import { notFound } from "next/navigation";
import { TareasTable } from "@/components/reportes/TareasTable";
import { getProyectoByRef } from "@/lib/proyecto/data";
import { getReporteConfig } from "@/lib/reportes";
import { createClient } from "@/lib/supabase/server";

export default async function TareasPage({
  params,
}: {
  params: { ref: string; tipo: string };
}) {
  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  const config = getReporteConfig(params.tipo);
  if (!config) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const rol = (user.app_metadata as { rol?: string } | undefined)?.rol ?? "";
  const uid = user.id;

  let misEquipoIds: number[] | undefined;
  if (rol !== "administrador") {
    const { data: membresias } = await supabase
      .from("equipo_miembros")
      .select("equipo_id")
      .eq("user_id", uid);
    misEquipoIds = membresias?.map((m: { equipo_id: number }) => m.equipo_id) ?? [];
  }

  return (
    <TareasTable
      config={config}
      proyectoId={proyecto.proyecto_id}
      rol={rol}
      uid={uid}
      misEquipoIds={misEquipoIds}
    />
  );
}

