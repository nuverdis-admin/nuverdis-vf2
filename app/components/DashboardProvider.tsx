"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth";
import type { AppConfig, UsuarioActual, Proyecto } from "@/lib/store/auth";

interface Props {
  appConfig: AppConfig;
  usuarioActual: UsuarioActual;
  proyectos: Proyecto[];
  children: React.ReactNode;
}

export function DashboardProvider({
  appConfig,
  usuarioActual,
  proyectos,
  children,
}: Props) {
  const { setAppConfig, setUsuario, setProyectos } = useAuthStore();

  // Hidrata el store con los datos traídos desde el servidor (una sola vez al montar)
  useEffect(() => {
    console.log("[DashboardProvider] props received:", {
      appConfig,
      usuarioActual,
      proyectosCount: proyectos.length,
    });

    setAppConfig(appConfig);
    setUsuario(usuarioActual);
    setProyectos(proyectos);

    // Zustand actualiza el estado de forma síncrona; getState() refleja el nuevo estado
    const storeState = useAuthStore.getState();
    console.log("[DashboardProvider] store hydrated:", {
      appConfig: storeState.appConfig,
      usuarioActual: storeState.usuarioActual,
      proyectosCount: storeState.proyectos.length,
    });

    // Los props vienen del Server Component y no cambian entre renders del cliente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detecta cambios de tema (dark mode) en el atributo class del <html>
  useEffect(() => {
    const syncTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.setAttribute(
        "data-theme",
        isDark ? "dark" : "light"
      );
    };

    syncTheme(); // estado inicial

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
