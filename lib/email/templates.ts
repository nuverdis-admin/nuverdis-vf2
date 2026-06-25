// Template base de email para NuVerdis. Inline CSS únicamente, sin dependencias externas.

import { escapeHtml } from "@/lib/email/escape";

// ── Base HTML wrapper ─────────────────────────────────────────────────────────
// Todos los emails comparten: logo img, tabla 600px, fondo #f4f4f4, footer social.

function htmlBase(opts: {
  headerColor?: string; // por defecto verde #22c55e
  body: string;         // HTML interno (entre logo y footer)
  footerExtra?: string; // línea extra antes del footer social (opcional)
}): string {
  const header = opts.headerColor ?? "#22c55e";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header con color -->
        <tr>
          <td style="background:${header};padding:20px 32px;">
            <img src="https://nuverdis.com/images/iconoNV.png" alt="NuVerdis" width="140" style="display:block;" />
          </td>
        </tr>
        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px 40px 28px;">
            ${opts.body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f3f4f6;">
            ${opts.footerExtra ? `<p style="margin:0 0 12px;font-size:13px;color:#555555;">${opts.footerExtra}</p>` : ""}
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
              Este es un mensaje automático de NuVerdis · Plataforma ESG &amp; Sostenibilidad.<br/>
              Si tienes dudas contacta a <a href="mailto:soporte@nuverdis.com" style="color:#6b7280;">soporte@nuverdis.com</a>
            </p>
          </td>
        </tr>
      </table>
      <!-- Footer social -->
      <table width="600" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td align="center" style="font-size:12px;color:#888888;line-height:1.6;">
            <div style="margin-bottom:12px;">
              <a href="https://linkedin.com"><img src="https://nuverdis.com/images/linkedin.png" width="24" style="margin:0 6px;" /></a>
              <a href="https://youtube.com"><img src="https://nuverdis.com/images/youtube.png" width="24" style="margin:0 6px;" /></a>
              <a href="https://facebook.com"><img src="https://nuverdis.com/images/face.png" width="24" style="margin:0 6px;" /></a>
              <a href="https://instagram.com"><img src="https://nuverdis.com/images/insta.png" width="24" style="margin:0 6px;" /></a>
            </div>
            © NuVerdis — Plataforma ESG &amp; Sostenibilidad
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Card gris estándar ────────────────────────────────────────────────────────

function cardGris(rows: string[]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f2f4f3;border-radius:8px;margin-bottom:24px;">
    <tr><td style="padding:24px 28px;">${rows.join("")}</td></tr>
  </table>`;
}

function cardRow(label: string, value: string): string {
  return `<p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong>${label}:</strong> ${value}</p>`;
}

// ── Botón CTA ─────────────────────────────────────────────────────────────────

function btnCta(href: string, label: string, color = "#22c55e"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="border-radius:8px;background:${color};">
        <a href="${href}"
          style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

// ── templatePausaAviso ────────────────────────────────────────────────────────

export interface EmailPausaAvisoParams {
  nombreEmpresa: string;
  pausaActivadaAt: string;
  diasEnPausa: number;
  urgente: boolean;
  purgaEstimadaAt?: string;
}

export function templatePausaAviso(p: EmailPausaAvisoParams): string {
  const fechaPausa = new Date(p.pausaActivadaAt).toLocaleDateString("es-CL", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const fechaPurga = p.purgaEstimadaAt
    ? new Date(p.purgaEstimadaAt).toLocaleDateString("es-CL", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  const titulo = p.urgente
    ? "⚠️ Purga de datos inminente — acción requerida"
    : "Recordatorio: tu cuenta NuVerdis sigue en pausa";

  const alertaBg  = p.urgente ? "#fef2f2" : "#fffbeb";
  const alertaBdr = p.urgente ? "#fecaca" : "#fde68a";
  const alertaTxt = p.urgente
    ? `⚠️ Si no se reactiva la cuenta antes del <strong>${escapeHtml(fechaPurga ?? "—")}</strong>, todos los datos serán purgados de forma permanente e irrecuperable.`
    : `Recuerda que la cuenta puede permanecer en pausa un máximo de 12 meses. Pasado ese plazo, los datos serán purgados automáticamente.`;

  const body = `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(titulo)}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
      La cuenta de <strong>${escapeHtml(p.nombreEmpresa)}</strong> lleva <strong>${p.diasEnPausa} días en pausa</strong>
      desde el ${escapeHtml(fechaPausa)}.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;background:${alertaBg};border:1px solid ${alertaBdr};border-radius:6px;padding:14px 18px;">
      ${alertaTxt}
    </p>
    ${btnCta("https://app.nuverdis.com/login", "Acceder a NuVerdis")}
  `;

  return htmlBase({ headerColor: p.urgente ? "#dc2626" : "#f59e0b", body });
}

// ── templateTarea ─────────────────────────────────────────────────────────────

export interface EmailTareaParams {
  titulo: string;
  nombreTarea: string;
  proyectoNombre?: string;
  estado?: string;
  quienActuo?: string;
  mensajeExtra?: string;
  linkTarea: string;
}

export function templateTarea(p: EmailTareaParams): string {
  const rows = [
    `<p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#6b7280;">Tarea</p>`,
    `<p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(p.nombreTarea)}</p>`,
    p.proyectoNombre ? cardRow("Proyecto", escapeHtml(p.proyectoNombre)) : "",
    p.estado         ? cardRow("Estado",   escapeHtml(p.estado))         : "",
    p.quienActuo     ? cardRow("Realizado por", escapeHtml(p.quienActuo)) : "",
  ].filter(Boolean).join("");

  const extra = p.mensajeExtra
    ? `<p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:14px 18px;">${escapeHtml(p.mensajeExtra)}</p>`
    : "";

  const body = `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(p.titulo)}</h1>
    ${cardGris([rows])}
    ${extra}
    ${btnCta(p.linkTarea, "Ver tarea")}
  `;

  return htmlBase({ body });
}

// ── templateSimple ────────────────────────────────────────────────────────────
// Para notificaciones sin card de datos (perfil editado, solicitudes admin, etc.)

export function templateSimple(opts: {
  titulo: string;
  cuerpoHtml: string;        // ya escapado donde corresponda
  linkHref?: string;
  linkLabel?: string;
  headerColor?: string;
}): string {
  const body = `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(opts.titulo)}</h1>
    <div style="font-size:15px;color:#374151;line-height:1.7;margin-bottom:${opts.linkHref ? "24px" : "0"};">
      ${opts.cuerpoHtml}
    </div>
    ${opts.linkHref ? btnCta(opts.linkHref, opts.linkLabel ?? "Ver en NuVerdis") : ""}
  `;
  return htmlBase({ headerColor: opts.headerColor, body });
}

// ── templateConCard ───────────────────────────────────────────────────────────
// Para notificaciones con card de datos estructurados + cuerpo + CTA opcional.

export function templateConCard(opts: {
  titulo: string;
  cuerpoHtml?: string;
  cardRows: Array<{ label: string; value: string }>;
  cardHighlight?: { label: string; value: string; valueStyle?: string };
  linkHref?: string;
  linkLabel?: string;
  footerExtra?: string;
  headerColor?: string;
}): string {
  const highlight = opts.cardHighlight
    ? `<p style="margin:0 0 4px;font-size:13px;color:#888888;">${escapeHtml(opts.cardHighlight.label)}</p>
       <p style="margin:0 0 16px;font-size:20px;font-weight:700;letter-spacing:2px;${opts.cardHighlight.valueStyle ?? "color:#2f7d62;"}">${escapeHtml(opts.cardHighlight.value)}</p>`
    : "";

  const rows = opts.cardRows.map((r) => cardRow(r.label, escapeHtml(r.value))).join("");

  const body = `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(opts.titulo)}</h1>
    ${opts.cuerpoHtml ? `<div style="font-size:15px;color:#374151;line-height:1.7;margin-bottom:24px;">${opts.cuerpoHtml}</div>` : ""}
    ${cardGris([highlight, rows])}
    ${opts.linkHref ? btnCta(opts.linkHref, opts.linkLabel ?? "Ver en NuVerdis") : ""}
  `;
  return htmlBase({ headerColor: opts.headerColor, body, footerExtra: opts.footerExtra });
}
