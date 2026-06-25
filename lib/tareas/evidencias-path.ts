// Generador de path para evidencias en Storage (bucket fake o real).

export function generarPath(
  empresaRef: string,
  proyectoRef: string,
  j1: string | number | null,
  j2: string | number | null,
  nombreOriginal: string
): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const r = Math.floor(Math.random() * 10);
  const safe = nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
  const j1Safe = j1 === null || j1 === undefined ? "x" : String(j1);
  const j2Safe = j2 === null || j2 === undefined ? "x" : String(j2);
  return `ref_org/${empresaRef}/${proyectoRef}/${j1Safe}-${j2Safe}/${hh}${mm}${ss}_${r}_${safe}`;
}

export function isFakeBucket(): boolean {
  return process.env.NEXT_PUBLIC_EVIDENCIAS_BUCKET_FAKE === "true";
}

export function getExtension(nombre: string): string | null {
  const idx = nombre.lastIndexOf(".");
  if (idx === -1 || idx === nombre.length - 1) return null;
  return nombre.slice(idx + 1).toLowerCase();
}

export function humanizeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function iconoMimeColor(mime: string | null, nombreArchivo?: string): { letra: string; color: string } {
  // Validar por extensión primero
  if (nombreArchivo) {
    const ext = getExtension(nombreArchivo)?.toLowerCase();
    if (ext === "sql") return { letra: "SQL", color: "bg-info-5 text-white" };
  }

  if (!mime) return { letra: "?", color: "bg-gray-4 text-white" };
  if (mime.startsWith("image/")) return { letra: "IMG", color: "bg-success-5 text-white" };
  if (mime === "application/pdf") return { letra: "PDF", color: "bg-critique-5 text-white" };
  if (mime.startsWith("application/zip") || mime.includes("compressed"))
    return { letra: "ZIP", color: "bg-secondary-5 text-white" };
  if (mime.includes("word")) return { letra: "DOC", color: "bg-info-5 text-white" };
  if (mime.includes("excel") || mime.includes("sheet"))
    return { letra: "XLS", color: "bg-success-5 text-white" };
  if (mime.includes("sql")) return { letra: "SQL", color: "bg-info-5 text-white" };
  return { letra: "?", color: "bg-gray-4 text-white" };
}
