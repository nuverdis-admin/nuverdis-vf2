import Link from "next/link";

export default function TareaNoDisponible() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-2 bg-white py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-1">
        <svg className="h-7 w-7 text-gray-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-8">Tarea no disponible</h2>
        <p className="mt-1 text-sm text-gray-5">
          Esta tarea no está disponible o no tienes acceso.
        </p>
      </div>
      <Link href="/dashboard" className="btn btn-outline mt-2">
        Volver al inicio
      </Link>
    </div>
  );
}
