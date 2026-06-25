"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireSession } from "@/lib/supabase/auth-guard";
import {
  CrearTicketSoporteSchema,
  CancelarTicketSchema,
} from "@/lib/validation/schemas";
import { notificarTicketCreado } from "@/lib/supabase/notificaciones";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface TicketRow {
  id: string;
  titulo: string;
  tipo: "consulta" | "error";
  estado: "ingresado" | "en_curso" | "finalizado" | "cancelado" | "reabierto";
  created_at: string;
}

type CrearTicketResult =
  | { ok: true; ticket: { id: string; estado: string; created_at: string } }
  | { ok: false; error: string };

type CancelarTicketResult = { ok: true } | { ok: false; error: string };

type ListarTicketsResult =
  | { ok: true; tickets: TicketRow[] }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// crearTicketSoporte
// ─────────────────────────────────────────────────────────────────────────────

export async function crearTicketSoporte(
  formData: FormData
): Promise<CrearTicketResult> {
  try {
    const { uid, empresaId } = await requireSession();

    const tipo = formData.get("tipo") as string;
    const titulo = formData.get("titulo") as string;
    const descripcion = formData.get("descripcion") as string;
    const url = formData.get("url") as string | null;
    const file = formData.get("imagen") as File | null;

    // Validación con zod
    const parsed = CrearTicketSoporteSchema.safeParse({
      tipo,
      titulo,
      descripcion,
      ...(tipo === "error" ? { url: url ?? "" } : {}),
    });
    if (!parsed.success) {
      return { ok: false, error: "Datos inválidos" };
    }

    // Subir imagen si corresponde (tipo error + archivo presente)
    let imagenPath: string | null = null;
    if (tipo === "error" && file && file.size > 0) {
      const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedMimes.includes(file.type)) {
        return { ok: false, error: "Formato de imagen no permitido (png, jpg, webp)" };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { ok: false, error: "La imagen no puede superar 5 MB" };
      }

      const ext = file.type.split("/")[1] ?? "jpg";
      const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
      const admin = getAdminClient();
      const { error: uploadError } = await admin.storage
        .from("soporte-tickets")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error("[soporte] upload imagen error:", uploadError);
        return { ok: false, error: "Error al procesar la solicitud" };
      }
      imagenPath = path;
    }

    // RPC crea el ticket + log
    const supabase = await createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "crear_ticket_soporte",
      {
        p_titulo: titulo,
        p_tipo: tipo,
        p_descripcion: descripcion,
        p_url: url ?? null,
        p_imagen_path: imagenPath,
      }
    );

    if (rpcError || !data) {
      console.error("[soporte] rpc crear_ticket_soporte error:", rpcError?.message);
      return { ok: false, error: "Error al procesar la solicitud" };
    }

    const ticket = data as { id: string; estado: string; created_at: string };

    // Notificación in-app + email (await obligatorio — regla serverless)
    await notificarTicketCreado({
      uid,
      ticketId: ticket.id,
      titulo,
      tipo: tipo as "consulta" | "error",
    });

    return { ok: true, ticket };
  } catch (err) {
    console.error("[soporte] crearTicketSoporte error:", err);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// listarMisTickets
// ─────────────────────────────────────────────────────────────────────────────

export async function listarMisTickets(): Promise<ListarTicketsResult> {
  try {
    await requireSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("soporte_tickets")
      .select("id, titulo, tipo, estado, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[soporte] listarMisTickets error:", error.message);
      return { ok: false, error: "Error al procesar la solicitud" };
    }

    return { ok: true, tickets: (data ?? []) as TicketRow[] };
  } catch (err) {
    console.error("[soporte] listarMisTickets catch:", err);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelarMiTicket
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelarMiTicket(id: string): Promise<CancelarTicketResult> {
  try {
    await requireSession();

    const parsed = CancelarTicketSchema.safeParse({ id });
    if (!parsed.success) {
      return { ok: false, error: "Datos inválidos" };
    }

    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("cancelar_ticket_soporte", {
      p_id: id,
    });

    if (rpcError) {
      console.error("[soporte] cancelarMiTicket rpc error:", rpcError.message);
      return { ok: false, error: "Error al procesar la solicitud" };
    }

    return { ok: true };
  } catch (err) {
    console.error("[soporte] cancelarMiTicket catch:", err);
    return { ok: false, error: "Error al procesar la solicitud" };
  }
}
