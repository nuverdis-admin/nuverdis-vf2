import { createBrowserClient } from "@supabase/ssr";

// Singleton: un único cliente browser → un único socket de Realtime.
// Evita múltiples conexiones websocket y toasts duplicados.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
