// Validación cliente de transiciones de estado, espejo de cambiar_estado_tarea (RPC).

import type { EstadoTarea } from "./types";

interface ValidacionResultado {
  ok: boolean;
  motivo?: string;
}

export function validarTransicion(
  actual: EstadoTarea,
  destino: EstadoTarea,
  opts: { esAdmin: boolean; comoAdmin?: boolean }
): ValidacionResultado {
  if (destino === "en_revision") {
    if (actual !== "asignada" && actual !== "retornada") {
      return { ok: false, motivo: "Solo desde asignada/retornada" };
    }
    return { ok: true };
  }
  if (destino === "completada") {
    if (opts.comoAdmin) {
      if (!opts.esAdmin) return { ok: false, motivo: "Solo admin puede aprobar como admin" };
      if (actual === "en_revision") return { ok: false, motivo: "No saltar flujo en revisión" };
      return { ok: true };
    }
    if (actual !== "en_revision") return { ok: false, motivo: "Solo desde en_revision" };
    return { ok: true };
  }
  if (destino === "retornada") {
    if (actual !== "en_revision") return { ok: false, motivo: "Solo desde en_revision" };
    return { ok: true };
  }
  return { ok: false, motivo: "Estado destino no soportado" };
}
