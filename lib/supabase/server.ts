import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies de sesión los gestiona el middleware
          }
        },
      },
      // Datos multi-tenant SIEMPRE frescos: opt-out del Next.js Data Cache.
      // Sin esto, los .select() (HTTP GET) se cachean por defecto y devuelven
      // datos obsoletos, mientras los .rpc() (POST) sí refrescan — provocando
      // desincronización entre vistas (ej. overview vs sidenav de colecciones).
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
