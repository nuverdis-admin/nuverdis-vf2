"use client";

interface Props {
  open: boolean;
  versionActual?: number;
  onRecargar: () => void;
  onMantener: () => void;
}

export function ConflictoVersionModal({ open, versionActual, onRecargar, onMantener }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-warning-5">
        <h2 className="mb-2 text-base font-bold text-gray-9">Conflicto al guardar</h2>
        <p className="text-sm text-gray-7">
          Otro usuario modificó esta tarea. Tus cambios no se guardaron.
          {versionActual !== undefined && (
            <span className="mt-1 block text-xs text-gray-5">Versión actual en servidor: {versionActual}.</span>
          )}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={onRecargar} className="btn btn-primary w-full">
            Recargar tarea (pierde mis cambios)
          </button>
          <button type="button" onClick={onMantener} className="btn btn-ghost w-full">
            Mantener mis cambios
          </button>
        </div>
      </div>
    </div>
  );
}
