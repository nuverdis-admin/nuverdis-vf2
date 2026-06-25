export function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-2 bg-white py-16">
      <svg className="h-10 w-10 text-gray-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
      <p className="font-semibold text-gray-6">{label} — Próximamente</p>
      <p className="text-sm text-gray-4">
        Esta funcionalidad estará disponible en una versión futura
      </p>
    </div>
  );
}
