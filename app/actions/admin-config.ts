"use server";

import { getSuperAdminClient } from "@/lib/supabase/auth-guard";

export interface PlatformConfig {
  modo_mantenimiento: boolean;
  permitir_admins: boolean;
  permitir_encargados: boolean;
  permitir_revisores: boolean;
  mensaje_mantenimiento: string;
  inicio_mantenimiento: string | null;
  fin_mantenimiento: string | null;
  banner_aviso_activo: boolean;
}

export async function getPlatformConfig(): Promise<PlatformConfig | null> {
  try {
    const { admin } = await getSuperAdminClient();
    const { data, error } = await admin
      .from("plataforma_config")
      .select("*")
      .eq("id", 1)
      .single();
      
    if (error) return null;
    return data as PlatformConfig;
  } catch {
    return null;
  }
}

export async function updatePlatformConfig(config: Partial<PlatformConfig>) {
  try {
    const { admin, uid } = await getSuperAdminClient();
    const { error } = await admin
      .from("plataforma_config")
      .update(config)
      .eq("id", 1);

    if (error) return { ok: false, error: "Error al actualizar la configuración" };
    
    await admin.from("logs_sistema").insert({
      user_id: uid,
      accion: "UPDATE_CONFIG",
      tabla: "plataforma_config",
      registro_id: "1",
      datos_new: config,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Error de comunicación en servidor" };
  }
}

// Envío globalizado consumiendo tu Edge Function existente
export async function enviarCorreoMantenimientoGlobal(): Promise<{ ok: boolean; usuarios?: number; error?: string }> {
  try {
    const { admin } = await getSuperAdminClient();
    
    // 1. Obtener la configuración actual para estructurar el mensaje
    const config = await getPlatformConfig();
    if (!config) return { ok: false, error: "No se pudo leer la configuración del sistema" };

    // 2. Extraer correos de auth.users (God Mode bypass cross-tenant)
    const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
    if (authError || !authUsers?.users) {
      return { ok: false, error: "No se pudo compilar la lista global de usuarios" };
    }

    const destinatarios = authUsers.users
      .map((u) => u.email)
      .filter((email): email is string => !!email);

    if (destinatarios.length === 0) return { ok: true, usuarios: 0 };

    // 3. Formatear la ventana de tiempo para visualización
    const formatoFecha = (iso: string | null) => 
      iso ? new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "Por confirmar";

    // Confeccionar el reporte de exclusiones
    const rolesBloqueados: string[] = [];
    if (!config.permitir_admins) rolesBloqueados.push("Administradores");
    if (!config.permitir_encargados) rolesBloqueados.push("Encargados");
    if (!config.permitir_revisores) rolesBloqueados.push("Revisores");
    if (rolesBloqueados.length === 0) rolesBloqueados.push("Ninguno (Ventana Informativa)");

    const htmlTemplate = `
      <div style="font-family: sans-serif; max-width: 550px; background-color: #ffffff; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #d97706; margin-top: 0;">Aviso de Mantenimiento Programado</h2>
        <p style="color: #374151; font-size: 14px; line-height: 1.5;">
          Estimado usuario, informamos que la plataforma <strong>NuVerdis</strong> entrará en una ventana de mantenimiento técnico para optimizaciones de infraestructura.
        </p>
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #4b5563;">
          <strong>📅 Detalles de la ventana (Horario Local):</strong><br/>
          • <strong>Inicio:</strong> ${formatoFecha(config.inicio_mantenimiento)}<br/>
          • <strong>Término estimado:</strong> ${formatoFecha(config.fin_mantenimiento)}
        </div>
        <div style="font-size: 13px; color: #374151; margin-bottom: 20px;">
          <strong>🚫 Accesos Restringidos durante la ventana:</strong><br/>
          <span style="color: #dc2626;">${rolesBloqueados.join(", ")}</span>
        </div>
        <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #f3f4f6; padding-top: 12px; margin-top: 24px;">
          Si perteneces a un rol autorizado o necesitas soporte crítico, contacta al superadministrador del sistema.
        </p>
      </div>
    `;

    // 4. Invocar tu Edge Function local o en la nube de forma directa
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enviar-notificacion-email`; // Asegura el nombre correcto de tu ruta de función
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: destinatarios,
        subject: "⚠️ Notificación de Mantenimiento - NuVerdis",
        html: htmlTemplate,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Edge Function Error: ${errText}` };
    }

    return { ok: true, usuarios: destinatarios.length };
  } catch (err) {
    return { ok: false, error: "Fallo catastrófico en el despachador de correo" };
  }
}