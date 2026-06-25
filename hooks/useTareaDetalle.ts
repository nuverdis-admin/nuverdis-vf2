"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { RealtimePostgresUpdatePayload } from "@supabase/supabase-js"; // Asegúrate de tener la importación si no está en el archivo
interface RealtimeTareaPayload {
  version?: number;
  estado?: string;
  [key: string]: unknown;
}

export function useTareaDetalle(
  tareaId: number,
  localVersion: number,
  realtimeTable: string = "gri_tareas",
): { versionRemota: number | null; estadoRemoto: string | null; resetVersionRemota: () => void } {
  const [versionRemota, setVersionRemota] = useState<number | null>(null);
  const [estadoRemoto, setEstadoRemoto] = useState<string | null>(null);
  const localVersionRef = useRef(localVersion);
  localVersionRef.current = localVersion;

  useEffect(() => {
      const supabase = createClient();
      const channel: RealtimeChannel = supabase
        .channel(`tarea:${tareaId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: realtimeTable,
            filter: `tarea_id=eq.${tareaId}`,
          },
          // ✅ Tipamos el payload explícitamente como un evento de UPDATE de Supabase
          (payload: RealtimePostgresUpdatePayload<RealtimeTareaPayload>) => {
            const nuevo = payload.new as RealtimeTareaPayload;
            if (
              typeof nuevo.version === "number" &&
              nuevo.version > localVersionRef.current
            ) {
              setVersionRemota(nuevo.version);
              if (typeof nuevo.estado === "string") {
                setEstadoRemoto(nuevo.estado);
              }
            }
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
  }, [tareaId]);

  const resetVersionRemota = () => {
    setVersionRemota(null);
    setEstadoRemoto(null);
  };

  return { versionRemota, estadoRemoto, resetVersionRemota };
}
