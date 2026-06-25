// Logging informativo gateado por entorno.
//
// En producción es un no-op: evita que uid, email, app_metadata u otros datos
// personales (PII) terminen en los logs de Vercel, que se retienen y pueden
// reenviarse a terceros (Datadog, Sentry, etc.).
//
// Para errores reales usar `console.error` directamente — esos SÍ deben quedar
// registrados en el servidor (sin exponer datos sensibles ni mensajes crudos
// de Postgres al cliente).
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}
