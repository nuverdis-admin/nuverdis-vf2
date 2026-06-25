import { notFound } from "next/navigation";
import { AsignacionesView } from "@/components/reportes/AsignacionesView";
import { getProyectoByRef, getEquiposEmpresa } from "@/lib/proyecto/data";
import { getReporteConfig } from "@/lib/reportes";
import { requireAdmin } from "@/lib/supabase/auth-guard";

export default async function AsignacionesPage({
  params,
}: {
  params: { ref: string; tipo: string };
}) {
  // Guard server-side: la asignación masiva, el botón "No aplica" y el CRUD
  // de tareas son admin-only. La RLS no puede frenarlo porque la tarea
  // pertenece al equipo (no al usuario): cualquier miembro del equipo
  // podría modificar el estado vía postman/devtools si no validamos aquí.
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const proyecto = await getProyectoByRef(params.ref);
  if (!proyecto) notFound();

  const config = getReporteConfig(params.tipo);
  if (!config) notFound();

  const equipos = await getEquiposEmpresa();

  return (
    <AsignacionesView
      config={config}
      proyectoId={proyecto.proyecto_id}
      proyectoRef={proyecto.ref}
      proyectoNombre={proyecto.nombre_proyecto}
      equipos={equipos}
    />
  );
}
