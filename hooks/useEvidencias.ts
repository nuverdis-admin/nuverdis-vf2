"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { generarPath, getExtension } from "@/lib/tareas/evidencias-path";
import { getSignedUploadUrl, getSignedDownloadUrl, deleteFromStorage } from "@/app/actions/evidencias";
import type { EvidenciaRow } from "@/lib/tareas/types";

export interface UploadInProgress {
  id: string;
  nombre: string;
  size: number;
  progress: number;
}

interface UploadParams {
  empresaRef: string;
  proyectoRef: string;
  j1: number | null;
  j2: number | null;
  tareaId: number;
  empresaId: number;
  proyectoId: number;
  uploaderUid: string;
  uploaderNombre: string;
}

interface UseEvidenciasReturn {
  evidencias: EvidenciaRow[];
  uploads: UploadInProgress[];
  upload: (files: File[], params: UploadParams) => Promise<void>;
  borrar: (ev: EvidenciaRow) => Promise<void>;
  descargar: (ev: EvidenciaRow, tareaId: number) => Promise<void>;
}

function xhrUpload(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

export function useEvidencias(
  initial: EvidenciaRow[],
  tareasTable: string = "gri_tareas",
  evidenciasTable: string = "evidencias",
): UseEvidenciasReturn {
  const [evidencias, setEvidencias] = useState<EvidenciaRow[]>(initial);
  const [uploads, setUploads] = useState<UploadInProgress[]>([]);

  const upload = useCallback(async (files: File[], params: UploadParams) => {
    const supabase = createClient();

    const items: UploadInProgress[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre: f.name,
      size: f.size,
      progress: 0,
    }));
    setUploads((prev) => [...prev, ...items]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tmp = items[i];
      const path = generarPath(params.empresaRef, params.proyectoRef, params.j1, params.j2, file.name);

      try {
        const { signedUrl } = await getSignedUploadUrl(path, params.tareaId, tareasTable);

        await xhrUpload(signedUrl, file, (pct) => {
          setUploads((prev) => prev.map((u) => (u.id === tmp.id ? { ...u, progress: pct } : u)));
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al subir";
        toast.error(`No se pudo subir ${file.name}: ${msg}`);
        setUploads((prev) => prev.filter((u) => u.id !== tmp.id));
        continue;
      }

      const insertRow = {
        tarea_id: params.tareaId,
        empresa_id: params.empresaId,
        proyecto_id: params.proyectoId,
        path,
        nombre_archivo: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        extension: getExtension(file.name),
        uploader_uid: params.uploaderUid,
        uploader_nombre: params.uploaderNombre,
      };

      const { data: created, error: insErr } = await supabase
        .from(evidenciasTable)
        .insert(insertRow)
        .select(
          "evidencia_id, public_id, tarea_id, empresa_id, proyecto_id, path, nombre_archivo, mime_type, size_bytes, extension, uploader_uid, uploader_nombre, created_at"
        )
        .single();

      if (insErr || !created) {
        toast.error(`No se pudo registrar ${file.name}: ${insErr?.message ?? "error desconocido"}`);
        setUploads((prev) => prev.filter((u) => u.id !== tmp.id));
        continue;
      }

      await supabase.rpc("log_usuario_accion", {
        p_accion: "CREATE_EVIDENCIA",
        p_tabla: evidenciasTable,
        p_registro_id: created.public_id,
        p_datos_prev: null,
        p_datos_new: {
          tarea_id: params.tareaId,
          nombre_archivo: file.name,
          size_bytes: file.size,
          path,
        },
        p_proyecto_id: params.proyectoId,
      });

      setEvidencias((prev) => [created as EvidenciaRow, ...prev]);
      setUploads((prev) => prev.map((u) => (u.id === tmp.id ? { ...u, progress: 100 } : u)));
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== tmp.id));
      }, 600);
    }
  }, []);

  const borrar = useCallback(async (ev: EvidenciaRow) => {
    try {
      await deleteFromStorage(ev.path, ev.tarea_id, tareasTable);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar archivo";
      toast.error(msg);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from(evidenciasTable).delete().eq("evidencia_id", ev.evidencia_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.rpc("log_usuario_accion", {
      p_accion: "DELETE_EVIDENCIA",
      p_tabla: evidenciasTable,
      p_registro_id: ev.public_id,
      p_datos_prev: {
        nombre_archivo: ev.nombre_archivo,
        path: ev.path,
        size_bytes: ev.size_bytes,
        uploader_uid: ev.uploader_uid,
      },
      p_datos_new: null,
      p_proyecto_id: ev.proyecto_id,
    });
    setEvidencias((prev) => prev.filter((e) => e.evidencia_id !== ev.evidencia_id));
    toast.success("Evidencia eliminada");
  }, []);

  const descargar = useCallback(async (ev: EvidenciaRow, tareaId: number) => {
    try {
      const url = await getSignedDownloadUrl(ev.path, tareaId, tareasTable);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al descargar";
      toast.error(msg);
    }
  }, []);

  return { evidencias, uploads, upload, borrar, descargar };
}
