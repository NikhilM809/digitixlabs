/**
 * Import employee KRAs from an Excel KRA sheet.
 *
 * Usage:
 *   npx tsx scripts/import-kra-from-excel.ts --file "path/to/sheet.xlsx" --employeeEmail priya.sharma@digitixlabs.com
 *
 * Expected columns (flexible header matching):
 *   - KRA Name / Key Result Area / Objective
 *   - Measure / Measurement / KPI
 *   - Weight / Weightage / Weight (%)
 */
import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function arg(name: string) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/\s+/g, " ");
}

function pickColumn(headers: string[], patterns: RegExp[]) {
  return headers.find((h) => patterns.some((p) => p.test(h)));
}

async function main() {
  const file = arg("--file");
  const employeeEmail = arg("--employeeEmail");
  const adminEmail = arg("--adminEmail") ?? "admin@digitixlabs.com";
  const finalize = process.argv.includes("--finalize");

  if (!file || !employeeEmail) {
    console.error(
      "Usage: npx tsx scripts/import-kra-from-excel.ts --file sheet.xlsx --employeeEmail user@company.com [--finalize]"
    );
    process.exit(1);
  }

  const absPath = path.resolve(file);
  const workbook = XLSX.read(readFileSync(absPath), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => /kra|measure|weight|objective|key result/i.test(String(cell)))
  );
  if (headerRowIndex < 0) {
    throw new Error("Could not find KRA header row in the Excel sheet");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const nameKey = pickColumn(headers, [
    /^kra name$/,
    /^key result area$/,
    /^kra$/,
    /^objective$/,
    /kra name/,
    /key result/,
  ]);
  const measureKey = pickColumn(headers, [/^measure$/, /^measurement$/, /^kpi$/, /measure/]);
  const weightKey = pickColumn(headers, [/^weight$/, /^weightage$/, /weight/]);

  if (!nameKey || !measureKey || !weightKey) {
    throw new Error(
      `Missing columns. Found headers: ${headers.join(", ")}. Need KRA Name, Measure, and Weight.`
    );
  }

  const nameIdx = headers.indexOf(nameKey);
  const measureIdx = headers.indexOf(measureKey);
  const weightIdx = headers.indexOf(weightKey);

  const kraRows = rows
    .slice(headerRowIndex + 1)
    .map((row) => ({
      name: String(row[nameIdx] ?? "").trim(),
      measure: String(row[measureIdx] ?? "").trim(),
      weight: Number(String(row[weightIdx] ?? "").replace(/[^\d.]/g, "")),
    }))
    .filter((row) => row.name && row.measure && row.weight > 0);

  if (kraRows.length === 0) {
    throw new Error("No KRA rows found below the header");
  }

  const totalWeight = kraRows.reduce((sum, row) => sum + row.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.05) {
    throw new Error(`KRA weights total ${totalWeight}% — expected 100%`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const employee = await prisma.user.findUnique({ where: { email: employeeEmail } });
    if (!employee) throw new Error(`Employee not found: ${employeeEmail}`);

    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) throw new Error(`Admin user not found: ${adminEmail}`);

    await prisma.employeeKra.deleteMany({ where: { userId: employee.id } });

    for (const [index, row] of kraRows.entries()) {
      await prisma.employeeKra.create({
        data: {
          userId: employee.id,
          name: row.name,
          measure: row.measure,
          weight: row.weight,
          sortOrder: index,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }

    if (finalize) {
      await prisma.employeeKraConfig.upsert({
        where: { userId: employee.id },
        create: {
          userId: employee.id,
          isFinalized: true,
          finalizedAt: new Date(),
          finalizedById: admin.id,
        },
        update: {
          isFinalized: true,
          finalizedAt: new Date(),
          finalizedById: admin.id,
        },
      });
    } else {
      await prisma.employeeKraConfig.upsert({
        where: { userId: employee.id },
        create: { userId: employee.id, isFinalized: false },
        update: { isFinalized: false, finalizedAt: null, finalizedById: null },
      });
    }

    console.log(`Imported ${kraRows.length} KRAs for ${employeeEmail}`);
    kraRows.forEach((row) => console.log(`  - ${row.name} (${row.weight}%): ${row.measure}`));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
