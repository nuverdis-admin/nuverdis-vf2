import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth-guard";
import { getProyectoByRef, getCurrentEmpresa } from "@/lib/proyecto/data";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracionView } from "./ConfiguracionView";

interface OverviewStats {
  total: number;
  sin_asignar: number;
  asignada: number;
  en_revision: number;
  completada: number;
  retornada: number;
  no_aplica: number;
}

export default async function ConfiguracionPage({
  params,
}: {
  params: { ref: string };
}) {
  // Solo administradores acceden a esta página
  await requireAdmin();

  const [empresa, proyecto] = await Promise.all([
    getCurrentEmpresa(),
    getProyectoByRef(params.ref),
  ]);

  if (!proyecto) notFound();

  const supabase = await createClient();
  const pid = parseInt(proyecto.proyecto_id, 10);

  const [{ data: statsGri }, { data: statsNcg }] = await Promise.all([
    supabase.rpc("overview_proyecto", { p_proyecto_id: pid, p_tipo_reporte: "GRI" }),
    supabase.rpc("overview_proyecto", { p_proyecto_id: pid, p_tipo_reporte: "NCG" }),
  ]);

  function incompletas(s: OverviewStats | null) {
    if (!s) return 0;
    return s.sin_asignar + s.asignada + s.en_revision + s.retornada;
  }

  const tareasIncompletas =
    incompletas((statsGri as OverviewStats) ?? null) +
    incompletas((statsNcg as OverviewStats) ?? null);

  return (
    <ConfiguracionView
      proyecto={proyecto}
      empresaRef={empresa?.ref ?? ""}
      tareasIncompletas={tareasIncompletas}
    />
  );
}
