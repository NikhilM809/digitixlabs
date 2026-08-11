/**
 * Import employee KRAs from Digitix Excel sheet (e.g. Akhil_APR26_JUL26.xlsx)
 *
 * Usage:
 *   npx tsx scripts/import-kra-from-excel.ts --file "C:\Users\HP\Downloads\Akhil_APR26_JUL26.xlsx" --employeeEmail user@company.com --finalize
 */
import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { parseKraExcelRows, validateParsedKraSheet } from "../src/lib/kra-excel";

function arg(name: string) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const file = arg("--file");
  const employeeEmail = arg("--employeeEmail");
  const adminEmail = arg("--adminEmail") ?? "admin@digitixlabs.com";
  const finalize = process.argv.includes("--finalize");
  const periodLabel = arg("--periodLabel");
  const remarks = arg("--remarks");

  if (!file || !employeeEmail) {
    console.error(
      "Usage: npx tsx scripts/import-kra-from-excel.ts --file sheet.xlsx --employeeEmail user@company.com [--finalize] [--periodLabel text] [--remarks text]"
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

  const sheet = parseKraExcelRows(rows);
  validateParsedKraSheet(sheet);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const employee = await prisma.user.findUnique({ where: { email: employeeEmail } });
    if (!employee) throw new Error(`Employee not found: ${employeeEmail}`);

    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) throw new Error(`Admin user not found: ${adminEmail}`);

    await prisma.employeeKra.deleteMany({ where: { userId: employee.id } });

    for (const [index, row] of sheet.rows.entries()) {
      await prisma.employeeKra.create({
        data: {
          userId: employee.id,
          name: row.name,
          measure: row.measure,
          weight: row.weight,
          sortOrder: row.serialNo ?? index,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }

    const configData = {
      periodLabel: periodLabel ?? sheet.periodLabel,
      remarks: remarks ?? null,
      isFinalized: finalize,
      finalizedAt: finalize ? new Date() : null,
      finalizedById: finalize ? admin.id : null,
    };

    await prisma.employeeKraConfig.upsert({
      where: { userId: employee.id },
      create: { userId: employee.id, ...configData },
      update: configData,
    });

    console.log(`Imported ${sheet.rows.length} KRAs for ${employeeEmail}`);
    console.log(`Weighted total: ${sheet.weightedTotal}%`);
    if (configData.periodLabel) console.log(`Period: ${configData.periodLabel}`);
    sheet.rows.forEach((row) => {
      const w = row.weight === null ? "N/A" : `${row.weight}%`;
      console.log(`  ${row.serialNo ?? "-"}. ${row.name} (${w})`);
      console.log(`     Measure: ${row.measure}`);
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
