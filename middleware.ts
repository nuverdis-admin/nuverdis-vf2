import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cabeceras de identidad que SOLO el servidor puede emitir. Si llegan desde el
// cliente son un intento de spoofing y deben eliminarse antes de procesar.
const SPOOFABLE_HEADERS = ["x-user-id", "x-user-email", "x-tenant"] as const;

export async function middleware(request: NextRequest) {
  // ── CRIT-5: Bloqueo de upgrade WebSocket (CVE-2026-44578) ──────────────────
  // La arquitectura no usa WebSockets en el servidor Next.js. El Realtime de
  // Supabase conecta directo a wss://*.supabase.co y NO pasa por este middleware,
  // por lo que este bloqueo no lo afecta. Cualquier intento de upgrade aquí es
  // un vector de SSRF y se corta de inmediato.
  const upgradeHeader = request.headers.get("upgrade");
  const connectionHeader = request.headers.get("connection");
  if (
    upgradeHeader?.toLowerCase().includes("websocket") ||
    connectionHeader?.toLowerCase().includes("upgrade")
  ) {
    return new NextResponse("Upgrade Required", {
      status: 426,
      headers: { Connection: "close" },
    });
  }

  // Patrón canónico @supabase/ssr: supabaseResponse acumula las cookies
  // refrescadas y DEBE ser devuelto (o sus cookies copiadas) en toda rama.
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // setAll re-crea supabaseResponse con el request actualizado para que
        // las cookies refrescadas se progresen correctamente al navegador.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: No insertar lógica entre createServerClient y getUser().
  // getUser() valida el JWT contra GoTrue y refresca el token si es necesario.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // ── CRIT-1: Sanitización de cabeceras de identidad ─────────────────────────
  const requestHeaders = new Headers(request.headers);
  for (const header of SPOOFABLE_HEADERS) {
    requestHeaders.delete(header);
  }

  // ── Tenant ────────────────────────────────────────────────────────────────
  const hostname = request.headers.get("host") ?? "";
  const isDev =
    hostname === "localhost:3000" ||
    hostname === "localhost:3001" ||
    hostname.includes("editor.weweb.io");

  let tenant = "nuverdis1";
  if (isDev || hostname.includes("vercel.app")) {
    const url = new URL(request.url);
    tenant = url.searchParams.get("tenant") ?? "nuverdis1";
  } else {
    tenant = hostname.split(".")[0];
  }

  // Valores AUTORITATIVOS del servidor
  requestHeaders.set("x-tenant", tenant);
  if (user && !error) {
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email ?? "");
  }

  const refreshedCookies = supabaseResponse.cookies.getAll();
  supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  refreshedCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie));

  function redirectWithCookies(url: URL | string): NextResponse {
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    redirect.headers.set("x-tenant", tenant);
    return redirect;
  }

  // ── MODO MANTENIMIENTO AVANZADO ─────────────────────────────────────────
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isMantenimientoPage = request.nextUrl.pathname === "/mantenimiento";

  if (isDashboard || isMantenimientoPage) {
    const { data: configData } = await supabase
      .from("plataforma_config_publica")
      .select("modo_mantenimiento, permitir_admins, permitir_encargados, permitir_revisores")
      .eq("id", 1)
      .single();

    const enMantenimiento = configData?.modo_mantenimiento === true;

    if (isMantenimientoPage && !enMantenimiento) {
      return redirectWithCookies(new URL("/login", request.url));
    }

    if (isDashboard && enMantenimiento) {
      const appMetadata = (user?.app_metadata || {}) as Record<string, any>;
      const rolGlobal = appMetadata.rol_global;
      const rolTenant = appMetadata.rol; 

      let tienePermiso = false;

      if (rolGlobal === "superadmin") {
        tienePermiso = true; 
      } else if (user) {
        if (rolTenant === "administrador" && configData.permitir_admins) tienePermiso = true;
        if (rolTenant === "encargado" && configData.permitir_encargados) tienePermiso = true;
        if (rolTenant === "revisor" && configData.permitir_revisores) tienePermiso = true;
      }

      if (!tienePermiso) {
        const target = new URL("/mantenimiento", request.url);
        const tenantParam = new URL(request.url).searchParams.get("tenant");
        if (tenantParam) target.searchParams.set("tenant", tenantParam);
        
        return redirectWithCookies(target);
      }
    }
  }

  // ── Redirect /login → /org si ya hay sesión ──────────────────────────────
  if (request.nextUrl.pathname === "/login" && user && !error) {
    const empresaId = (user.app_metadata as { empresa_id?: string } | undefined)
      ?.empresa_id;
    if (empresaId) {
      const { data: empresa } = await supabase
        .from("empresas_public")
        .select("ref")
        .eq("empresa_id", empresaId)
        .single();
      if (empresa?.ref) {
        const target = new URL(`/dashboard/org/${empresa.ref}`, request.url);
        const tenantParam = new URL(request.url).searchParams.get("tenant");
        if (tenantParam) target.searchParams.set("tenant", tenantParam);
        return redirectWithCookies(target);
      }
    }
  }

  // ── Protección /dashboard/* ───────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user || error) {
      console.log("[middleware] /dashboard sin sesión → redirect /login");
      return redirectWithCookies(new URL("/login", request.url));
    }

    // ── Modo Pausa: empresa bloqueada ────────────────────────────────────────
    // Si la empresa está en pausa, redirigir a /pausa (salvo superadmin).
    const isPausaPage = request.nextUrl.pathname === "/pausa";
    const rolGlobal = (user.app_metadata as Record<string, unknown>)?.rol_global;
    if (rolGlobal !== "superadmin") {
      const empresaId = (user.app_metadata as Record<string, unknown>)?.empresa_id;
      if (empresaId) {
        const { data: empresaData } = await supabase
          .from("empresas")
          .select("activa, pausa_activada_at")
          .eq("empresa_id", empresaId)
          .single();
        if (empresaData?.pausa_activada_at && !isPausaPage) {
          const target = new URL("/pausa", request.url);
          const tenantParam = new URL(request.url).searchParams.get("tenant");
          if (tenantParam) target.searchParams.set("tenant", tenantParam);
          return redirectWithCookies(target);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};