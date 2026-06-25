"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  AuthChangeEvent,
  Session,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth";

export interface Notificacion {
  notif_id: number;
  user_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  leida_at: string | null;
  leida_eliminada_at: string | null;
  datos: Record<string, unknown> | null;
  created_at: string;
}

export function useNotifications() {
  const uid = useAuthStore((s) => s.usuarioActual?.uid);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  useEffect(() => {
    if (!uid) return;
    const supabase = createClient();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let authSub: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    (async () => {
      // CRÍTICO: con @supabase/ssr el token vive en cookies (lectura async).
      // Si llamamos subscribe() sin esto, el socket hace join como `anon`,
      // y `anon` NO tiene SELECT en notificaciones → realtime.subscription_check_filters
      // devuelve col_names vacío → "invalid column for filter user_id".
      // Hay que autenticar el socket con el JWT del usuario ANTES de subscribe().
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(session?.access_token ?? null);

      // Fetch inicial — RLS + .eq como doble barrera multitenant.
      // Excluir notifs que el job semanal marcó como ocultas (leida_eliminada_at != null)
      const { data } = await supabase
        .from("notificaciones")
        .select(
          "notif_id, user_id, tipo, titulo, mensaje, leida, leida_at, leida_eliminada_at, datos, created_at"
        )
        .eq("user_id", uid)
        .is("leida_eliminada_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setNotificaciones((data as Notificacion[]) ?? []);

      // Re-autenticar el socket en cualquier cambio de sesión (incluye el
      // refresh disparado por Server Actions). onAuthStateChange en
      // @supabase/ssr emite INITIAL_SESSION en montaje, por eso NO basta
      // con escuchar solo SIGNED_IN/TOKEN_REFRESHED.
      const { data: subData } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, s: Session | null) => {
          if (s?.access_token) {
            void supabase.realtime.setAuth(s.access_token);
          }
        }
      );
      authSub = subData.subscription;

      // Filtro server-side: el socket (ya autenticado) recibe SOLO las rows
      // donde user_id = uid. REPLICA IDENTITY FULL lo soporta para UPDATE.
      const filter = `user_id=eq.${uid}`;

      channel = supabase
        .channel(`notificaciones:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notificaciones",
            filter,
          },
          (payload: RealtimePostgresInsertPayload<Notificacion>) => {
            const nueva = payload.new;
            const notifConFecha: Notificacion = {
              ...nueva,
              created_at: nueva.created_at ?? new Date().toISOString(),
            };
            setNotificaciones((prev) =>
              [notifConFecha, ...prev].slice(0, 20)
            );
            toast.info(notifConFecha.titulo, {
              description: notifConFecha.mensaje,
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notificaciones",
            filter,
          },
          (payload: RealtimePostgresUpdatePayload<Notificacion>) => {
            const updated = payload.new;
            setNotificaciones((prev) =>
              prev.map((n) =>
                n.notif_id === updated.notif_id ? { ...n, ...updated } : n
              )
            );
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      authSub?.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [uid]);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  async function marcarLeida(notifId: number) {
    const supabase = createClient();
    const leida_at = new Date().toISOString();
    await supabase
      .from("notificaciones")
      .update({ leida: true, leida_at })
      .eq("notif_id", notifId);
    setNotificaciones((prev) =>
      prev.map((n) =>
        n.notif_id === notifId ? { ...n, leida: true, leida_at } : n
      )
    );
  }

  async function marcarTodasLeidas() {
    if (!uid) return;
    const supabase = createClient();
    const leida_at = new Date().toISOString();
    await supabase
      .from("notificaciones")
      .update({ leida: true, leida_at })
      .eq("user_id", uid)
      .eq("leida", false);
    setNotificaciones((prev) =>
      prev.map((n) => (n.leida ? n : { ...n, leida: true, leida_at }))
    );
  }

  const nuevas = notificaciones.filter((n) => !n.leida);
  const leidas = notificaciones.filter((n) => n.leida);

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, nuevas, leidas };
}
