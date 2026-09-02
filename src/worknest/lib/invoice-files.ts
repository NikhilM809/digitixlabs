import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const INVOICE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "invoices");
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export function invoicePdfPath(id: string) {
  return path.join("uploads", "invoices", `${id}.pdf`);
}

export async function saveInvoicePdf(id: string, file: File) {
  if (!file || file.size === 0) return { error: "Choose a PDF invoice to upload." };
  if (file.type && file.type !== "application/pdf") {
    return { error: "Upload a PDF file." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Upload a PDF file." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "The PDF must be 15 MB or smaller." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "%PDF") {
    return { error: "That file is not a valid PDF." };
  }
  await mkdir(INVOICE_UPLOAD_DIR, { recursive: true });
  const relative = invoicePdfPath(id);
  await writeFile(path.join(process.cwd(), relative), bytes);
  return { path: relative };
}

export async function readInvoicePdf(relativePath: string) {
  if (!relativePath) return null;
  try {
    return await readFile(path.join(process.cwd(), relativePath));
  } catch {
    return null;
  }
}
