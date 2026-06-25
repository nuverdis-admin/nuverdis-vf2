"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMensaje } from "@/lib/tareas/types";

interface Props {
  mensajes: ChatMensaje[];
  cargando: boolean;
  uid: string;
  onEnviar: (contenido: string) => Promise<void>;
  onVisible: () => void;
}

export function ChatPanel({ mensajes, cargando, uid, onEnviar, onVisible }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      onVisible();
    }
  }, [onVisible]);

  async function handleEnviar() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    await onEnviar(texto.trim());
    setTexto("");
    setEnviando(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleEnviar();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-56 flex-col gap-2 overflow-y-auto rounded-lg border border-gray-2 bg-gray-1 p-3">
        {cargando ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-xs text-gray-4">Cargando mensajes…</span>
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-center text-xs text-gray-4">
              Sin mensajes aún.
              <br />
              Sé el primero en escribir.
            </span>
          </div>
        ) : (
          <>
            {mensajes.map((m) => {
              const esPropio = m.uid === uid;
              return (
                <div
                  key={m.mensaje_id}
                  className={`flex flex-col ${esPropio ? "items-end" : "items-start"}`}
                >
                  {!esPropio && (
                    <span className="mb-0.5 text-[10px] font-semibold text-gray-5">
                      {m.nombre}
                    </span>
                  )}
                  <div
                    className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-sm ${
                      esPropio
                        ? "bg-primary-1 text-primary-8"
                        : "border border-gray-2 bg-white text-gray-8 shadow-sm"
                    }`}
                  >
                    {m.contenido}
                  </div>
                  <span className="mt-0.5 text-[9px] text-gray-4">
                    {new Date(m.created_at).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje… (Enter para enviar)"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-gray-2 bg-white px-3 py-2 text-sm text-gray-8 placeholder:text-gray-4 focus:border-primary-4 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleEnviar()}
          disabled={!texto.trim() || enviando}
          className="btn btn-primary self-end px-3 text-xs disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
