// Escape de entidades HTML para interpolación segura en cuerpos de email.
// Previene HTML / template injection cuando se insertan inputs de usuario
// (nombres, títulos de tareas, motivos, etc.) en los templates de Resend.
//
// Uso: SOLO sobre el cuerpo HTML del correo. NUNCA sobre el "subject"
// (texto plano) — escaparlo mostraría entidades crudas como "&amp;".

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return "";
  return String(unsafe).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}
