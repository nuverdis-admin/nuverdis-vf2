/** @type {import('next').NextConfig} */

// HIGH-6: headers de seguridad globales para blindar el navegador.
const isDev = process.env.NODE_ENV !== "production";
// Derivado de la env var para que cada proyecto Vercel use su propio Supabase.
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jxlkwilihblnmmhcscpd.supabase.co";
const SUPABASE_WS = SUPABASE_ORIGIN.replace("https://", "wss://");
// URL del servicio Hocuspocus en Railway (co-edición vf2_).
const COLLAB_WS = process.env.NEXT_PUBLIC_VF2_COLLAB_URL ?? "";
// Proyecto Supabase con los assets de marca (íconos, logos). Puede diferir del proyecto de datos.
const ASSETS_ORIGIN = process.env.NEXT_PUBLIC_ASSETS_STORAGE_URL ?? "";

// Content-Security-Policy.
// - 'unsafe-inline' es necesario para los scripts de hidratación de Next.js y
//   los estilos inline de Tailwind (no usamos nonce).
// - 'unsafe-eval' solo en desarrollo: React Refresh lo requiere; en producción
//   se omite para no debilitar la protección XSS.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://unpkg.com${
    isDev ? " 'unsafe-eval'" : " 'wasm-unsafe-eval'"
  }`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}${ASSETS_ORIGIN ? ` ${ASSETS_ORIGIN}` : ""}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS} https://cdn.jsdelivr.net https://unpkg.com${COLLAB_WS ? ` ${COLLAB_WS}` : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .join("; ")
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
