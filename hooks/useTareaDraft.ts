"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { RespuestasMap, RespuestaLetra } from "@/lib/tareas/types";

interface UseTareaDraftReturn {
  respuestas: RespuestasMap;
  setLetra: (letra: string, patch: Partial<RespuestaLetra>) => void;
  setRespuestas: (next: RespuestasMap) => void;
  resetDraft: () => void;
  isDirty: boolean;
  commitSnapshot: (next?: RespuestasMap) => void;
}

function clone(r: RespuestasMap): RespuestasMap {
  return JSON.parse(JSON.stringify(r ?? {})) as RespuestasMap;
}

function deepEqual(a: RespuestasMap, b: RespuestasMap): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function useTareaDraft(initial: RespuestasMap): UseTareaDraftReturn {
  const [respuestas, setRespuestasState] = useState<RespuestasMap>(() => clone(initial));
  const [snapshot, setSnapshot] = useState<RespuestasMap>(() => clone(initial));
  const snapshotRef = useRef<RespuestasMap>(clone(initial));

  const setLetra = useCallback((letra: string, patch: Partial<RespuestaLetra>) => {
    setRespuestasState((prev) => {
      const prevLetra: RespuestaLetra = prev[letra] ?? { aplica: true, contenido: "", borrador: "" };
      return { ...prev, [letra]: { ...prevLetra, ...patch } };
    });
  }, []);

  const setRespuestas = useCallback((next: RespuestasMap) => {
    setRespuestasState(clone(next));
  }, []);

  const resetDraft = useCallback(() => {
    setRespuestasState(clone(snapshotRef.current));
  }, []);

  const commitSnapshot = useCallback((next?: RespuestasMap) => {
    const committed = clone(next ?? respuestas);
    snapshotRef.current = committed;
    setSnapshot(committed);
  }, [respuestas]);

  const isDirty = useMemo(() => !deepEqual(respuestas, snapshot), [respuestas, snapshot]);

  return { respuestas, setLetra, setRespuestas, resetDraft, isDirty, commitSnapshot };
}
