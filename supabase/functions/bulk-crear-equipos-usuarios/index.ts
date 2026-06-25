import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RegistroInput {
  equipo: string;
  nombre_completo: string;
  email: string;
  rol: string;
}

interface Fallido {
  email: string;
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
  let body: { registros?: unknown };
  try {
    body = await req.json() as { registros?: unknown };
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const raw = body.registros;
  if (!Array.isArray(raw) || raw.length === 0) {
    return jsonResponse({ error: "El campo 'registros' debe ser un array no vacío" }, 400);
  }

  // — 4. Validar campos —
  for (const [i, item] of (raw as unknown[]).entries()) {
    const r = item as Record<string, unknown>;
    if (!r.equipo || typeof r.equipo !== "string" || !r.equipo.trim()) {
      return jsonResponse({ error: `Fila ${i + 1}: 'equipo' requerido` }, 400);
    }
    if (!r.nombre_completo || typeof r.nombre_completo !== "string" || !r.nombre_completo.trim()) {
      return jsonResponse({ error: `Fila ${i + 1}: 'nombre_completo' requerido` }, 400);
    }
    if (!r.email || typeof r.email !== "string" || !r.email.trim()) {
      return jsonResponse({ error: `Fila ${i + 1}: 'email' requerido` }, 400);
    }
    if (!["encargado", "revisor"].includes(r.rol as string)) {
      return jsonResponse(
        { error: `Fila ${i + 1}: rol inválido "${r.rol}". Solo "encargado" o "revisor"` },
        400
      );
    }
  }

  const registros = raw as RegistroInput[];

  // — 5. Duplicados internos de email —
  const emails = registros.map((r) => r.email.toLowerCase());
  const emailSet = new Set(emails);
  if (emailSet.size !== emails.length) {
    const dupes = emails.filter((e, i) => emails.indexOf(e) !== i);
    return jsonResponse(
      { error: `Emails duplicados en el batch: ${[...new Set(dupes)].join(", ")}` },
      400
    );
  }

  // — 6. Obtener o crear equipos únicos —
  const equiposUnicos = [...new Set(registros.map((r) => r.equipo))];
  const equiposMap = new Map<string, number>(); // nombre → equipo_id
  let equipos_creados = 0;

  for (const nombre of equiposUnicos) {
    const { data: existing } = await supabaseAdmin
      .from("equipos")
      .select("equipo_id")
      .eq("empresa_id", empresaId)
      .eq("nombre", nombre)
      .maybeSingle();

    if (existing) {
      equiposMap.set(nombre, (existing as { equipo_id: number }).equipo_id);
    } else {
      const { data: nuevo, error: insertErr } = await supabaseAdmin
        .from("equipos")
        .insert({ nombre, empresa_id: empresaId })
        .select("equipo_id")
        .single();

      if (insertErr || !nuevo) {
        // Los registros de este equipo fallarán individualmente
        continue;
      }

      equiposMap.set(nombre, (nuevo as { equipo_id: number }).equipo_id);
      equipos_creados++;
    }
  }

  // — 7. Procesar cada registro —
  const fallidos: Fallido[] = [];
  let exitosos = 0;

  for (const r of registros) {
    const equipoId = equiposMap.get(r.equipo);
    if (equipoId === undefined) {
      fallidos.push({ email: r.email, error: `No se pudo obtener/crear el equipo "${r.equipo}"` });
      continue;
    }

    // Crear en auth.users
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: r.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { nombre_completo: r.nombre_completo },
    });

    if (authErr) {
      const msg = authErr.message === "User already registered"
        ? "Email ya existe en el sistema"
        : `Error auth: ${authErr.message}`;
      fallidos.push({ email: r.email, error: msg });
      continue;
    }

    const newUid = authData.user.id;

    // INSERT en public.usuarios
    const { error: dbErr } = await supabaseAdmin.from("usuarios").insert({
      uid: newUid,
      nombre_completo: r.nombre_completo,
      empresa_id: empresaId,
      activo: true,
    });

    if (dbErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUid);
      fallidos.push({ email: r.email, error: `Error BD usuarios: ${dbErr.message}` });
      continue;
    }

    // Obtener role_id
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", r.rol)
      .single();

    if (roleErr || !roleRow) {
      await supabaseAdmin.auth.admin.deleteUser(newUid);
      fallidos.push({ email: r.email, error: "Rol no encontrado en BD" });
      continue;
    }

    // INSERT en user_roles
    const { error: rolErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUid, role_id: (roleRow as { id: number }).id });

    if (rolErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUid);
      fallidos.push({ email: r.email, error: `Error al asignar rol: ${rolErr.message}` });
      continue;
    }

    // INSERT en equipo_miembros
    const { error: memErr } = await supabaseAdmin
      .from("equipo_miembros")
      .insert({ equipo_id: equipoId, user_id: newUid });

    if (memErr) {
      // Usuario creado pero sin asignar al equipo — no rollback completo, registrar el fallo
      fallidos.push({
        email: r.email,
        error: `Usuario creado pero no asignado al equipo: ${memErr.message}`,
      });
      continue;
    }

    exitosos++;
  }

  // — 8. Log —
  await supabaseUser.rpc("log_usuario_accion", {
    p_accion: "BULK_CREAR_EQUIPOS_USUARIOS",
    p_tabla: "equipos",
    p_registro_id: "",
    p_datos_prev: null,
    p_datos_new: {
      exitosos: String(exitosos),
      fallidos: String(fallidos.length),
      equipos_creados: String(equipos_creados),
    },
  });

  return jsonResponse({ exitosos, fallidos, equipos_creados });
});
