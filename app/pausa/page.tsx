import { PauseCircle } from "lucide-react";

export default function PausaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-1 p-8 text-center">
      <PauseCircle className="mb-6 h-16 w-16 text-warning-5" strokeWidth={1.5} />
      <h1 className="mb-3 text-2xl font-bold text-gray-9">
        Tu cuenta está en pausa
      </h1>
      <p className="mb-2 max-w-md text-sm text-gray-6">
        Tu organización activó el modo "Tómate una pausa". Todos los datos están
        seguros y serán conservados íntegramente durante hasta 12 meses.
      </p>
      <p className="mb-8 max-w-md text-sm text-gray-5">
        Para reactivar tu cuenta, contacta a tu administrador o escríbenos a{" "}
        <a
          href="mailto:hola@nuverdis.com"
          className="text-primary-6 underline underline-offset-2"
        >
          hola@nuverdis.com
        </a>
        .
      </p>
      <a
        href="/login"
        className="rounded-lg border border-gray-3 px-5 py-2.5 text-sm font-medium text-gray-7 transition-colors hover:bg-white hover:shadow-sm"
      >
        Volver al inicio
      </a>
    </div>
  );
}
