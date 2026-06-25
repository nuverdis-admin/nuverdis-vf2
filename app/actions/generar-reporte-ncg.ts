"use server";

import { createClient } from "@/lib/supabase/server";
import { buildNcgDocx } from "@/lib/reportes/ncg-docx-builder";
import type { NcgReporteData } from "@/lib/reportes/types-reporte";
import { GenerarReporteNcgSchema } from "@/lib/validation/schemas";

export async function generarReporteNCG(
  proyectoId: number
): Promise<{ buffer: number[]; filename: string } | { error: string }> {
  if (!GenerarReporteNcgSchema.safeParse({ proyectoId }).success) {
    return { error: "Datos inválidos" };
  }
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sin sesión activa." };

    const rol = (user.app_metadata as { rol?: string }).rol;
    if (rol !== "administrador") {
      return { error: "Solo administradores pueden generar reportes." };
    }

    const { data, error } = await supabase.rpc("get_reporte_ncg_data", {
      p_proyecto_id: proyectoId,
    });

    if (error) {
      console.error("[generar-reporte-ncg] RPC error:", error);
      return { error: "Error al generar el reporte." };
    }

    if (data && (data as { error?: string }).error) return { error: (data as { error: string }).error };
    if (data && (data as { error_umbral?: string }).error_umbral) return { error: (data as { error_umbral: string }).error_umbral };

    const reporteData = data as NcgReporteData;

    const buffer = await buildNcgDocx(reporteData);
    const filename = `reporte-ncg-${reporteData.empresa.ref}-${reporteData.proyecto.ref}-${reporteData.proyecto.anio_reporte}.docx`;

    return { buffer: Array.from(buffer), filename };
  } catch (err) {
    console.error("[generar-reporte-ncg]", err);
    return { error: "Error al generar el reporte." };
  }
}
