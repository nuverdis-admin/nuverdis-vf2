import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";

import { LoginForm } from "./login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Iniciar sesión — Nuverdis",
};

export default async function LoginPage() {
  const headersList = headers();

  const tenant = headersList.get("x-tenant");

  const supabase = await createClient();

  let companyIcon: string | null = null;

  if (tenant) {
    const { data } = await supabase
      .from("empresas_public")
      .select("icono")
      .eq("dominio_short", tenant)
      .single();

    companyIcon = data?.icono ?? null;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="/images/loginbackground.webp"
          alt="Background"
          fill
          priority
          className="object-cover scale-[1.03] animate-bg"
        />

        {/* Dark veil */}
        <div className="absolute inset-0 bg-black/40 animate-overlay" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Brand */}
        <div className="mb-8 text-center animate-logo">
          <div className="mb-0 flex justify-center">
            <Image
              src="/images/NuVerdis_512px_plain_dark.svg"
              alt="Nuverdis"
              width={102}
              height={102}
              className="drop-shadow-2xl"
            />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Nuverdis
          </h1>

          <p className="mt-2 text-sm text-white/70">
            Accede a tu cuenta
          </p>
        </div>

        {/* Card */}
        <div className="relative animate-card overflow-hidden rounded-2xl border border-white/10 bg-white/90 p-8 shadow-2xl backdrop-blur-md">

          {/* Ambient blob */}
          <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-primary-4/10 blur-3xl" />

          {/* Company watermark */}
          {companyIcon && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <img
                src={companyIcon}
                alt=""
                className="
                  absolute
                  -bottom-10
                  -right-10
                  h-44
                  w-44
                  object-contain
                  opacity-0
                  grayscale
                  mix-blend-multiply
                  blur-[5px]
                  select-none
                  animate-watermark
                "
              />
            </div>
          )}

          {/* Content */}
          <div className="relative z-10">
            <h2 className="mb-6 text-lg font-semibold text-gray-9">
              Iniciar sesión
            </h2>

            <LoginForm />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/60 animate-fade">
          ¿Problemas para acceder?{" "}
          <a
            href="mailto:soporte@nuverdis.com"
            className="underline underline-offset-2 hover:text-white"
          >
            Contacta soporte
          </a>
        </p>
      </div>
    </main>
  );
}