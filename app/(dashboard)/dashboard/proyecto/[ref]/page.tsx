import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OverviewSection } from "@/components/reportes/OverviewSection";
import { MiembroOverviewSection } from "@/components/reportes/MiembroOverviewSection";
import type { MiembroOverviewData } from "@/components/reportes/MiembroOverviewSection";
import { ReportesDescargaPanel } from "@/components/overview/ReportesDescargaPanel";
import {
  getProyectoByRef,
  getReportesHabilitados,
  getOverviewStats,
  getOverviewStatsMulti,
  getCargaEquiposMulti,
  getActividadRecienteMulti,
} from "@/lib/proyecto/data";

export default async function ProyectoOverviewPage({
  params,
}: {
  params: { ref: string };
}) {
  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const rol =
    (user.app_metadata as { rol?: string } | undefined)?.rol ?? "";

  const { data: usuarioData } = await supabase
    .from("usuarios")
    .select("nombre_completo")
    .eq("uid", user.id)
    .single();
  const nombreCompleto =
    (usuarioData as { nombre_completo?: string } | null)?.nombre_completo ??
    "Usuario";

  const reportes = await getReportesHabilitados(proyecto.proyecto_id);
  const tiposHabilitados = reportes.map((r) => r.tipo_reporte.toUpperCase());
  // fallback por si el proyecto no tiene reportes aún asignados
  const tiposInit = tiposHabilitados.length > 0 ? tiposHabilitados : ["GRI"];

  let overviewNode: React.ReactNode = null;

  if (rol === "administrador") {
    const hasGri = tiposHabilitados.includes("GRI");
    const hasNcg = tiposHabilitados.includes("NCG");

    const [
      { stats, error },
      cargaEquipos,
      actividadReciente,
      griStatsPanel,
      ncgStatsPanel,
    ] = await Promise.all([
      getOverviewStatsMulti(proyecto.proyecto_id, tiposInit),
      getCargaEquiposMulti(proyecto.proyecto_id, tiposInit),
      getActividadRecienteMulti(proyecto.proyecto_id, tiposInit),
      hasGri ? getOverviewStats(proyecto.proyecto_id, "GRI") : Promise.resolve({ stats: null, error: null }),
      hasNcg ? getOverviewStats(proyecto.proyecto_id, "NCG") : Promise.resolve({ stats: null, error: null }),
    ]);

    const totalTareas = griStatsPanel.stats?.total ?? 0;
    const tareasActivas = griStatsPanel.stats
      ? griStatsPanel.stats.total - griStatsPanel.stats.sin_asignar
      : 0;
    const totalTareasNcg = ncgStatsPanel.stats?.total ?? 0;
    const tareasActivasNcg = ncgStatsPanel.stats
      ? ncgStatsPanel.stats.total - ncgStatsPanel.stats.sin_asignar
      : 0;

    overviewNode = (
      <>
        <OverviewSection
          stats={stats}
          error={error}
          proyectoRef={params.ref}
          proyectoId={proyecto.proyecto_id}
          reportesHabilitados={tiposHabilitados}
          cargaEquipos={cargaEquipos}
          actividadReciente={actividadReciente}
        />
        <ReportesDescargaPanel
          proyectoId={Number(proyecto.proyecto_id)}
          esAdmin
          totalTareas={totalTareas}
          tareasActivas={tareasActivas}
          totalTareasNcg={totalTareasNcg}
          tareasActivasNcg={tareasActivasNcg}
        />
      </>
    );
  } else if (rol === "encargado" || rol === "revisor") {
    const { data: raw, error: miembroError } = await supabase.rpc(
      "overview_miembro_proyecto",
      { p_proyecto_id: proyecto.proyecto_id, p_tipos: tiposInit }
    );

    if (miembroError) {
      overviewNode = (
        <p className="text-sm text-critique-6">
          Error al cargar overview: {miembroError.message}
        </p>
      );
    } else {
      const miembroData = (
        Array.isArray(raw) ? raw[0] : raw
      ) as MiembroOverviewData | null;

      if (miembroData) {
        overviewNode = (
          <MiembroOverviewSection
            data={{ ...miembroData, rol: rol as "encargado" | "revisor" }}
            proyectoRef={params.ref}
            proyectoId={proyecto.proyecto_id}
            reportesHabilitados={tiposHabilitados}
          />
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-9">
          ¡Hola, {nombreCompleto}!
        </h1>
        <p className="text-gray-6 mt-1">
          Aquí tienes un resumen de{" "}
          <span className="font-semibold text-gray-8">
            {proyecto.nombre_proyecto}
          </span>
        </p>
      </div>

      {overviewNode}
    </div>
  );
}
