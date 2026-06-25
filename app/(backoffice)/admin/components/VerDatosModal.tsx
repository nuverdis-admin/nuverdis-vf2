"use client";

// Modal genérico de solo lectura — muestra todos los campos de un registro.

export interface DatoItem {
  label: string;
  valor: React.ReactNode;
}

export function VerDatosModal({
  titulo,
  subtitulo,
  datos,
  onClose,
}: {
  titulo: string;
  subtitulo?: string;
  datos: DatoItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border-t-4 border-info-5 bg-[#161616] shadow-2xl">
        <div className="border-b border-[#2A2A2A] px-6 py-4">
          <h2 className="text-lg font-bold text-[#EDEDED]">{titulo}</h2>
          {subtitulo && (
            <p className="mt-0.5 truncate text-xs text-[#8C8C8C]">{subtitulo}</p>
          )}
        </div>

        <dl className="flex-1 divide-y divide-[#222222] overflow-y-auto px-6 py-1">
          {datos.map((d) => (
            <div
              key={d.label}
              className="flex items-start justify-between gap-6 py-2.5"
            >
              <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-[#707070]">
                {d.label}
              </dt>
              <dd className="break-all text-right text-sm text-[#EDEDED]">
                {d.valor}
              </dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-[#2A2A2A] px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-semibold text-[#A1A1A1] transition-colors hover:bg-[#202020] hover:text-[#EDEDED]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
