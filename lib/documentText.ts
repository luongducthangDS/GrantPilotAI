import "server-only";

import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PDF_MIME = "application/pdf";

// Below this, a PDF's text layer is treated as "not really there" — a
// genuinely scanned/image-only PDF still yields a handful of stray
// characters from stray embedded fonts/artifacts, not real content. Neither
// route calling this has a way to read a PDF as an image (the vision model
// only accepts raster images via image_url, not raw PDF bytes), so a PDF
// that fails this bar has no reading path at all.
export const MIN_PDF_TEXT_CHARS = 40;

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractXlsxText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`# ${sheet.name}`);
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[])
        .slice(1)
        .map((value) => (value === null || value === undefined ? "" : String(value)));
      if (cells.some((cell) => cell.trim() !== "")) lines.push(cells.join(" | "));
    });
  });
  return lines.join("\n").trim();
}

// Most Vietnamese business forms (ĐKKD, KQKD) distributed as PDF are
// digitally generated with a real embedded text layer, not scans — pulling
// that text directly avoids needing a vision model and reads the WHOLE
// document at once, not just what a rasterized page happens to show.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

// Dispatches to the right extractor for a text-bearing (non-image) document
// mimeType. Returns null for a mimeType this module doesn't handle (the
// caller should fall back to treating it as an image instead).
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<string | null> {
  if (mimeType === DOCX_MIME) return extractDocxText(buffer);
  if (mimeType === XLSX_MIME) return extractXlsxText(buffer);
  if (mimeType === PDF_MIME) return extractPdfText(buffer);
  return null;
}
