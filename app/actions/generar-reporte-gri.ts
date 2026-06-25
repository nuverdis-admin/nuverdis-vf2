"use server";

import { createClient } from "@/lib/supabase/server";
import { buildGriDocx } from "@/lib/reportes/gri-docx-builder";
import type { ReporteData } from "@/lib/reportes/types-reporte";
import { GenerarReporteGriSchema } from "@/lib/validation/schemas";

export async function generarReporteGRI(
  proyectoId: number
): Promise<{ buffer: number[]; filename: string } | { error: string }> {
  // HIGH-4: validar el input antes de procesar.
  if (!GenerarReporteGriSchema.safeParse({ proyectoId }).success) {
    return { error: "Datos inválidos" };
  }
  try {
    const supabase = await createClient();

    // HIGH-5: getUser() valida firma y expiración del JWT contra GoTrue.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sin sesión activa." };

    const rol = (user.app_metadata as { rol?: string }).rol;
    if (rol !== "administrador") {
      return { error: "Solo administradores pueden generar reportes." };
    }

    const { data, error } = await supabase.rpc("get_reporte_gri_data", {
      p_proyecto_id: proyectoId,
    });

    if (error) {
      // HIGH-2: loguear el error real en servidor, mensaje genérico al cliente.
      console.error("[generar-reporte-gri] RPC error:", error);
      return { error: "Error al generar el reporte." };
    }

    // Si la base de datos interceptó un error controlado o de umbral, lo retornamos directo
    if (data && (data as any).error) return { error: (data as any).error };
    if (data && (data as any).error_umbral) return { error: (data as any).error_umbral };

    const reporteData = data as ReporteData;

    // Generar el archivo limpio (El log de auditoría ya fue escrito en el paso anterior)
    const buffer = await buildGriDocx(reporteData);
    const filename = `reporte-gri-${reporteData.empresa.ref}-${reporteData.proyecto.ref}-${reporteData.proyecto.anio_reporte}.docx`;

    return { buffer: Array.from(buffer), filename };
  } catch (err) {
    // HIGH-2: loguear el error real en servidor, mensaje genérico al cliente.
    console.error("[generar-reporte-gri]", err);
    return { error: "Error al generar el reporte." };
  }
}