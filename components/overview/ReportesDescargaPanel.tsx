"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { generarReporteGRI } from "@/app/actions/generar-reporte-gri";
import { generarReporteNCG } from "@/app/actions/generar-reporte-ncg";
import { descargarBlob } from "@/lib/reportes/descargar-blob";

interface Props {
  proyectoId: number;
  esAdmin: boolean;
  totalTareas: number;
  tareasActivas: number;
  totalTareasNcg?: number;
  tareasActivasNcg?: number;
}

export function ReportesDescargaPanel({
  proyectoId,
  esAdmin,
  totalTareas,
  tareasActivas,
  totalTareasNcg = 0,
  tareasActivasNcg = 0,
}: Props) {
  if (!esAdmin) return null;

  const [loadingGri, setLoadingGri] = useState(false);
  const [loadingNcg, setLoadingNcg] = useState(false);

  const griClickCountRef = useRef(0);
  const griClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ncgClickCountRef = useRef(0);
  const ncgClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const umbralGri = Math.ceil(totalTareas * 0.25);
  const cumpleUmbralGri = tareasActivas >= umbralGri;

  const umbralNcg = Math.ceil(totalTareasNcg * 0.25);
  const cumpleUmbralNcg = tareasActivasNcg >= umbralNcg;
  const tieneNcg = totalTareasNcg > 0;

  async function handleClickGri() {
    griClickCountRef.current += 1;
    if (griClickTimerRef.current) clearTimeout(griClickTimerRef.current);
    const saltarRegla = griClickCountRef.current >= 2;
    griClickTimerRef.current = setTimeout(() => { griClickCountRef.current = 0; }, 400);

    if (!cumpleUmbralGri && !saltarRegla) {
      toast.warning(
        `Se requiere que al menos el 25% del reporte GRI esté iniciado (${tareasActivas} de ${umbralGri} necesarias). Haz doble-click para omitir en desarrollo.`
      );
      return;
    }

    setLoadingGri(true);
    try {
      const res = await generarReporteGRI(proyectoId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        descargarBlob(res.buffer, res.filename);
        toast.success("Reporte GRI generado correctamente.");
      }
    } finally {
      setLoadingGri(false);
    }
  }

  async function handleClickNcg() {
    ncgClickCountRef.current += 1;
    if (ncgClickTimerRef.current) clearTimeout(ncgClickTimerRef.current);
    const saltarRegla = ncgClickCountRef.current >= 2;
    ncgClickTimerRef.current = setTimeout(() => { ncgClickCountRef.current = 0; }, 400);

    if (!cumpleUmbralNcg && !saltarRegla) {
      toast.warning(
        `Se requiere que al menos el 25% del reporte NCG esté iniciado (${tareasActivasNcg} de ${umbralNcg} necesarias). Haz doble-click para omitir en desarrollo.`
      );
      return;
    }

    setLoadingNcg(true);
    try {
      const res = await generarReporteNCG(proyectoId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        descargarBlob(res.buffer, res.filename);
        toast.success("Reporte NCG generado correctamente.");
      }
    } finally {
      setLoadingNcg(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-3 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-8">Reportes descargables</h3>
      <div className="flex flex-wrap gap-3">
        {/* GRI */}
        {totalTareas > 0 && (
          <button
            onClick={() => void handleClickGri()}
            disabled={loadingGri}
            className="btn btn-primary flex items-center gap-2 rounded-lg disabled:opacity-60"
          >
            {loadingGri ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loadingGri ? "Generando reporte..." : "Descargar GRI"}
          </button>
        )}

        {/* NCG */}
        {tieneNcg && (
          <button
            onClick={() => void handleClickNcg()}
            disabled={loadingNcg}
            className="btn btn-outline flex items-center gap-2 rounded-lg disabled:opacity-60"
          >
            {loadingNcg ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loadingNcg ? "Generando reporte..." : "Descargar NCG"}
          </button>
        )}

        {/* SASB — pendiente */}
        <button
          disabled
          title="Próximamente"
          className="btn btn-outline flex cursor-not-allowed items-center gap-2 rounded-lg opacity-40"
        >
          <FileText className="h-4 w-4" />
          SASB
          <span className="badge-warning ml-1 rounded-full px-2 py-0.5 text-xs">Próximamente</span>
        </button>
      </div>

      {totalTareas > 0 && !cumpleUmbralGri && (
        <p className="mt-3 text-xs text-warning-7">
          GRI: {tareasActivas}/{umbralGri} tareas iniciadas para alcanzar el 25% mínimo.
        </p>
      )}
      {tieneNcg && !cumpleUmbralNcg && (
        <p className="mt-2 text-xs text-warning-7">
          NCG: {tareasActivasNcg}/{umbralNcg} tareas iniciadas para alcanzar el 25% mínimo.
        </p>
      )}
    </div>
  );
}
