import * as XLSX from "xlsx";

export type ExcelRow = Record<string, string | number | boolean | null | undefined>;

function rowLookup(row: ExcelRow) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
  );
}

function rawRowValue(row: ExcelRow, ...keys: string[]) {
  const normalized = rowLookup(row);
  for (const key of keys) {
    const val = normalized[normalizeHeader(key)];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return val;
    }
  }
  return undefined;
}

/** Parse Excel / spreadsheet date values (serial numbers, ISO, DD/MM/YYYY, etc.) */
export function parseExcelDate(
  value: string | number | boolean | null | undefined
): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const fromSerial = excelSerialToDate(value);
    if (fromSerial) return fromSerial;
    if (value > 1e12) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return utcDateOnly(d);
    }
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d+(\.\d+)?$/.test(str)) {
    const fromSerial = excelSerialToDate(Number(str));
    if (fromSerial) return fromSerial;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const ymd = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return utcDateOnly(parsed);
  }

  return null;
}

function utcDateOnly(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  // Excel serial dates for typical HR records (~1980–2100)
  if (serial >= 20000 && serial < 80000) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }
  return null;
}

export function hasRowValue(row: ExcelRow, ...keys: string[]): boolean {
  return rawRowValue(row, ...keys) !== undefined;
}

export function getRowDateValue(row: ExcelRow, ...keys: string[]): Date | null {
  const raw = rawRowValue(row, ...keys);
  if (raw === undefined) return null;
  return parseExcelDate(raw);
}

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
  const raw = rawRowValue(row, ...keys);
  if (raw === undefined) return "";
  return String(raw).trim();
}

export function parseOptionalNumber(value: string): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
