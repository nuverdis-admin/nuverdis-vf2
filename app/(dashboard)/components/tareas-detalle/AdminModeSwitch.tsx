"use client";

interface Props {
  modoEdicion: boolean;
  onToggle: (next: boolean) => void;
  bloqueado?: boolean;
}

// Toggle compacto admin solo-lectura ↔ edición.
export function AdminModeSwitch({ modoEdicion, onToggle, bloqueado = false }: Props) {
  return (
    <div
      className="flex items-center gap-2"
      title={bloqueado ? "No se puede editar la tarea en este estado" : undefined}
    >
      <span
        className={`text-xs font-medium ${bloqueado ? "text-gray-4" : modoEdicion ? "text-gray-5" : "text-gray-8"}`}
      >
        Solo lectura
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={modoEdicion}
        disabled={bloqueado}
        onClick={() => !bloqueado && onToggle(!modoEdicion)}
        className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
          bloqueado
            ? "cursor-not-allowed bg-gray-2 opacity-50"
            : modoEdicion
            ? "cursor-pointer bg-primary-5"
            : "cursor-pointer bg-gray-3"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            modoEdicion ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <span
        className={`text-xs font-medium ${bloqueado ? "text-gray-4" : modoEdicion ? "text-primary-7" : "text-gray-5"}`}
      >
        Edición
      </span>
    </div>
  );
}
