import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth-guard";
import { getProyectoByRef, getCurrentEmpresa } from "@/lib/proyecto/data";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracionView } from "./ConfiguracionView";

export default async function ConfiguracionPage({
  params,
}: {
  params: { ref: string };
}) {
  await requireAdmin();

  const [empresa, proyecto] = await Promise.all([
    getCurrentEmpresa(),
    getProyectoByRef(params.ref),
  ]);

  if (!proyecto) notFound();

  const supabase = await createClient();
  const pid = parseInt(proyecto.proyecto_id, 10);

  // Usa vf2_overview_proyecto para saber si hay tareas incompletas
  const { data: statsRaw } = await supabase.rpc("vf2_overview_proyecto", {
    p_proyecto_id: pid,
  });

  const stats = statsRaw as {
    total: number;
    aprobada: number;
    borrador: number;
    en_preparacion: number;
    en_revision: number;
    en_aprobacion: number;
    devuelta: number;
  } | null;

  const tareasIncompletas = stats
    ? stats.borrador + stats.en_preparacion + stats.en_revision + stats.en_aprobacion + stats.devuelta
    : 0;

  return (
    <ConfiguracionView
      proyecto={proyecto}
      empresaRef={empresa?.ref ?? ""}
      tareasIncompletas={tareasIncompletas}
    />
  );
}
