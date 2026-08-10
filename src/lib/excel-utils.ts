import * as XLSX from "xlsx";

export type ExcelRow = Record<string, string | number | boolean | null | undefined>;

export function parseExcelBuffer(buffer: ArrayBuffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "" });
}

export function buildExcelBuffer(rows: ExcelRow[], sheetName = "Sheet1"): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function getRowValue(row: ExcelRow, ...keys: string[]): string {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
  );
  for (const key of keys) {
    const val = normalized[normalizeHeader(key)];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
}

export function parseOptionalNumber(value: string): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
