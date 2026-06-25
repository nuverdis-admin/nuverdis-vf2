import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UsuarioInput {
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
  let body: { usuarios?: unknown };
  try {
    body = await req.json() as { usuarios?: unknown };
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const raw = body.usuarios;
  if (!Array.isArray(raw) || raw.length === 0) {
    return jsonResponse({ error: "El campo 'usuarios' debe ser un array no vacío" }, 400);
  }

  // — 4. Validar campos y roles —
  for (const [i, item] of (raw as unknown[]).entries()) {
    const u = item as Record<string, unknown>;
    if (!u.nombre_completo || typeof u.nombre_completo !== "string" || !u.nombre_completo.trim()) {
      return jsonResponse({ error: `Fila ${i + 1}: 'nombre_completo' requerido` }, 400);
    }
    if (!u.email || typeof u.email !== "string" || !u.email.trim()) {
      return jsonResponse({ error: `Fila ${i + 1}: 'email' requerido` }, 400);
    }
    if (!["encargado", "revisor"].includes(u.rol as string)) {
      return jsonResponse(
        { error: `Fila ${i + 1}: rol inválido "${u.rol}". Solo "encargado" o "revisor"` },
        400
      );
    }
  }

  const usuarios = raw as UsuarioInput[];

  // — 5. Duplicados internos —
  const emails = usuarios.map((u) => u.email.toLowerCase());
  const emailSet = new Set(emails);
  if (emailSet.size !== emails.length) {
    const dupes = emails.filter((e, i) => emails.indexOf(e) !== i);
    return jsonResponse(
      { error: `Emails duplicados en el batch: ${[...new Set(dupes)].join(", ")}` },
      400
    );
  }

  // — 6. Procesar cada usuario —
  const fallidos: Fallido[] = [];
  let exitosos = 0;

  for (const u of usuarios) {
    // Crear en auth.users
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { nombre_completo: u.nombre_completo },
    });

    if (authErr) {
      const msg = authErr.message === "User already registered"
        ? "Email ya existe en el sistema"
        : `Error auth: ${authErr.message}`;
      fallidos.push({ email: u.email, error: msg });
      continue;
    }

    const newUid = authData.user.id;

    // INSERT en public.usuarios
    const { error: dbErr } = await supabaseAdmin.from("usuarios").insert({
      uid: newUid,
      nombre_completo: u.nombre_completo,
      empresa_id: empresaId,
      activo: true,
    });

    if (dbErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUid);
      fallidos.push({ email: u.email, error: `Error BD usuarios: ${dbErr.message}` });
      continue;
    }

    // Obtener role_id
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", u.rol)
      .single();

    if (roleErr || !roleRow) {
      await supabaseAdmin.auth.admin.deleteUser(newUid);
      fallidos.push({ email: u.email, error: "Rol no encontrado en BD" });
      continue;
    }

    // INSERT en user_roles
    const { error: rolErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUid, role_id: roleRow.id });

    if (rolErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUid);
      fallidos.push({ email: u.email, error: `Error al asignar rol: ${rolErr.message}` });
      continue;
    }

    exitosos++;
  }

  // — 7. Log —
  await supabaseUser.rpc("log_usuario_accion", {
    p_accion: "BULK_CREAR_USUARIOS",
    p_tabla: "usuarios",
    p_registro_id: "",
    p_datos_prev: null,
    p_datos_new: { exitosos: String(exitosos), fallidos: String(fallidos.length) },
  });

  return jsonResponse({ exitosos, fallidos });
});
