"use client";

import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      {/* Contenedor del Lottie más grande */}
      <div className="w-full max-w-[1000px] mb-8"> 
        <DotLottieReact
          src="/images/mantenimiento.lottie"
          loop
          autoplay
        />
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#0A0A0A]">
          Estamos afinando los motores
        </h1>

        <p className="text-[#4A4A4A] max-w-md mx-auto">
          La plataforma está recibiendo una actualización importante.
          ¡Volveremos lo antes posible!
        </p>
      </div>
    </div>
  );
}