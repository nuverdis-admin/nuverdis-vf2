import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Packer,
  Table,
} from "docx";
import type { NcgReporteData, NcgReporteItem } from "./types-reporte";
import { NCG_TABLAS_CONFIG } from "./ncg-tablas-config";
import { buildGriTable } from "./gri-table-builder";
import type { GriTableData } from "@/lib/tareas/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTableDataSafe(raw: string, tableId: string): GriTableData | null {
  try {
    if (!NCG_TABLAS_CONFIG[tableId]) return null;
    if (!raw || raw.trim() === "") return null;
    const parsed = JSON.parse(raw) as GriTableData;
    if (!parsed.rows || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function emptyParagraph(): Paragraph {
  return new Paragraph({ text: "" });
}

// ─── Requerimiento renderer ───────────────────────────────────────────────────

function renderRequerimiento(
  item: NcgReporteItem,
  req: NcgReporteItem["requerimientos"][number]
): Array<Paragraph | Table> {
  const respuesta = item.respuestas[req.letra];
  const aplica = respuesta?.aplica !== false;
  if (!aplica) return [];

  const result: Array<Paragraph | Table> = [];

  // Subtema como sub-encabezado cuando existe
  if (req.subtema_nombre) {
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: req.subtema_nombre, bold: true, size: 20, color: "444444" }),
        ],
        spacing: { before: 160, after: 60 },
      })
    );
  }

  // Encabezado de letra
  result.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${req.letra}) `, bold: true, size: 20 }),
        new TextRun({ text: req.requerimiento_letra, bold: true, size: 20 }),
      ],
      spacing: { before: req.subtema_nombre ? 60 : 120, after: 60 },
    })
  );

  if (item.estado === "no_aplica") {
    result.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Esta respuesta fue marcada como no aplica.",
            italics: true,
            color: "888888",
            size: 18,
          }),
        ],
        spacing: { before: 40, after: 80 },
      })
    );
    return result;
  }

  const contenido = respuesta?.contenido ?? "";

  // Tabla NCG
  if (req.tabla && typeof req.tabla === "string") {
    const config = NCG_TABLAS_CONFIG[req.tabla];
    const tableData = parseTableDataSafe(contenido, req.tabla);
    if (config && tableData) {
      result.push(buildGriTable(config, tableData));
      result.push(emptyParagraph());
    } else {
      result.push(
        new Paragraph({
          children: [new TextRun({ text: contenido || "Sin contenido.", size: 18, color: "666666" })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 40, after: 80 },
        })
      );
    }
    return result;
  }

  // Texto libre
  result.push(
    new Paragraph({
      children: [
        new TextRun({
          text: contenido.trim() === "" ? "Sin contenido." : contenido,
          size: 18,
          color: contenido.trim() === "" ? "999999" : "000000",
        }),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 40, after: 80 },
    })
  );

  return result;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildNcgDocx(data: NcgReporteData): Promise<Uint8Array> {
  const children: Array<Paragraph | Table> = [];

  // ── Portada ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: "REPORTE NCG",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: data.empresa.nombre, bold: true, size: 28 }),
        new TextRun({ text: " — ", size: 28 }),
        new TextRun({ text: data.proyecto.nombre_proyecto, size: 28 }),
        new TextRun({ text: ` (${data.proyecto.anio_reporte})`, size: 28, color: "555555" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generado el ${new Date(data.generado_at).toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })} por ${data.generado_por}`,
          italics: true,
          size: 18,
          color: "777777",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ── Cuerpo jerárquico ────────────────────────────────────────────────────
  let lastEstandar = -1;
  let lastJ1 = "";
  let lastJ2 = -1;

  for (const item of data.items) {
    // H1: cambia el estándar
    if (item.estandar !== lastEstandar) {
      lastEstandar = item.estandar;
      lastJ1 = "";
      lastJ2 = -1;
      children.push(
        new Paragraph({
          text: `NCG ${item.estandar} — ${item.estandar_nombre}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 160 },
        })
      );
    }

    // H2: cambia jerarquia_1 (dentro del mismo estándar)
    if (item.jerarquia_1 !== lastJ1) {
      lastJ1 = item.jerarquia_1;
      lastJ2 = -1;
      children.push(
        new Paragraph({
          text: `${item.jerarquia_1} ${item.jerarquia_1_nombre}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 },
        })
      );
    }

    // H3: solo cuando hay sub-ítem (j2 > 0) y cambia
    if (item.jerarquia_2 > 0 && item.jerarquia_2 !== lastJ2) {
      lastJ2 = item.jerarquia_2;
      children.push(
        new Paragraph({
          text: `${item.jerarquia_real} ${item.jerarquia_2_nombre ?? ""}`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
        })
      );
    }

    // Requerimientos
    for (const req of item.requerimientos) {
      for (const el of renderRequerimiento(item, req)) {
        children.push(el);
      }
    }
  }

  const doc = new Document({
    sections: [{ children: children as Paragraph[] }],
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 20 },
        },
      ],
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
