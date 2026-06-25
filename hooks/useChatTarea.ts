"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ChatMensaje } from "@/lib/tareas/types";
import { RealtimePostgresInsertPayload } from "@supabase/supabase-js"; // Asegúrate de tener la importación si no la tienes

const PAGE_SIZE = 50;

export interface UseChatTareaReturn {
  mensajes: ChatMensaje[];
  cargando: boolean;
  noLeidos: number;
  enviar: (contenido: string) => Promise<void>;
  marcarLeido: () => Promise<void>;
}

export function useChatTarea(
  tareaId: number,
  uid: string,
  empresaId: number,
  mensajesTable: string = "tarea_mensajes",
  lecturasTable: string = "tarea_lecturas"
): UseChatTareaReturn {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [noLeidos, setNoLeidos] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function cargar() {
      setCargando(true);

      const [mensajesRes, lecturaRes] = await Promise.all([
        supabase
          .from(mensajesTable)
          .select("*")
          .eq("tarea_id", tareaId)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
        supabase
          .from(lecturasTable)
          .select("ultima_lectura")
          .eq("tarea_id", tareaId)
          .eq("uid", uid)
          .maybeSingle(),
      ]);

      const lista = ((mensajesRes.data ?? []) as ChatMensaje[]).reverse();
      setMensajes(lista);

      const ultimaLectura = lecturaRes.data?.ultima_lectura ?? null;
      if (ultimaLectura) {
        const noL = lista.filter(
          (m) => m.created_at > ultimaLectura && m.uid !== uid
        ).length;
        setNoLeidos(noL);
      } else {
        setNoLeidos(lista.filter((m) => m.uid !== uid).length);
      }

      setCargando(false);
    }
    void cargar();

        const channel = supabase
        .channel(`chat:${mensajesTable}:${tareaId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: mensajesTable,
            filter: `tarea_id=eq.${tareaId}`,
          },
          // ✅ Tipamos el objeto payload explícitamente usando la interfaz del SDK de Supabase
          (payload: RealtimePostgresInsertPayload<ChatMensaje>) => {
            const nuevo = payload.new as ChatMensaje;
            setMensajes((prev) => [...prev, nuevo]);
            if (nuevo.uid !== uid) {
              setNoLeidos((n) => n + 1);
            }
          }
        )
        .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tareaId, uid, mensajesTable, lecturasTable]);

  const enviar = useCallback(
    async (contenido: string) => {
      const supabase = createClient();
      await supabase.from(mensajesTable).insert({
        tarea_id: tareaId,
        empresa_id: empresaId,
        uid,
        contenido: contenido.trim(),
      });
    },
    [tareaId, empresaId, uid]
  );

  const marcarLeido = useCallback(async () => {
    const supabase = createClient();
    await supabase.from(lecturasTable).upsert(
      { tarea_id: tareaId, uid, ultima_lectura: new Date().toISOString() },
      { onConflict: "tarea_id,uid" }
    );
    setNoLeidos(0);
  }, [tareaId, uid]);

  return { mensajes, cargando, noLeidos, enviar, marcarLeido };
}
