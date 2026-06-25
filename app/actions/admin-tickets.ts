"use server";

import { getSuperAdminClient } from "@/lib/supabase/auth-guard";
import { ActualizarEstadoTicketSchema, CancelarTicketSchema } from "@/lib/validation/schemas";
import { notificarTicketResuelto } from "@/lib/supabase/notificaciones";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface TicketAdminRow {
  id: string;
  empresa_id: number;
  empresa_nombre: string;
  user_id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  titulo: string;
  tipo: "consulta" | "error";
  descripcion: string;
  url: string | null;
  imagen_path: string | null;
  estado: "ingresado" | "en_curso" | "finalizado" | "cancelado" | "reabierto";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

type ListarTicketsResult =
  | { ok: true; tickets: TicketAdminRow[] }
  | { ok: false; error: string };

type ActualizarEstadoResult =
  | { ok: true; ticket: TicketAdminRow }
  | { ok: false; error: string };

type EstadoAdmin = "en_curso" | "finalizado" | "reabierto";

type GetImagenUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// listarTicketsAdmin — cross-tenant con service role
// ─────────────────────────────────────────────────────────────────────────────

export async function listarTicketsAdmin(): Promise<ListarTicketsResult> {
  try {
    const { admin } = await getSuperAdminClient();

    const { data, error } = await admin
      .from("soporte_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin-tickets] listar error:", error.message);
      return { ok: false, error: "Error al procesar la solicitud" };
    }

    return { ok: true, tickets: (data ?? []) as TicketAdminRow[] };
  } catch (err) {
    console.error("[admin-tickets] listar catch:", err);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// actualizarEstadoTicket
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarEstadoTicket(
  id: string,
  estado: EstadoAdmin
): Promise<ActualizarEstadoResult> {
  const parsed = ActualizarEstadoTicketSchema.safeParse({ id, estado });
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" };
  }

  try {
    const { uid, admin } = await getSuperAdminClient();

    const ahora = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      estado,
      updated_at: ahora,
    };
    if (estado === "finalizado") {
      updatePayload.resolved_at = ahora;
      updatePayload.resolved_by = uid;
    } else if (estado === "reabierto") {
      // Al reabrir se limpia la resolución previa
      updatePayload.resolved_at = null;
      updatePayload.resolved_by = null;
    }

    const { data, error } = await admin
      .from("soporte_tickets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[admin-tickets] actualizar error:", error?.message);
      return { ok: false, error: "Error al procesar la solicitud" };
    }

    // Log directo (el cliente admin no lleva JWT de sesión, no podemos usar log_usuario_accion RPC)
    await admin.from("logs_sistema").insert({
      empresa_id: (data as TicketAdminRow).empresa_id,
      user_id: uid,
      accion: "UPDATE_ESTADO_TICKET_SOPORTE",
      tabla: "soporte_tickets",
      registro_id: id,
      datos_new: { estado, ticket_id: id },
    });

    // Enviar email de cierre si se marca como finalizado
    if (estado === "finalizado") {
      await notificarTicketResuelto(data as TicketAdminRow);
    }

    return { ok: true, ticket: data as TicketAdminRow };
  } catch (err) {
    console.error("[admin-tickets] actualizar catch:", err);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getTicketImagenUrl — signed URL 60s para el bucket privado
// ─────────────────────────────────────────────────────────────────────────────

export async function getTicketImagenUrl(path: string): Promise<GetImagenUrlResult> {
  const parsed = CancelarTicketSchema.safeParse({ id: path });
  // El path puede tener slashes — validamos longitud mínima manualmente
  if (!path || path.length < 5 || path.length > 500) {
    return { ok: false, error: "Path inválido" };
  }

  try {
    const { admin } = await getSuperAdminClient();
    const { data, error } = await admin.storage
      .from("soporte-tickets")
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      console.error("[admin-tickets] signed url error:", error?.message);
      return { ok: false, error: "Error al obtener imagen" };
    }

    return { ok: true, url: data.signedUrl };
  } catch (err) {
    console.error("[admin-tickets] signed url catch:", err);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
}
