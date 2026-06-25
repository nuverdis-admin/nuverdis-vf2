"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth-guard";
import { z } from "zod";

const renombrarSchema = z.object({
  proyectoId: z.number().int().positive(),
  nuevoNombre: z.string().min(1).max(120),
});
const cerrarSchema = z.object({ proyectoId: z.number().int().positive() });
const eliminarSchema = z.object({
  proyectoId: z.number().int().positive(),
  nombreConfirmacion: z.string().min(1),
});

export async function renombrarProyecto(proyectoId: number, nuevoNombre: string) {
  const parsed = renombrarSchema.safeParse({ proyectoId, nuevoNombre });
  if (!parsed.success) return { error: "Datos inválidos" };

  const actor = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("proyectos")
    .update({ nombre_proyecto: parsed.data.nuevoNombre.trim() })
    .eq("proyecto_id", parsed.data.proyectoId)
    .eq("empresa_id", actor.empresaId);

  if (error) {
    console.error("[renombrarProyecto]", error);
    return { error: "Error al procesar la solicitud" };
  }

  revalidatePath("/dashboard/org", "layout");
  return { ok: true };
}

export async function cerrarProyecto(proyectoId: number) {
  const parsed = cerrarSchema.safeParse({ proyectoId });
  if (!parsed.success) return { error: "Datos inválidos" };

  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cerrar_proyecto", {
    p_proyecto_id: parsed.data.proyectoId,
  });

  if (error) {
    console.error("[cerrarProyecto]", error);
    return { error: "Error al procesar la solicitud" };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (result?.error) return { error: result.error };
  return { ok: true };
}

export async function eliminarProyecto(proyectoId: number, nombreConfirmacion: string) {
  const parsed = eliminarSchema.safeParse({ proyectoId, nombreConfirmacion });
  if (!parsed.success) return { error: "Datos inválidos", paths: [] as string[] };

  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("eliminar_proyecto", {
    p_proyecto_id: parsed.data.proyectoId,
    p_nombre_confirmacion: parsed.data.nombreConfirmacion,
  });

  if (error) {
    console.error("[eliminarProyecto]", error);
    return { error: "Error al procesar la solicitud", paths: [] as string[] };
  }

  const result = data as { ok?: boolean; error?: string; paths?: string[] } | null;
  if (result?.error) return { error: result.error, paths: [] as string[] };

  // Purgar archivos de Storage si hay evidencias
  const paths = result?.paths ?? [];
  if (paths.length > 0) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await admin.storage
      .from(process.env.NEXT_PUBLIC_EVIDENCIAS_BUCKET ?? "evidencias")
      .remove(paths);
  }

  return { ok: true, paths };
}
