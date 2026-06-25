import { redirect } from "next/navigation";
import { fetchGeneral } from "@/lib/supabase/fetchGeneral";
import { DashboardProvider } from "@/app/components/DashboardProvider";
import { DebugPanel } from "@/app/components/DebugPanel";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { NavDrawerProvider } from "./components/NavDrawerContext";
import { MobileDrawer } from "./components/MobileDrawer";
import { GlobalMantenimientoBanner } from "./components/GlobalMantenimientoBanner";
import { SoporteProvider } from "@/components/soporte/SoporteContext";
import { SoporteModal } from "@/components/soporte/SoporteModal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await fetchGeneral();

  if (!data) {
    redirect("/login");
  }

  const { appConfig, usuarioActual, proyectos } = data;

  return (
    <DashboardProvider
      appConfig={appConfig}
      usuarioActual={usuarioActual}
      proyectos={proyectos}
    >
      <NavDrawerProvider>
        <SoporteProvider>
          <div className="flex min-h-screen flex-col bg-background">
            {/* El Navbar va primero y tiene z-50 */}
            <Navbar />

            <GlobalMantenimientoBanner />

            <div className="flex flex-1 relative overflow-hidden">
              {/* Sidebar desktop only — z-40, oculto en mobile */}
              <Sidebar />

              {/* Drawer mobile (Sheet) — visible solo < md, deriva contenido por URL */}
              <MobileDrawer empresaRef={appConfig?.empresa?.ref ?? ""} />

              {/* Contenido principal:
                - mobile: sin margen (sidebar oculto)
                - desktop (md+): ml-16 para dejar espacio al sidebar colapsado
              */}
              <main className="flex-1 overflow-auto bg-primary-bg p-4 md:ml-16 md:p-8">
                {children}
              </main>
            </div>

            <DebugPanel />
            {/* Modal de soporte — montado una sola vez, controlado por SoporteContext */}
            <SoporteModal />
          </div>
        </SoporteProvider>
      </NavDrawerProvider>
    </DashboardProvider>
  );
}