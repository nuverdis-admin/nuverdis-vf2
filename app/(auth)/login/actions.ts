"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SendOtpSchema, VerifyOtpSchema } from "@/lib/validation/schemas";

// ── Paso 1: solicitar OTP ─────────────────────────────────────────────────────

export async function sendOtpAction(
  formData: FormData
): Promise<{ ok: true; email: string } | { error: string }> {
  const rawEmail = formData.get("email");
  const parsed = SendOtpSchema.safeParse({
    email: typeof rawEmail === "string" ? rawEmail : "",
  });
  if (!parsed.success) return { error: "Ingresa un correo electrónico válido." };

  const { email } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[sendOtpAction] error:", error);
    return {
      error:
        "No se pudo enviar el código. Verifica el correo o contacta a soporte.",
    };
  }

  return { ok: true, email };
}

// ── Paso 2: verificar OTP → redirigir al dashboard ────────────────────────────

export async function verifyOtpAction(
  formData: FormData
): Promise<{ error: string }> {
  const rawEmail = formData.get("email");
  const rawToken = formData.get("token");

  const parsed = VerifyOtpSchema.safeParse({
    email: typeof rawEmail === "string" ? rawEmail : "",
    token: typeof rawToken === "string" ? rawToken : "",
  });
  if (!parsed.success) return { error: "Código inválido." };

  const { email, token } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error || !data.session) {
    console.error("[verifyOtpAction] error:", error);
    return { error: "Código inválido o expirado. Intenta de nuevo." };
  }

  // HIGH-5: usar app_metadata del usuario validado por GoTrue — sin decodificar JWT a mano.
  const appMetadata = (data.user?.app_metadata ?? {}) as {
    empresa_id?: number;
    activo?: boolean;
    empresa_activa?: boolean;
  };

  if (!appMetadata.activo || !appMetadata.empresa_activa) {
    await supabase.auth.signOut();
    return {
      error: "Usuario inactivo. Contacta al administrador de tu empresa.",
    };
  }

  if (!appMetadata.empresa_id) {
    await supabase.auth.signOut();
    return { error: "Sin empresa asignada. Contacta a soporte." };
  }

  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("ref")
    .eq("empresa_id", appMetadata.empresa_id)
    .single();

  if (empresaError || !empresa?.ref) {
    console.error("[verifyOtpAction] empresa no encontrada:", empresaError);
    await supabase.auth.signOut();
    return { error: "Empresa no encontrada. Contacta a soporte." };
  }

  redirect(`/dashboard/org/${empresa.ref}`);
}
