import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-4">
      <Image
        src="/images/NuVerdis_512px_plain_dark.svg"
        alt="NuVerdis"
        width={96}
        height={96}
        priority
      />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-9">¡Ups!</h1>
        <p className="mt-2 text-sm text-gray-5">
          Creo que este lugar no existe...
        </p>
      </div>
      <Link href="/dashboard/org" className="btn btn-outline rounded-lg">
        Volver al inicio
      </Link>
    </div>
  );
}
