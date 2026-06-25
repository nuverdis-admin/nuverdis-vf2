import "server-only";

import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "./server";

export interface ActorContext {
  uid: string;
  empresaId: number;
  rol: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAdmin
//
// Valida que la petición provenga de un usuario autenticado, activo y con rol
// administrador (o superadmin). Lanza Error si no cumple.
//
// Uso obligatorio al inicio de TODA Server Action que utilice el cliente
// `admin` (Service Role), antes de operar sobre auth.users o tablas protegidas.
// ─────────────────────────────────────────────────────────────────────────────
export async function requireAdmin(): Promise<ActorContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No autenticado");
  }

  const meta = user.app_metadata as {
    empresa_id?: number;
    rol?: string;
    activo?: boolean;
    empresa_activa?: boolean;
  };

  if (!meta.activo || !meta.empresa_activa) {
    throw new Error("Usuario inactivo");
  }

  if (meta.rol !== "administrador" && meta.rol !== "superadmin") {
    throw new Error("Permisos insuficientes");
  }

  if (!meta.empresa_id) {
    throw new Error("Sin empresa asignada");
  }

  return {
    uid: user.id,
    empresaId: Number(meta.empresa_id),
    rol: meta.rol,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAdminSameTenant
//
// Doble verificación de aislamiento multi-tenant:
//   1) El actor debe ser admin (requireAdmin).
//   2) El `targetUid` debe pertenecer a la MISMA empresa del actor.
//
// Se debe invocar antes de cualquier operación de Service Role que reciba
// un `uid` desde el cliente (editar, eliminar, desactivar, recuperar email,
// modificar app_metadata, etc.).
//
// Lanza Error genérico si falla la pertenencia (no enumera usuarios).
// ─────────────────────────────────────────────────────────────────────────────
export async function requireAdminSameTenant(
  targetUid: string
): Promise<ActorContext> {
  const actor = await requireAdmin();
  const supabase = await createClient();

  const { data: target, error } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("uid", targetUid)
    .single();

  if (error || !target) {
    throw new Error("Usuario no encontrado");
  }

  if (Number((target as { empresa_id: number }).empresa_id) !== actor.empresaId) {
    // Mismo mensaje que "no encontrado" para evitar enumeración cross-tenant.
    throw new Error("Usuario no encontrado");
  }

  return actor;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSession
//
// Valida que la petición provenga de un usuario autenticado y activo, SIN exigir
// rol administrador. Necesario para Server Actions que también disparan
// encargados/revisores (ej. notificaciones del ciclo de vida de tareas).
//
// Cierra el IDOR de invocación directa: un Server Action sin guard es un endpoint
// HTTP abierto a cualquier sesión. Combinar con assert*EnEmpresa para validar que
// los recursos sobre los que opera pertenezcan a la empresa del actor.
// ─────────────────────────────────────────────────────────────────────────────
export async function requireSession(): Promise<ActorContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No autenticado");
  }

  const meta = user.app_metadata as {
    empresa_id?: number;
    rol?: string;
    activo?: boolean;
    empresa_activa?: boolean;
  };

  if (!meta.activo || !meta.empresa_activa) {
    throw new Error("Usuario inactivo");
  }

  if (!meta.empresa_id) {
    throw new Error("Sin empresa asignada");
  }

  return {
    uid: user.id,
    empresaId: Number(meta.empresa_id),
    rol: meta.rol ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// assert*EnEmpresa
//
// Validan que un recurso (equipo, proyecto, usuario) pertenezca a la empresa del
// actor antes de operar sobre él. Bloquean IDOR cross-tenant en Server Actions
// que reciben IDs desde el cliente.
//
// Lanzan un Error genérico ("Recurso no encontrado") tanto si el recurso no
// existe como si pertenece a otra empresa — no permite enumeración cross-tenant.
// ─────────────────────────────────────────────────────────────────────────────
async function assertRecursoEnEmpresa(
  tabla: "equipos" | "proyectos" | "usuarios",
  columnaId: "equipo_id" | "proyecto_id" | "uid",
  valorId: string | number,
  empresaId: number
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(tabla)
    .select("empresa_id")
    .eq(columnaId, valorId)
    .single();

  if (error || !data) {
    throw new Error("Recurso no encontrado");
  }

  if (Number((data as { empresa_id: number }).empresa_id) !== empresaId) {
    throw new Error("Recurso no encontrado");
  }
}

export function assertEquipoEnEmpresa(
  equipoId: number,
  empresaId: number
): Promise<void> {
  return assertRecursoEnEmpresa("equipos", "equipo_id", equipoId, empresaId);
}

export function assertProyectoEnEmpresa(
  proyectoId: string | number,
  empresaId: number
): Promise<void> {
  return assertRecursoEnEmpresa(
    "proyectos",
    "proyecto_id",
    proyectoId,
    empresaId
  );
}

export function assertUidEnEmpresa(
  targetUid: string,
  empresaId: number
): Promise<void> {
  return assertRecursoEnEmpresa("usuarios", "uid", targetUid, empresaId);
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSuperadmin
//
// Guard del Backoffice / God Mode. Aplica el DOBLE ESCUDO en una sola llamada:
//   Escudo 1 — el UID debe figurar en INTERNAL_ADMIN_UIDS (variable de entorno,
//     NO consulta la base de datos → un fallo de BD jamás concede acceso).
//   Escudo 2 — app_metadata.rol_global === "superadmin".
//
// Uso OBLIGATORIO al inicio de TODO Server Action del módulo de administración
// interna: estos endpoints NO pasan por el layout del backoffice, así que deben
// autovalidarse. Lanza Error genérico ("Acceso denegado") si algún escudo falla.
// ─────────────────────────────────────────────────────────────────────────────
export async function requireSuperadmin(): Promise<{ uid: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No autenticado");
  }

  // Escudo 1: hard-block por UID (solo variable de entorno).
  const permitidos = (process.env.INTERNAL_ADMIN_UIDS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (permitidos.length === 0 || !permitidos.includes(user.id)) {
    throw new Error("Acceso denegado");
  }

  // Escudo 2: rol_global desde app_metadata (validado por getUser → GoTrue).
  const rolGlobal = (user.app_metadata as { rol_global?: string }).rol_global;
  if (rolGlobal !== "superadmin") {
    throw new Error("Acceso denegado");
  }

  return { uid: user.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// getSuperAdminClient
//
// Devuelve un cliente Supabase con SERVICE_ROLE_KEY (omite RLS) — pero SOLO
// después de validar requireSuperadmin() (Doble Escudo: UID + rol_global).
//
// Es el ÚNICO punto autorizado para acceso cross-tenant del backoffice. Resuelve
// el bug por el cual el superadmin (que pertenece a un tenant) no podía leer las
// empresas de otros: el cliente con privilegios omite las políticas RLS.
// Uso obligatorio en todo Server Action del backoffice que lea/modifique datos
// de varias empresas.
// ─────────────────────────────────────────────────────────────────────────────
export async function getSuperAdminClient(): Promise<{
  uid: string;
  admin: SupabaseClient;
}> {
  const { uid } = await requireSuperadmin();
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return { uid, admin };
}
