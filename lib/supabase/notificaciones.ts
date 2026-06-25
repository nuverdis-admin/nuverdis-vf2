"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/lib/email/escape";
import {
  templateSimple,
  templateConCard,
} from "@/lib/email/templates";
import {
  requireSession,
  assertEquipoEnEmpresa,
  assertProyectoEnEmpresa,
  assertUidEnEmpresa,
  type ActorContext,
} from "@/lib/supabase/auth-guard";
import { checkRateLimitAndDedupe } from "@/lib/security/rate-limit";
import {
  NotificarPerfilEditadoSchema,
  NotificarActualizacionTareaSchema,
  EnviarRecordatorioTareaSchema,
  NotificarTareaAsignadaSchema,
  NotificarDerivacionResueltaSchema,
  NotificarAsignacionMasivaSchema,
  NotificarNuevaSolicitudAdminSchema,
  NotificarTicketCreadoSchema,
} from "@/lib/validation/schemas";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function callEmailEdgeFunction(
  to: string[],
  subject: string,
  html: string
): Promise<void> {
  if (to.length === 0) return;
  // Usamos el service role key (admin) para llamar a la Edge Function desde el servidor.
  // Esto elimina el getSession() que causaba la rotación del refresh token mid-session,
  // rompiendo la sesión del navegador y el socket de Realtime.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enviar-notificacion-email`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, html }),
      }
    );
  } catch (err) {
    console.error("[notificaciones] email edge function error:", err);
  }
}

export async function notificarPerfilEditado(
  uid: string,
  nombreUsuario: string
): Promise<void> {
  // HIGH-4: validar shape del input antes de operar.
  if (!NotificarPerfilEditadoSchema.safeParse({ uid, nombreUsuario }).success) {
    return;
  }
  // HIGH-1: cerrar IDOR — solo se notifica a un usuario de la empresa del actor.
  try {
    const { empresaId } = await requireSession();
    await assertUidEnEmpresa(uid, empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const admin = getAdminClient();

  const { error: rpcError } = await supabase.rpc("crear_notificacion", {
    p_user_ids: [uid],
    p_tipo: "PERFIL_EDITADO",
    p_titulo: "Tu perfil fue actualizado",
    p_mensaje: "Un administrador modificó tu información",
    p_datos: null,
  });
  if (rpcError) {
    console.error("[notificarPerfilEditado] rpc error:", rpcError.message);
    return;
  }

  const { data: authUser } = await admin.auth.admin.getUserById(uid);
  const email = authUser.user?.email;
  if (!email) return;

  await callEmailEdgeFunction(
    [email],
    "Tu perfil fue actualizado — NuVerdis",
    templateSimple({
      titulo: "Tu perfil fue actualizado",
      cuerpoHtml: `Hola <strong>${escapeHtml(nombreUsuario)}</strong>, un administrador ha modificado la información de tu perfil.<br/><br/>
        <span style="color:#6b7280;font-size:14px;">Si no reconoces este cambio, contacta al administrador de tu empresa.</span>`,
    })
  );
}

export async function notificarActualizacionTarea(
  equipoId: number,
  tareaInfo: {
    jerarquia2Nombre: string;
    proyectoId: string;
    proyectoRef: string;
    tipoReporte: string;
  }
): Promise<void> {
  // HIGH-4: validar shape del input.
  if (
    !NotificarActualizacionTareaSchema.safeParse({ equipoId, tareaInfo }).success
  ) {
    return;
  }
  // HIGH-1: cerrar IDOR — equipo y proyecto deben pertenecer a la empresa del actor.
  try {
    const { empresaId } = await requireSession();
    await assertEquipoEnEmpresa(equipoId, empresaId);
    await assertProyectoEnEmpresa(tareaInfo.proyectoId, empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();

  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", equipoId);

  if (!miembros || miembros.length === 0) return;
  const userIds = miembros.map((m) => m.user_id as string);
  const tipoLower = tareaInfo.tipoReporte.toLowerCase();

  await supabase.rpc("crear_notificacion", {
    p_user_ids: userIds,
    p_tipo: "TAREA_ACTUALIZADA",
    p_titulo: "Tarea actualizada",
    p_mensaje: `Se actualizó la asignación de ${tareaInfo.jerarquia2Nombre}`,
    p_datos: {
      proyecto_id: tareaInfo.proyectoId,
      link: `/dashboard/proyecto/${tareaInfo.proyectoRef}/${tipoLower}/tareas`,
    },
  });
}


type RecordatorioResult =
  | { enviado: number }
  | { enviado: 0; razon: "rate_limited" | "sin_destinatarios" };

interface RecordatorioRolRow {
  user_id: string;
  roles: { name: string } | null;
}

export async function enviarRecordatorioTarea(params: {
  equipoId: number;
  tareaId: string | number;
  proyectoId: string | number;
  jerarquia2Nombre: string;
  estado: string;
  tipoReporte: string;
}): Promise<RecordatorioResult> {
  // HIGH-4: validar shape del input.
  if (!EnviarRecordatorioTareaSchema.safeParse(params).success) {
    return { enviado: 0, razon: "sin_destinatarios" };
  }
  // HIGH-1: cerrar IDOR — equipo y proyecto deben pertenecer a la empresa del actor.
  let recordatorioUid: string;
  try {
    const { uid, empresaId } = await requireSession();
    recordatorioUid = uid;
    await assertEquipoEnEmpresa(params.equipoId, empresaId);
    await assertProyectoEnEmpresa(params.proyectoId, empresaId);
  } catch {
    return { enviado: 0, razon: "sin_destinatarios" };
  }

  const actionId = `recordatorio:${params.tareaId}`;
  if (!(await checkRateLimitAndDedupe(recordatorioUid, actionId))) {
    return { enviado: 0, razon: "rate_limited" };
  }

  const supabase = await createClient();
  const admin = getAdminClient();

  const { data: proyecto } = await supabase
    .from("proyectos")
    .select("ref, nombre_proyecto")
    .eq("proyecto_id", params.proyectoId)
    .single();

  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", params.equipoId);

  if (!miembros || miembros.length === 0) return { enviado: 0, razon: "sin_destinatarios" };
  const memberIds = miembros.map((m) => m.user_id as string);

  const rolRequerido = ["asignada", "retornada"].includes(params.estado)
    ? "encargado"
    : "revisor";

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", memberIds);

  const userIds = ((rolesData as unknown as RecordatorioRolRow[] | null) ?? [])
    .filter((r) => r.roles?.name === rolRequerido)
    .filter((r) => r.user_id !== recordatorioUid)
    .map((r) => r.user_id);

  if (userIds.length === 0) return { enviado: 0, razon: "sin_destinatarios" };

  const tipoLower = params.tipoReporte.toLowerCase();
  const proyectoRef = proyecto?.ref ?? "";
  const proyectoNombre = (proyecto as { ref: string; nombre_proyecto: string } | null)?.nombre_proyecto ?? "";

  await supabase.rpc("crear_notificacion", {
    p_user_ids: userIds,
    p_tipo: "RECORDATORIO_TAREA",
    p_titulo: "Recordatorio de tarea",
    p_mensaje: `Tienes una tarea pendiente: ${params.jerarquia2Nombre}`,
    p_datos: {
      proyecto_id: params.proyectoId,
      link: `/dashboard/proyecto/${proyectoRef}/${tipoLower}/tareas`,
    },
  });

  await supabase.rpc("log_usuario_accion", {
    p_accion: "RECORDATORIO_TAREA_ENVIADO",
    p_tabla: "gri_tareas",
    p_registro_id: String(params.tareaId),
    p_datos_prev: null,
    p_datos_new: {
      equipo_id: params.equipoId,
      tarea: params.jerarquia2Nombre,
      rol_destino: rolRequerido,
      enviado_a: userIds.length,
    },
    p_proyecto_id: Number(params.proyectoId),
  });

  const emails: string[] = [];
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data.user?.email) emails.push(data.user.email);
  }

  if (emails.length > 0) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const link = `${appUrl}/dashboard/proyecto/${proyectoRef}/${tipoLower}/tareas`;

    await callEmailEdgeFunction(
      emails,
      `Recordatorio: ${params.jerarquia2Nombre} — ${proyectoNombre}`,
      templateSimple({
        titulo: "Recordatorio de tarea",
        cuerpoHtml: `Tienes una tarea pendiente: <strong>${escapeHtml(params.jerarquia2Nombre)}</strong> en el proyecto <strong>${escapeHtml(proyectoNombre)}</strong>.`,
        linkHref: link,
        linkLabel: "Ver tarea",
      })
    );
  }

  return { enviado: userIds.length };
}

export async function notificarTareaAsignada(
  equipoId: number,
  tareaInfo: {
    jerarquia2Nombre: string;
    proyectoId: string;
    proyectoRef: string;
    proyectoNombre: string;
    tipoReporte: string;
  }
): Promise<void> {
  // HIGH-4: validar shape del input.
  if (!NotificarTareaAsignadaSchema.safeParse({ equipoId, tareaInfo }).success) {
    return;
  }
  // HIGH-1: cerrar IDOR — equipo y proyecto deben pertenecer a la empresa del actor.
  try {
    const { empresaId } = await requireSession();
    await assertEquipoEnEmpresa(equipoId, empresaId);
    await assertProyectoEnEmpresa(tareaInfo.proyectoId, empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const admin = getAdminClient();

  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", equipoId);

  if (!miembros || miembros.length === 0) return;

  const userIds = miembros.map((m) => m.user_id as string);
  const tipoLower = tareaInfo.tipoReporte.toLowerCase();

  const { error: rpcError } = await supabase.rpc("crear_notificacion", {
    p_user_ids: userIds,
    p_tipo: "TAREA_ASIGNADA",
    p_titulo: "Nueva tarea asignada",
    p_mensaje: `Se asignó la tarea ${tareaInfo.jerarquia2Nombre} a tu equipo`,
    p_datos: {
      proyecto_id: tareaInfo.proyectoId,
      link: `/dashboard/proyecto/${tareaInfo.proyectoRef}/${tipoLower}/tareas`,
    },
  });
  if (rpcError) {
    console.error("[notificarTareaAsignada] rpc error:", rpcError.message);
    return;
  }

  const emails: string[] = [];
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data.user?.email) emails.push(data.user.email);
  }
  if (emails.length === 0) return;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const link = `${appUrl}/dashboard/proyecto/${tareaInfo.proyectoRef}/${tipoLower}/tareas`;

  await callEmailEdgeFunction(
    emails,
    `Nueva tarea asignada — ${tareaInfo.proyectoNombre}`,
    templateSimple({
      titulo: "Nueva tarea asignada",
      cuerpoHtml: `Se te asignó la tarea <strong>${escapeHtml(tareaInfo.jerarquia2Nombre)}</strong> del proyecto <strong>${escapeHtml(tareaInfo.proyectoNombre)}</strong>.`,
      linkHref: link,
      linkLabel: "Ver tarea",
    })
  );
}

export async function notificarDerivacionResuelta(params: {
  solicitanteUid: string;
  accion: "aprobada" | "rechazada";
  tipo: "derivacion" | "exclusion";
  tipoOpcion?: string;
  tareaLabel: string;
  motivoRechazo?: string;
  derivarAUid?: string | null;
}): Promise<void> {
  // HIGH-4: validar shape del input.
  if (!NotificarDerivacionResueltaSchema.safeParse(params).success) {
    return;
  }
  // HIGH-1: cerrar IDOR — solicitante (y derivado, si lo hay) deben pertenecer
  // a la empresa del actor.
  try {
    const { empresaId } = await requireSession();
    await assertUidEnEmpresa(params.solicitanteUid, empresaId);
    if (params.derivarAUid) {
      await assertUidEnEmpresa(params.derivarAUid, empresaId);
    }
  } catch {
    return;
  }

  const supabase = await createClient();
  const admin = getAdminClient();

  const esAprobada = params.accion === "aprobada";
  const tipoLabel = params.tipo === "derivacion" ? "derivación" : "exclusión";

  let mensajeSolicitante: string;
  if (params.tipo === "exclusion" && esAprobada) {
    mensajeSolicitante =
      params.tipoOpcion === "equipo"
        ? "Has sido eliminado de tu equipo."
        : `Se te excluyó de la tarea ${params.tareaLabel}.`;
  } else if (params.tipo === "derivacion" && esAprobada) {
    mensajeSolicitante = `Tu solicitud para derivar la tarea ${params.tareaLabel} fue aprobada.`;
  } else {
    mensajeSolicitante = `Tu solicitud fue rechazada. Motivo: ${params.motivoRechazo ?? "—"}`;
  }

  // PASO 1: notif in-app al solicitante (via supabase autenticado → realtime propaga)
  // NOTA: los RPCs SQL también insertan en notificaciones (SECURITY DEFINER).
  // Esos INSERTs no disparan realtime. Este RPC sí lo hace. Pendiente: remover INSERTs duplicados del SQL.
  const { error: rpcSolError } = await supabase.rpc("crear_notificacion", {
    p_user_ids: [params.solicitanteUid],
    p_tipo: esAprobada ? "DERIVACION_APROBADA" : "DERIVACION_RECHAZADA",
    p_titulo: esAprobada
      ? `Solicitud de ${tipoLabel} aprobada`
      : `Solicitud de ${tipoLabel} rechazada`,
    p_mensaje: mensajeSolicitante,
    p_datos: { tarea: params.tareaLabel },
  });
  if (rpcSolError) {
    console.error("[notificarDerivacionResuelta] rpc solicitante:", rpcSolError.message);
  }

  // PASO 2: notif in-app al derivado (solo derivacion aprobada)
  if (params.tipo === "derivacion" && esAprobada && params.derivarAUid) {
    const { error: rpcDerError } = await supabase.rpc("crear_notificacion", {
      p_user_ids: [params.derivarAUid],
      p_tipo: "DERIVACION_NUEVA_TAREA",
      p_titulo: "Se te asignó una tarea",
      p_mensaje: `Se te asignó la tarea ${params.tareaLabel} mediante derivación.`,
      p_datos: { tarea: params.tareaLabel },
    });
    if (rpcDerError) {
      console.error("[notificarDerivacionResuelta] rpc derivado:", rpcDerError.message);
    }
  }

  // PASO 3: email al solicitante
  const { data: solAuth } = await admin.auth.admin.getUserById(params.solicitanteUid);
  const solicitanteEmail = solAuth.user?.email;

  if (solicitanteEmail) {
    const subject = esAprobada
      ? `Tu solicitud de ${tipoLabel} fue aprobada`
      : `Tu solicitud de ${tipoLabel} fue rechazada`;

    const tareaLabelSafe = escapeHtml(params.tareaLabel);
    const cuerpo =
      params.tipo === "exclusion" && esAprobada
        ? params.tipoOpcion === "equipo"
          ? "Has sido eliminado de tu equipo. Has perdido acceso a todas sus tareas."
          : `Se te ha excluido de la tarea <strong>${tareaLabelSafe}</strong>. Permaneces en tu equipo.`
        : esAprobada
        ? `Tu solicitud para derivar la tarea <strong>${tareaLabelSafe}</strong> fue aprobada. Ya no tienes acceso a esta tarea.`
        : `Tu solicitud fue rechazada.<br><br><strong>Motivo:</strong> ${escapeHtml(params.motivoRechazo ?? "—")}`;

    await callEmailEdgeFunction(
      [solicitanteEmail],
      `${subject} — NuVerdis`,
      templateSimple({
        titulo: subject,
        cuerpoHtml: `<p style="margin:0;">${cuerpo}</p>`,
        headerColor: esAprobada ? "#22c55e" : "#dc2626",
      })
    );
  }

  // PASO 4: email al derivado (solo derivacion aprobada)
  if (params.tipo === "derivacion" && esAprobada && params.derivarAUid) {
    const { data: derivAuth } = await admin.auth.admin.getUserById(params.derivarAUid);
    const derivadoEmail = derivAuth.user?.email;
    if (derivadoEmail) {
      await callEmailEdgeFunction(
        [derivadoEmail],
        "Se te asignó una tarea mediante derivación — NuVerdis",
        templateSimple({
          titulo: "Nueva tarea asignada",
          cuerpoHtml: `Se te ha asignado la tarea <strong>${escapeHtml(params.tareaLabel)}</strong> mediante derivación. Ya puedes acceder a ella en tu panel.`,
        })
      );
    }
  }
}

export async function notificarAsignacionMasiva(
  equipoId: number,
  info: {
    proyectoId: string;
    proyectoRef: string;
    proyectoNombre: string;
    tipoReporte: string;
    items: Array<{ jerarquia1: string; jerarquia2: string; nombre: string }>;
  }
): Promise<void> {
  // HIGH-4: validar shape del input.
  if (!NotificarAsignacionMasivaSchema.safeParse({ equipoId, info }).success) {
    return;
  }
  // HIGH-1: cerrar IDOR — equipo y proyecto deben pertenecer a la empresa del actor.
  try {
    const { empresaId } = await requireSession();
    await assertEquipoEnEmpresa(equipoId, empresaId);
    await assertProyectoEnEmpresa(info.proyectoId, empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const admin = getAdminClient();

  const { data: miembros } = await supabase
    .from("equipo_miembros")
    .select("user_id")
    .eq("equipo_id", equipoId);

  if (!miembros || miembros.length === 0) return;

  const userIds = miembros.map((m) => m.user_id as string);
  const tipoLower = info.tipoReporte.toLowerCase();
  const link = `/dashboard/proyecto/${info.proyectoRef}/${tipoLower}/seguimiento`;

  await supabase.rpc("crear_notificacion", {
    p_user_ids: userIds,
    p_tipo: "TAREA_ASIGNADA_MASIVA",
    p_titulo: "Tareas asignadas masivamente",
    p_mensaje: "Hay tareas asignadas para tu equipo. Ve a tu panel de tareas.",
    p_datos: {
      proyecto_id: info.proyectoId,
      link,
    },
  });

  const emails: string[] = [];
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data.user?.email) emails.push(data.user.email);
  }
  if (emails.length === 0) return;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const fullLink = `${appUrl}${link}`;

  const listaItems = info.items
    .map(
      (it) =>
        `<li style="padding:2px 0;color:#374151">${escapeHtml(it.jerarquia1)}-${escapeHtml(it.jerarquia2)} ${escapeHtml(it.nombre)}</li>`
    )
    .join("");

  await callEmailEdgeFunction(
    emails,
    `Asignación masiva de tareas — ${info.proyectoNombre}`,
    templateSimple({
      titulo: "Tareas asignadas a tu equipo",
      cuerpoHtml: `
        <p style="margin:0 0 20px;">Se han asignado <strong>${info.items.length} tareas</strong> a tu equipo en el proyecto <strong>${escapeHtml(info.proyectoNombre)}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f3;border-radius:8px;margin-bottom:8px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Tareas asignadas</p>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:#374151;">${listaItems}</ul>
          </td></tr>
        </table>`,
      linkHref: fullLink,
      linkLabel: "Ver tareas del equipo",
    })
  );
}

export async function notificarNuevaSolicitudAdmin(params: {
  solicitanteUid: string;
  tareaLabel: string;
  tipo: "derivacion" | "exclusion";
}): Promise<void> {
  // HIGH-4: validar shape del input.
  if (!NotificarNuevaSolicitudAdminSchema.safeParse(params).success) {
    return;
  }
  // HIGH-1: cerrar IDOR — el solicitante debe pertenecer a la empresa del actor.
  let actor: ActorContext;
  try {
    actor = await requireSession();
    await assertUidEnEmpresa(params.solicitanteUid, actor.empresaId);
  } catch {
    return;
  }

  const supabase = await createClient();
  const adminClient = getAdminClient();

  // 1. Obtener nombre del solicitante
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre_completo")
    .eq("uid", params.solicitanteUid)
    .single();
  const solicitanteNombre = usuario?.nombre_completo ?? "Un miembro del equipo";

  // 2. Obtener a los administradores DE LA EMPRESA del solicitante.
  // HIGH-1: sin el filtro por empresa, esta consulta devolvía admins de TODAS
  // las empresas → fuga cross-tenant (correos a admins de otros tenants).
  const { data: usuariosEmpresa } = await supabase
    .from("usuarios")
    .select("uid")
    .eq("empresa_id", actor.empresaId);
  const uidsEmpresa = ((usuariosEmpresa as { uid: string }[] | null) ?? []).map(
    (u) => u.uid
  );
  if (uidsEmpresa.length === 0) return;

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, roles(name)")
    .in("user_id", uidsEmpresa);

  // INTERFAZ CORREGIDA: Supabase retorna un objeto o un array de objetos según la cardinalidad del Join
  interface AdminRolRow {
    user_id: string;
    roles: { name: string } | { name: string }[] | null;
  }

  // Mapeo seguro usando doble casteo (as unknown as ...) para limpiar la discrepancia del SDK
  const rows = (rolesData as unknown as AdminRolRow[] | null) ?? [];

  const adminIds = rows
    .filter((r) => {
      if (!r.roles) return false;
      // Si viene como array, verificamos si incluye al administrador
      if (Array.isArray(r.roles)) {
        return r.roles.some((rol) => rol.name === "administrador");
      }
      // Si viene como objeto directo
      return r.roles.name === "administrador";
    })
    .map((r) => r.user_id);

  if (adminIds.length === 0) return;

  // 3. Obtener los correos de los admins
  const emails: string[] = [];
  for (const adminId of adminIds) {
    const { data } = await adminClient.auth.admin.getUserById(adminId);
    if (data.user?.email) emails.push(data.user.email);
  }

  // 4. Enviar el correo
  if (emails.length > 0) {
    const tipoLabel = params.tipo === "derivacion" ? "derivación" : "exclusión";
    await callEmailEdgeFunction(
      emails,
      `Nueva solicitud de ${tipoLabel} — NuVerdis`,
      templateSimple({
        titulo: "Nueva solicitud pendiente",
        cuerpoHtml: `<strong>${escapeHtml(solicitanteNombre)}</strong> ha solicitado una <strong>${tipoLabel}</strong> para la tarea <strong>${escapeHtml(params.tareaLabel)}</strong>.<br/><br/>
          <span style="color:#6b7280;font-size:14px;">Ingresa al panel de administración de derivaciones para aprobar o rechazar esta solicitud.</span>`,
      })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notificarTicketCreado
// Invocado desde app/actions/soporte.ts tras crear un ticket.
// 1. Notif in-app (campana) al creador.
// 2. Email de confirmación al creador.
// 3. Email de aviso a soporte@nuverdis.com.
// ─────────────────────────────────────────────────────────────────────────────
export async function notificarTicketCreado(params: {
  uid: string;
  ticketId: string;
  titulo: string;
  tipo: "consulta" | "error";
}): Promise<void> {
  if (!NotificarTicketCreadoSchema.safeParse({ ticketId: params.ticketId, titulo: params.titulo, tipo: params.tipo }).success) {
    return;
  }

  const supabase = await createClient();
  const admin = getAdminClient();

  const tipoLabel = params.tipo === "consulta" ? "Consulta / Duda" : "Error / Bug";
  const tituloSafe = escapeHtml(params.titulo);
  const ticketIdSafe = escapeHtml(params.ticketId);

  // 1. Notif in-app al creador (dispara realtime)
  const { error: rpcError } = await supabase.rpc("crear_notificacion", {
    p_user_ids: [params.uid],
    p_tipo: "TICKET_CREADO",
    p_titulo: "Ticket de soporte recibido",
    p_mensaje: `Tu solicitud "${params.titulo}" fue ingresada con éxito. ID: ${params.ticketId}`,
    p_datos: { ticket_id: params.ticketId },
  });
  if (rpcError) {
    console.error("[notificarTicketCreado] rpc error:", rpcError.message);
  }

  // 2. Email al creador
  const { data: authUser } = await admin.auth.admin.getUserById(params.uid);
  const creadorEmail = authUser.user?.email;

  // Obtener datos enriquecidos del usuario para el email
  const { data: usuarioData } = await supabase
    .from("usuarios")
    .select("nombre_completo")
    .eq("uid", params.uid)
    .single();
  const nombreCreador = escapeHtml((usuarioData as { nombre_completo?: string } | null)?.nombre_completo ?? "");

  const htmlConfirmacion = templateConCard({
    titulo: "Ticket de soporte recibido",
    cuerpoHtml: `Hola <strong>${nombreCreador}</strong>,<br/><br/>Hemos recibido tu solicitud de soporte correctamente. Nuestro equipo la revisará a la brevedad.`,
    cardHighlight: { label: "ID del ticket", value: params.ticketId, valueStyle: "color:#2f7d62;font-weight:700;font-size:20px;letter-spacing:2px;" },
    cardRows: [
      { label: "Asunto", value: params.titulo },
      { label: "Tipo",   value: tipoLabel },
    ],
    footerExtra: `Si tienes alguna consulta adicional, puedes escribirnos a <a href="mailto:soporte@nuverdis.com" style="color:#2f7d62;">soporte@nuverdis.com</a>`,
  });

  if (creadorEmail) {
    await callEmailEdgeFunction(
      [creadorEmail],
      `Ticket ${params.ticketId} recibido — NuVerdis Soporte`,
      htmlConfirmacion
    );
  }

  // 3. Email de aviso al equipo de soporte
  // Obtener empresa del usuario para el aviso
  const { data: ticketData } = await supabase
    .from("soporte_tickets")
    .select("empresa_nombre, rol, nombre_completo")
    .eq("id", params.ticketId)
    .single();

  const htmlAviso = templateConCard({
    titulo: "Nuevo ticket de soporte",
    cardHighlight: { label: "ID", value: params.ticketId, valueStyle: "color:#2f7d62;font-weight:700;font-size:18px;letter-spacing:2px;" },
    cardRows: [
      { label: "Asunto",      value: params.titulo },
      { label: "Tipo",        value: tipoLabel },
      { label: "Empresa",     value: (ticketData as { empresa_nombre?: string } | null)?.empresa_nombre ?? "" },
      { label: "Solicitante", value: `${(ticketData as { nombre_completo?: string } | null)?.nombre_completo ?? ""} (${(ticketData as { rol?: string } | null)?.rol ?? ""})` },
    ],
    footerExtra: "Revisa el detalle completo en el panel de administración de NuVerdis.",
  });

  const empresaNombreSubject = (ticketData as { empresa_nombre?: string } | null)?.empresa_nombre ?? "cliente";
  await callEmailEdgeFunction(
    ["soporte@nuverdis.com"],
    `Nuevo ticket ${params.ticketId} — ${empresaNombreSubject} [${tipoLabel}]`,
    htmlAviso
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// notificarTicketResuelto
// Invocado desde admin-tickets.ts cuando un ticket se marca como finalizado.
// Envía email al creador del ticket informándole que su solicitud fue resuelta.
// ─────────────────────────────────────────────────────────────────────────────
export async function notificarTicketResuelto(ticket: {
  id: string;
  email: string;
  nombre_completo: string;
  titulo: string;
  tipo: "consulta" | "error";
}): Promise<void> {
  const admin = getAdminClient();

  const tipoLabel = ticket.tipo === "consulta" ? "Consulta" : "Reporte de Error";
  const nombreSafe = escapeHtml(ticket.nombre_completo);
  const tituloSafe = escapeHtml(ticket.titulo);
  const ticketIdSafe = escapeHtml(ticket.id);

  const htmlResolucion = templateConCard({
    titulo: "Tu solicitud ha sido resuelta",
    cuerpoHtml: `Hola <strong>${nombreSafe}</strong>,<br/><br/>
      Tu ${tipoLabel.toLowerCase()} "<strong>${tituloSafe}</strong>" (ID: <code>${ticketIdSafe}</code>) ha sido resuelta correctamente por nuestro equipo de soporte. Ya no requiere atención adicional.`,
    cardRows: [
      { label: "Tipo",          value: tipoLabel },
      { label: "ID del ticket", value: ticket.id },
      { label: "Estado",        value: "✓ Finalizado" },
    ],
    footerExtra: `Si tienes alguna consulta adicional, no dudes en contactarnos a <a href="mailto:soporte@nuverdis.com" style="color:#2f7d62;">soporte@nuverdis.com</a>`,
  });

  await callEmailEdgeFunction(
    [ticket.email],
    `Tu solicitud ha sido resuelta — NuVerdis Soporte`,
    htmlResolucion
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// enviarAvisosPausa
// Llamado desde el cron-proxy server action (o manualmente desde backoffice).
// Lee empresas con avisos pendientes y envía emails a los admins de cada tenant.
// Solo usa service_role — no requiere sesión activa.
// ─────────────────────────────────────────────────────────────────────────────
export async function enviarAvisosPausa(): Promise<{ ok: true; enviados: number } | { ok: false; error: string }> {
  const admin = getAdminClient();

  // Buscar empresas que necesitan aviso de 10 meses o urgente (12 meses)
  // y que aún no tienen el log correspondiente en los últimos 7 días
  const { data: empresas, error: empErr } = await admin
    .from("empresas")
    .select("empresa_id, nombre, pausa_activada_at")
    .not("pausa_activada_at", "is", null)
    .eq("activa", false)
    .not("nombre", "like", "[PURGADA]%");

  if (empErr) {
    console.error("[notificaciones] enviarAvisosPausa fetch error:", empErr);
    return { ok: false, error: "Error al obtener empresas" };
  }

  let enviados = 0;
  const ahora = Date.now();

  for (const empresa of (empresas ?? []) as { empresa_id: number; nombre: string; pausa_activada_at: string }[]) {
    const pausaMs = new Date(empresa.pausa_activada_at).getTime();
    const diasEnPausa = Math.floor((ahora - pausaMs) / 86400000);
    const mesesEnPausa = diasEnPausa / 30;

    const urgente = mesesEnPausa >= 11.5; // ~12 meses
    const aviso10 = mesesEnPausa >= 9.5 && mesesEnPausa < 11.5; // ~10 meses

    if (!urgente && !aviso10) continue;

    const accionLog = urgente ? "PAUSA_AVISO_URGENTE" : "PAUSA_AVISO_10_MESES";

    // Verificar que no se envió en los últimos 7 días
    const { data: logReciente } = await admin
      .from("logs_sistema")
      .select("log_id")
      .eq("empresa_id", empresa.empresa_id)
      .eq("accion", accionLog + "_EMAIL")
      .gte("created_at", new Date(ahora - 7 * 86400000).toISOString())
      .maybeSingle();

    if (logReciente) continue;

    // Obtener emails de administradores de la empresa desde auth.users
    const { data: usuarios } = await admin
      .from("usuarios")
      .select("uid")
      .eq("empresa_id", empresa.empresa_id)
      .eq("activo", true);

    const uids = ((usuarios ?? []) as { uid: string }[]).map((u) => u.uid);
    if (uids.length === 0) continue;

    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const adminEmails: string[] = (authUsers?.users ?? [])
      .filter((u) => {
        const meta = (u.app_metadata ?? {}) as { empresa_id?: number; rol?: string };
        return uids.includes(u.id) && meta.empresa_id === empresa.empresa_id && meta.rol === "administrador";
      })
      .map((u) => u.email ?? "")
      .filter(Boolean);

    if (adminEmails.length === 0) continue;

    const { templatePausaAviso } = await import("@/lib/email/templates");
    const html = templatePausaAviso({
      nombreEmpresa: empresa.nombre,
      pausaActivadaAt: empresa.pausa_activada_at,
      diasEnPausa,
      urgente,
      purgaEstimadaAt: urgente
        ? new Date(pausaMs + 365 * 86400000).toISOString()
        : undefined,
    });

    const subject = urgente
      ? `⚠️ Acción requerida: datos de ${empresa.nombre} serán purgados pronto`
      : `Recordatorio: cuenta ${empresa.nombre} en pausa — ${diasEnPausa} días`;

    await callEmailEdgeFunction(adminEmails, subject, html);

    // Registrar log para no reenviar en 7 días
    await admin.from("logs_sistema").insert({
      empresa_id: empresa.empresa_id,
      user_id: null,
      accion: accionLog + "_EMAIL",
      tabla: "empresas",
      registro_id: String(empresa.empresa_id),
      datos_new: { destinatarios: adminEmails.length, dias_en_pausa: diasEnPausa, urgente },
    });

    enviados++;
  }

  return { ok: true, enviados };
}
