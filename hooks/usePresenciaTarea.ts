"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PresenciaUser } from "@/lib/tareas/types";

export function usePresenciaTarea(
  publicId: string,
  me: { uid: string; nombre: string; rol: string }
): { presentes: PresenciaUser[] } {
  const [presentes, setPresentes] = useState<PresenciaUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    const supabase = createClient();
    
    // 1. OBLIGATORIO: El nombre del canal debe ser idéntico para todos los usuarios.
    // NUNCA uses Date.now() aquí, o aislarás a cada usuario en su propio canal.
    const channelName = `presencia:tarea:${publicId}`;
    
    const channel = supabase.channel(channelName, {
      config: { presence: { key: meRef.current.uid } },
    });
    channelRef.current = channel;

    function actualizarPresentes() {
      const state = channel.presenceState() as RealtimePresenceState<PresenciaUser>;

      // 2. Deduplicación en el cliente: Tomamos solo la primera conexión [0] de cada usuario
      // para ignorar conexiones "fantasma" que quedan colgadas tras un F5.
      const lista: PresenciaUser[] = Object.values(state)
        .map((conexiones: PresenciaUser[]) => conexiones[0])
        .filter((u: PresenciaUser | undefined): u is PresenciaUser => u !== undefined && u.uid !== meRef.current.uid);

      setPresentes(lista);
    }

    channel
      .on("presence", { event: "sync" }, actualizarPresentes)
      .on("presence", { event: "join" }, actualizarPresentes)
      .on("presence", { event: "leave" }, actualizarPresentes)
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            uid: meRef.current.uid,
            nombre: meRef.current.nombre,
            rol: meRef.current.rol,
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      // 3. CLEANUP: Ejecutamos el untrack en el fondo (fire-and-forget) para avisar a Supabase.
      void channel.untrack().catch(() => undefined);
      
      // Destruimos el canal de la memoria local INMEDIATAMENTE de forma síncrona.
      // Esto evita el error "cannot add presence callbacks after subscribe" si el 
      // componente se desmonta y remonta rápidamente (ej. al cambiar la versión de la tarea).
      void supabase.removeChannel(channel);
    };
  }, [publicId]);

  return { presentes };
}