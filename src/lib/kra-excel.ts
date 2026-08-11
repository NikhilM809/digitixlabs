export interface ParsedKraRow {
  serialNo: number | null;
  name: string;
  measure: string;
  weight: number | null;
  isQualitative: boolean;
}

export interface ParsedKraSheet {
  periodLabel: string | null;
  rows: ParsedKraRow[];
  weightedTotal: number;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/\s+/g, " ");
}

function pickColumnIndex(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((h) => patterns.some((p) => p.test(h)));
}

function parseWeight(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!text || /^n\/a$/i.test(text) || text === "-") return null;
  const num = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function isSectionHeaderRow(row: (string | number)[], kraText: string, measureText: string) {
  if (!kraText) return true;
  if (/^(survey programming|senior programmer|project lead)/i.test(kraText) && !measureText) {
    return true;
  }
  if (/quarterly|mar 2026|apr|jul/i.test(kraText) && !measureText) return true;
  return false;
}

export function parseKraExcelRows(rows: (string | number)[][]): ParsedKraSheet {
  let periodLabel: string | null = null;

  for (const row of rows.slice(0, 8)) {
    const joined = row.map((c) => String(c ?? "")).join(" ");
    if (/quarterly|mar 2026|apr.*jul/i.test(joined) && joined.length > 20) {
      periodLabel = joined.trim();
      break;
    }
  }

  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    const hasKra = headers.some((h) => h === "kra" || /kra name|key result/.test(h));
    const hasMeasure = headers.some((h) => h === "measure" || h === "maesure" || /measure/.test(h));
    const hasWeight = headers.some((h) => h === "weight" || /weight/.test(h));
    return hasKra && hasMeasure && hasWeight;
  });

  if (headerRowIndex < 0) {
    throw new Error("Could not find KRA header row (expected S.No, KRA, Measure, Weight columns)");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const serialIdx = pickColumnIndex(headers, [/^s\.?no\.?$/, /^sr\.? no/, /^serial/]);
  const kraIdx = pickColumnIndex(headers, [/^kra$/, /^kra name$/, /key result/]);
  const measureIdx = pickColumnIndex(headers, [/^measure$/, /^maesure$/, /measure/]);
  const weightIdx = pickColumnIndex(headers, [/^weight$/, /^weightage$/, /weight/]);

  if (kraIdx < 0 || measureIdx < 0) {
    throw new Error(`Missing KRA or Measure column. Headers found: ${headers.join(", ")}`);
  }

  const parsed: ParsedKraRow[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    const name = String(row[kraIdx] ?? "").trim();
    const measure = String(row[measureIdx] ?? "").trim();
    if (!name || !measure) continue;
    if (isSectionHeaderRow(row, name, measure)) continue;

    const serialRaw = serialIdx >= 0 ? row[serialIdx] : null;
    const serialNo =
      serialRaw !== null && serialRaw !== "" && !Number.isNaN(Number(serialRaw))
        ? Number(serialRaw)
        : null;

    const weight = weightIdx >= 0 ? parseWeight(row[weightIdx]) : null;

    parsed.push({
      serialNo,
      name,
      measure,
      weight,
      isQualitative: weight === null,
    });
  }

  if (parsed.length === 0) {
    throw new Error("No KRA data rows found in the sheet");
  }

  const weightedTotal = parsed
    .filter((r) => r.weight !== null)
    .reduce((sum, r) => sum + (r.weight ?? 0), 0);

  return { periodLabel, rows: parsed, weightedTotal };
}

export function validateParsedKraSheet(sheet: ParsedKraSheet) {
  const weighted = sheet.rows.filter((r) => r.weight !== null);
  if (weighted.length === 0) {
    throw new Error("At least one weighted KRA is required");
  }
  if (Math.abs(sheet.weightedTotal - 100) > 0.05) {
    throw new Error(
      `Weighted KRAs total ${sheet.weightedTotal}% — expected 100% (qualitative KRAs are excluded)`
    );
  }
}
