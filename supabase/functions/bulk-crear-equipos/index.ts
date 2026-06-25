import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EquipoInput {
  nombre: string;
}

interface Fallido {
  nombre: string;
  error: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // — 1. JWT —
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "No autorizado" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Token inválido" }, 401);

  const empresaId = user.app_metadata?.empresa_id as number | undefined;
  const callerRol = user.app_metadata?.rol as string | undefined;

  if (!empresaId) return jsonResponse({ error: "empresa_id no encontrado en JWT" }, 403);

  // — 2. Permisos —
  if (callerRol !== "administrador" && callerRol !== "superadmin") {
    return jsonResponse({ error: "Permisos insuficientes" }, 403);
  }

  // — 3. Parsear body —
  let body: { equipos?: unknown };
  try {
    body = await req.json() as { equipos?: unknown };
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const raw = body.equipos;
  if (!Array.isArray(raw) || raw.length === 0) {
    return jsonResponse({ error: "El campo 'equipos' debe ser un array no vacío" }, 400);
  }

  // — 4. Validar campos —
  for (const [i, item] of (raw as unknown[]).entries()) {
    const e = item as Record<string, unknown>;
    if (!e.nombre || typeof e.nombre !== "string" || !e.nombre.trim()) {
      return jsonResponse({ error: `Fila ${i + 1}: 'nombre' requerido` }, 400);
    }
  }

  const equipos = raw as EquipoInput[];

  // — 5. Duplicados internos —
  const nombres = equipos.map((e) => e.nombre.toLowerCase());
  const nombreSet = new Set(nombres);
  if (nombreSet.size !== nombres.length) {
    const dupes = nombres.filter((n, i) => nombres.indexOf(n) !== i);
    return jsonResponse(
      { error: `Nombres duplicados en el batch: ${[...new Set(dupes)].join(", ")}` },
      400
    );
  }

  // — 6. Detectar nombres que ya existen en la empresa —
  const { data: existentes } = await supabaseAdmin
    .from("equipos")
    .select("nombre")
    .eq("empresa_id", empresaId)
    .in("nombre", equipos.map((e) => e.nombre));

  const nombresExistentes = new Set(
    (existentes ?? []).map((e: { nombre: string }) => e.nombre.toLowerCase())
  );

  // — 7. Procesar cada equipo —
  const fallidos: Fallido[] = [];
  let exitosos = 0;

  for (const eq of equipos) {
    if (nombresExistentes.has(eq.nombre.toLowerCase())) {
      fallidos.push({ nombre: eq.nombre, error: "Nombre ya existe en la empresa" });
      continue;
    }

    const { error: insertErr } = await supabaseAdmin.from("equipos").insert({
      nombre: eq.nombre,
      empresa_id: empresaId,
    });

    if (insertErr) {
      fallidos.push({ nombre: eq.nombre, error: `Error BD: ${insertErr.message}` });
      continue;
    }

    exitosos++;
  }

  // — 8. Log —
  await supabaseUser.rpc("log_usuario_accion", {
    p_accion: "BULK_CREAR_EQUIPOS",
    p_tabla: "equipos",
    p_registro_id: "",
    p_datos_prev: null,
    p_datos_new: { exitosos: String(exitosos), fallidos: String(fallidos.length) },
  });

  return jsonResponse({ exitosos, fallidos });
});
