"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { templateTarea } from "@/lib/email/templates";
import {
  requireSession,
  assertEquipoEnEmpresa,
  type ActorContext,
} from "@/lib/supabase/auth-guard";
import { EnviarEmailCambioEstadoSchema } from "@/lib/validation/schemas";
import { checkRateLimitAndDedupe } from "@/lib/security/rate-limit";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function callEmailEdgeFunction(to: string[], subject: string, html: string): Promise<void> {
  if (to.length === 0) return;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enviar-notificacion-email`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, html }),
      }
    );
  } catch (err) {
    console.error("[notificaciones-email] edge function error:", err);
  }
}

async function getEmails(userIds: string[]): Promise<string[]> {
  const admin = getAdmin();
  const emails: string[] = [];
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  );
}

interface RolRow {
  user_id: string;
  roles: { name: string } | null;
}

async function destinatariosConRol(
  equipoId: number,
  rolNombre: "encargado" | "revisor"
): Promise<string[]> {
  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", equipoId);

  const ids = ((miembros as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", ids);

  return ((rolesData as unknown as RolRow[] | null) ?? [])
    .filter((r) => r.roles?.name === rolNombre)
    .map((r) => r.user_id);
}

async function adminsEmpresa(empresaId: number): Promise<string[]> {
  const supabase = await createClient();
  // HIGH-1: filtrar por empresa. Sin este filtro la consulta devolvía
  // administradores de TODAS las empresas → fuga cross-tenant (correos a
  // admins de otros tenants).
  const { data: usuariosEmpresa } = await supabase
    .from("usuarios")
    .select("uid")
    .eq("empresa_id", empresaId);
  const uids = ((usuariosEmpresa as { uid: string }[] | null) ?? []).map(
    (u) => u.uid
  );
  if (uids.length === 0) return [];

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", uids);
  return ((rolesData as unknown as RolRow[] | null) ?? [])
    .filter((r) => r.roles?.name === "administrador")
    .map((r) => r.user_id);
}

export interface EmailCambioEstadoParams {
  equipoId: number | null;
  proyectoRef: string;
  proyectoNombre: string;
  publicId: string;
  jerarquia2Nombre: string;
  tipoReporte: string;
  nuevoEstado: "en_revision" | "completada" | "retornada";
  motivo?: string;
  quienActuo?: string;
}

export async function enviarEmailCambioEstado(
  params: EmailCambioEstadoParams
): Promise<void> {
  // HIGH-4: validar shape del input.
  if (!EnviarEmailCambioEstadoSchema.safeParse(params).success) return;
  // HIGH-1: cerrar IDOR — el equipo (si lo hay) debe pertenecer a la empresa del actor.
  let actor: ActorContext;
  try {
    actor = await requireSession();
    if (params.equipoId) {
      await assertEquipoEnEmpresa(params.equipoId, actor.empresaId);
    }
  } catch {
    return;
  }

  const actionId = `email-cambio-estado:${params.publicId}:${params.nuevoEstado}`;
  if (!(await checkRateLimitAndDedupe(actor.uid, actionId))) return;

  const tipoLower = params.tipoReporte.toLowerCase();
  const link = `${appUrl()}/dashboard/proyecto/${params.proyectoRef}/${tipoLower}/seguimiento/${params.publicId}`;

  let userIds: string[] = [];
  let titulo = "";
  let estado = "";

  if (params.nuevoEstado === "en_revision") {
    const [revisores, admins] = await Promise.all([
      params.equipoId ? destinatariosConRol(params.equipoId, "revisor") : [],
      adminsEmpresa(actor.empresaId),
    ]);
    userIds = Array.from(new Set([...revisores, ...admins]));
    titulo = "Tarea enviada a revisión";
    estado = "En revisión";
  } else if (params.nuevoEstado === "retornada") {
    const [encargados, admins] = await Promise.all([
      params.equipoId ? destinatariosConRol(params.equipoId, "encargado") : [],
      adminsEmpresa(actor.empresaId),
    ]);
    userIds = Array.from(new Set([...encargados, ...admins]));
    titulo = "Tarea retornada";
    estado = "Retornada";
  } else {
    userIds = await adminsEmpresa(actor.empresaId);
    titulo = "Tarea aprobada";
    estado = "Completada";
  }

  if (userIds.length === 0) return;

  const emails = await getEmails(userIds);
  if (emails.length === 0) return;

  const html = templateTarea({
    titulo,
    nombreTarea: params.jerarquia2Nombre,
    proyectoNombre: params.proyectoNombre,
    estado,
    quienActuo: params.quienActuo,
    mensajeExtra: params.motivo,
    linkTarea: link,
  });

  await callEmailEdgeFunction(
    emails,
    `${titulo} — ${params.proyectoNombre}`,
    html
  );
}
