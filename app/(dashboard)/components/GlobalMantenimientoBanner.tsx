"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface BannerData {
  banner_aviso_activo: boolean;
  inicio_mantenimiento: string | null;
}

export function GlobalMantenimientoBanner() {
  const [data, setData] = useState<BannerData | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const checkStatus = async () => {
      const { data } = await supabase
        .from("plataforma_config_publica")
        .select("banner_aviso_activo, inicio_mantenimiento")
        .eq("id", 1)
        .single();
      
      if (data) setData(data);
    };

    checkStatus();
  }, []);

  if (!data?.banner_aviso_activo || !data?.inicio_mantenimiento) return null;

  const fechaFormat = new Date(data.inicio_mantenimiento).toLocaleString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

return (
  <div className="relative z-40 flex items-center justify-center gap-2 border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-xs font-semibold text-yellow-900">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    <p>
      Mantenimiento programado: La plataforma no estará disponible el{" "}
      <strong>{fechaFormat}</strong>.
    </p>
  </div>
);
}