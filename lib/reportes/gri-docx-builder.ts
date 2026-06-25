import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Packer,
} from "docx";
import type { ReporteData, ReporteItem } from "./types-reporte";
import { GRI_TABLAS_CONFIG } from "./gri-tablas-config";
import { buildGriTable } from "./gri-table-builder";
import type { GriTableData } from "@/lib/tareas/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseGriTableDataSafe(raw: string, tableId: string): GriTableData | null {
  try {
    const config = GRI_TABLAS_CONFIG[tableId];
    if (!config) return null;
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
  item: ReporteItem,
  req: ReporteItem["requerimientos"][number]
): Array<Paragraph | ReturnType<typeof buildGriTable>> {
  const respuesta = item.respuestas[req.letra];
  const aplica = respuesta?.aplica !== false;
  if (!aplica) return [];

  const result: Array<Paragraph | ReturnType<typeof buildGriTable>> = [];

  // Encabezado de letra
  result.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${req.letra}) `, bold: true, size: 20 }),
        new TextRun({ text: req.requerimiento_letra, bold: true, size: 20 }),
      ],
      spacing: { before: 120, after: 60 },
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

  // Tabla GRI
  if (req.tabla && typeof req.tabla === "string") {
    const config = GRI_TABLAS_CONFIG[req.tabla];
    const tableData = parseGriTableDataSafe(contenido, req.tabla);
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

export async function buildGriDocx(data: ReporteData): Promise<Uint8Array> {
  const children: Array<Paragraph | ReturnType<typeof buildGriTable>> = [];

  // ── Portada ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: "REPORTE GRI",
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
  let lastEstandar = "";
  let lastJ1 = -1;

  for (const item of data.items) {
    // Heading 1 cuando cambia el estándar
    if (item.estandar !== lastEstandar) {
      lastEstandar = item.estandar;
      lastJ1 = -1;
      children.push(
        new Paragraph({
          text: `GRI ${item.estandar}: ${item.jerarquia_1_nombre}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 160 },
        })
      );
    }

    // Heading 2 cuando cambia jerarquia_2
    if (item.jerarquia_2 !== lastJ1) {
      lastJ1 = item.jerarquia_2;
      children.push(
        new Paragraph({
          text: `${item.estandar}-${item.jerarquia_2} ${item.jerarquia_2_nombre}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );
    }

    // Requerimientos
    for (const req of item.requerimientos) {
      const rendered = renderRequerimiento(item, req);
      for (const el of rendered) {
        children.push(el);
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        children: children as Paragraph[],
      },
    ],
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
