"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

type Tab = "nuevas" | "leidas";

export function NotificationBell() {
  const router = useRouter();
  const { noLeidas, marcarLeida, marcarTodasLeidas, nuevas, leidas } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("nuevas");

  async function handleClick(notifId: number, link?: string) {
    await marcarLeida(notifId);
    if (link) {
      setIsOpen(false);
      router.push(link);
    }
  }

  const lista = tab === "nuevas" ? nuevas : leidas;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="relative rounded-full p-2 transition-colors hover:bg-primary-2"
        title="Notificaciones"
        aria-label={
          noLeidas > 0 ? `${noLeidas} notificaciones sin leer` : "Notificaciones"
        }
      >
        <svg
          className="h-5 w-5 text-gray-9"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-critique-6 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-2 flex w-80 flex-col overflow-hidden rounded-lg border border-gray-2 bg-white shadow-modal">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-2 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-9">Notificaciones</h3>
              {noLeidas > 0 && tab === "nuevas" && (
                <button
                  type="button"
                  onClick={marcarTodasLeidas}
                  className="text-xs text-primary-6 hover:underline"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 border-b border-gray-2">
              <button
                type="button"
                onClick={() => setTab("nuevas")}
                className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                  tab === "nuevas"
                    ? "border-b-2 border-primary-5 text-primary-6"
                    : "text-gray-5 hover:text-gray-8"
                }`}
              >
                Nuevas
                {noLeidas > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-critique-6 px-1 text-[10px] font-bold text-white">
                    {noLeidas > 9 ? "9+" : noLeidas}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("leidas")}
                className={`flex flex-1 items-center justify-center px-4 py-2 text-xs font-semibold transition-colors ${
                  tab === "leidas"
                    ? "border-b-2 border-primary-5 text-primary-6"
                    : "text-gray-5 hover:text-gray-8"
                }`}
              >
                Leídas
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-80 flex-1 overflow-y-auto">
              {lista.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-5">
                  {tab === "nuevas"
                    ? "Sin notificaciones nuevas"
                    : "Sin notificaciones leídas"}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-1">
                  {lista.map((notif) => {
                    const link =
                      notif.datos && typeof notif.datos.link === "string"
                        ? notif.datos.link
                        : undefined;
                    return (
                      <button
                        key={notif.notif_id}
                        type="button"
                        onClick={() => handleClick(notif.notif_id, link)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-gray-1"
                      >
                        {!notif.leida && (
                          <span className="mb-1 inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-primary-5" />
                            <span className="text-[10px] font-semibold text-primary-6">
                              Nueva
                            </span>
                          </span>
                        )}
                        <p className="text-sm font-semibold text-gray-9">
                          {notif.titulo}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-5">
                          {notif.mensaje}
                        </p>
                        <p className="mt-1 text-xs text-gray-4">
                          {new Date(notif.created_at).toLocaleString("es-CL")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
