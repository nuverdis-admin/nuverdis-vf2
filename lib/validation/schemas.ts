// Esquemas de validación zod para los Server Actions.
//
// HIGH-4: ningún Server Action validaba shape/longitud/formato de su input.
// Un Server Action es un endpoint HTTP — el cliente puede enviar cualquier
// payload. Estos esquemas se aplican con `.safeParse()` al inicio de cada acción
// y rechazan datos malformados (tipos incorrectos, enums inválidos, strings
// gigantes que causarían DoS) antes de tocar la BD o enviar correos.

import { z } from "zod";

// ── Primitivos reutilizables ──────────────────────────────────────────────────
const uuid = z.string().uuid();
const idPositivo = z.number().int().positive();
// proyectoId viaja como string o número según el origen; aceptamos ambos.
const proyectoIdField = z.union([z.string().min(1).max(50), z.number()]);
const textoCorto = z.string().max(500); // nombres, jerarquías, refs, labels
const textoLargo = z.string().max(2000); // motivos / mensajes redactados por el usuario
const tipoReporte = z.string().min(1).max(20);
const rolEnum = z.enum(["administrador", "encargado", "revisor"]);

// ── Gestión de usuarios (lib/supabase/usuarios.ts) ────────────────────────────
export const CrearUsuarioSchema = z.object({
  email: z.string().trim().email().max(254),
  nombre_completo: z.string().trim().min(1).max(200),
  rol: rolEnum,
  activo: z.boolean(),
});

export const EditarUsuarioSchema = z.object({
  uid: uuid,
  datos: z.object({
    nombre_completo: z.string().trim().min(1).max(200),
    rol: rolEnum,
    activo: z.boolean(),
  }),
});

export const EliminarUsuarioSchema = z.object({
  uid: uuid,
  motivo_baja: z.string().trim().max(500).optional(),
});

// ── Login OTP — paso 1 y paso 2 (app/(auth)/login/actions.ts) ────────────────
export const SendOtpSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const VerifyOtpSchema = z.object({
  email: z.string().trim().email().max(254),
  token: z
    .string()
    .min(6)
    .max(8)
    .regex(/^\d+$/, "Solo dígitos"),
});

// ── Notificaciones (lib/supabase/notificaciones.ts) ───────────────────────────
export const NotificarPerfilEditadoSchema = z.object({
  uid: uuid,
  nombreUsuario: textoCorto,
});

export const NotificarActualizacionTareaSchema = z.object({
  equipoId: idPositivo,
  tareaInfo: z.object({
    jerarquia2Nombre: textoCorto,
    proyectoId: proyectoIdField,
    proyectoRef: textoCorto,
    tipoReporte,
  }),
});

export const EnviarRecordatorioTareaSchema = z.object({
  equipoId: idPositivo,
  tareaId: z.union([z.string().min(1).max(100), z.number().int().positive()]),
  proyectoId: proyectoIdField,
  jerarquia2Nombre: textoCorto,
  estado: z.string().min(1).max(30),
  tipoReporte,
});

export const NotificarTareaAsignadaSchema = z.object({
  equipoId: idPositivo,
  tareaInfo: z.object({
    jerarquia2Nombre: textoCorto,
    proyectoId: proyectoIdField,
    proyectoRef: textoCorto,
    proyectoNombre: textoCorto,
    tipoReporte,
  }),
});

export const NotificarDerivacionResueltaSchema = z.object({
  solicitanteUid: uuid,
  accion: z.enum(["aprobada", "rechazada"]),
  tipo: z.enum(["derivacion", "exclusion"]),
  tipoOpcion: z.string().max(50).optional(),
  tareaLabel: textoCorto,
  motivoRechazo: textoLargo.optional(),
  derivarAUid: uuid.nullable().optional(),
});

export const NotificarAsignacionMasivaSchema = z.object({
  equipoId: idPositivo,
  info: z.object({
    proyectoId: proyectoIdField,
    proyectoRef: textoCorto,
    proyectoNombre: textoCorto,
    tipoReporte,
    items: z
      .array(
        z.object({
          jerarquia1: textoCorto,
          jerarquia2: textoCorto,
          nombre: textoCorto,
        })
      )
      .max(1000),
  }),
});

export const NotificarNuevaSolicitudAdminSchema = z.object({
  solicitanteUid: uuid,
  tareaLabel: textoCorto,
  tipo: z.enum(["derivacion", "exclusion"]),
});

// ── Cambio de estado de tarea (lib/supabase/notificaciones-tarea.ts) ──────────
const CambioEstadoArgsSchema = z.object({
  proyectoId: proyectoIdField,
  proyectoRef: textoCorto,
  publicId: z.string().min(1).max(100),
  jerarquia2Nombre: textoCorto,
  tipoReporte,
  equipoId: idPositivo.nullable(),
});

export const NotificarTareaEnviadaRevisionSchema = CambioEstadoArgsSchema;
export const NotificarTareaRetornadaSchema = CambioEstadoArgsSchema.extend({
  motivo: textoLargo,
});
export const NotificarTareaCompletadaSchema = CambioEstadoArgsSchema;

// ── Email de cambio de estado (app/actions/notificaciones-email.ts) ───────────
export const EnviarEmailCambioEstadoSchema = z.object({
  equipoId: idPositivo.nullable(),
  proyectoRef: textoCorto,
  proyectoNombre: textoCorto,
  publicId: z.string().min(1).max(100),
  jerarquia2Nombre: textoCorto,
  tipoReporte,
  nuevoEstado: z.enum(["en_revision", "completada", "retornada"]),
  motivo: textoLargo.optional(),
  quienActuo: textoCorto.optional(),
});

// ── Generación de reportes (app/actions/generar-reporte-gri.ts) ───────────────
export const GenerarReporteGriSchema = z.object({
  proyectoId: idPositivo,
});

export const GenerarReporteNcgSchema = z.object({
  proyectoId: idPositivo,
});

// ── Evidencias / Storage (app/actions/evidencias.ts) ──────────────────────────
export const EvidenciaPathSchema = z.object({
  path: z.string().min(1).max(1024),
  tareaId: idPositivo,
});

// ── Backoffice — CRUD de empresas (app/actions/admin-empresas.ts) ─────────────
const planEmpresa = z.enum(["starter", "pro", "enterprise"]);

export const CrearEmpresaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  dominio_short: z
    .string()
    .trim()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  plan: planEmpresa,
  icono: z.string().url().max(500).optional(),
});

export const EditarEmpresaSchema = z.object({
  empresa_id: idPositivo,
  nombre: z.string().trim().min(1).max(120),
  plan: planEmpresa,
  activa: z.boolean(),
  icono: z.string().url().nullable().optional(),
});

// ── Backoffice — comando de usuarios (app/actions/admin-comando.ts) ───────────
export const CambiarRolSchema = z.object({
  uid: uuid,
  rol: rolEnum,
});

export const MoverUsuarioSchema = z.object({
  uid: uuid,
  empresa_id: idPositivo,
});

// Crear usuario para cualquier empresa (soporte / God Mode).
export const CrearUsuarioGlobalSchema = z.object({
  empresa_id: idPositivo,
  email: z.string().trim().email().max(254),
  nombre_completo: z.string().trim().min(1).max(200),
  rol: rolEnum,
});

// ── Soporte / Tickets (app/actions/soporte.ts + lib/supabase/notificaciones.ts) ─
export const CrearTicketSoporteConsultaSchema = z.object({
  tipo: z.literal("consulta"),
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().min(1).max(1000),
});

export const CrearTicketSoporteErrorSchema = z.object({
  tipo: z.literal("error"),
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().min(1).max(1000),
  url: z.string().trim().min(1).max(500),
});

export const CrearTicketSoporteSchema = z.discriminatedUnion("tipo", [
  CrearTicketSoporteConsultaSchema,
  CrearTicketSoporteErrorSchema,
]);

export const CancelarTicketSchema = z.object({
  id: z.string().min(10).max(30),
});

export const ActualizarEstadoTicketSchema = z.object({
  id: z.string().min(10).max(30),
  estado: z.enum(["en_curso", "finalizado", "reabierto"]),
});

export const NotificarTicketCreadoSchema = z.object({
  ticketId: z.string().min(10).max(30),
  titulo: z.string().trim().min(1).max(200),
  tipo: z.enum(["consulta", "error"]),
});
