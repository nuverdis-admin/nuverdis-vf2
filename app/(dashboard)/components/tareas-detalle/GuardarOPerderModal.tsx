"use client";

interface Props {
  open: boolean;
  saving: boolean;
  onGuardarYSalir: () => void;
  onSalirSinGuardar: () => void;
  onCancelar: () => void;
}

export function GuardarOPerderModal({
  open,
  saving,
  onGuardarYSalir,
  onSalirSinGuardar,
  onCancelar,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-info-5">
        <h2 className="mb-2 text-base font-bold text-gray-9">Tienes cambios sin guardar</h2>
        <p className="text-sm text-gray-7">
          Si sales ahora, perderás los cambios que hiciste en las respuestas.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onGuardarYSalir}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar y salir"}
          </button>
          <button type="button" onClick={onSalirSinGuardar} className="btn btn-outline w-full">
            Salir sin guardar
          </button>
          <button type="button" onClick={onCancelar} className="btn btn-ghost w-full">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
