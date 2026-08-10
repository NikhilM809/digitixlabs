import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, createAuditLog } from "@/lib/api-utils";
import { isAdmin, canBulkImportLeave } from "@/lib/permissions";
import { buildExcelBuffer, getRowValue, parseOptionalNumber } from "@/lib/excel-utils";
import { computeLeaveBalancesForUser } from "@/lib/leave-balance";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!isAdmin(user.role)) {
    return apiError("Forbidden", 403);
  }

  const year = parseInt(
    request.nextUrl.searchParams.get("year") || String(new Date().getFullYear()),
    10
  );
  const templateOnly = request.nextUrl.searchParams.get("template") === "true";

  if (templateOnly) {
    const buffer = buildExcelBuffer(
      [
        {
          "Employee ID": "DXL0003",
          "Leave Type Code": "CL",
          Year: year,
          "Total Days": 12,
          "Used Days": 2,
        },
      ],
      "LeaveBalanceTemplate"
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leave-balance-template-${year}.xlsx"`,
      },
    });
  }

  const employees = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { not: "ADMIN" } },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
    orderBy: { employeeId: "asc" },
  });

  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
    select: { code: true },
  });

  const rows: Record<string, string | number>[] = [];

  for (const emp of employees) {
    const balances = await computeLeaveBalancesForUser(emp.id, year);
    for (const b of balances) {
      if (b.leaveType.defaultDays <= 0 && b.totalDays <= 0) continue;
      rows.push({
        "Employee ID": emp.employeeId,
        "Employee Name": `${emp.firstName} ${emp.lastName}`,
        "Leave Type Code": b.leaveType.code,
        Year: year,
        "Total Days": b.totalDays,
        "Used Days": b.usedDays,
        Pending: b.pendingDays,
        Remaining: b.availableDays,
      });
    }
  }

  if (rows.length === 0) {
    for (const lt of leaveTypes) {
      rows.push({
        "Employee ID": "",
        "Leave Type Code": lt.code,
        Year: year,
        "Total Days": "",
        "Used Days": "",
      });
    }
  }

  const buffer = buildExcelBuffer(rows, `LeaveBalances${year}`);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leave-balances-${year}.xlsx"`,
    },
  });
}

interface ImportRow {
  employeeId: string;
  leaveTypeCode: string;
  year: number;
  totalDays: number;
  usedDays?: number;
}

interface RowError {
  row: number;
  message: string;
}

async function validateImportRows(rows: ImportRow[]): Promise<{
  errors: RowError[];
  validRows: (ImportRow & { userId: string; leaveTypeId: string })[];
}> {
  const errors: RowError[] = [];
  const validRows: (ImportRow & { userId: string; leaveTypeId: string })[] = [];
  const seen = new Set<string>();

  const [employees, leaveTypes] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, employeeId: true },
    }),
    prisma.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    }),
  ]);

  const empMap = new Map(employees.map((e) => [e.employeeId.toUpperCase(), e]));
  const ltMap = new Map(leaveTypes.map((lt) => [lt.code.toUpperCase(), lt]));

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const key = `${row.employeeId}:${row.leaveTypeCode}:${row.year}`;
    if (seen.has(key)) {
      errors.push({ row: rowNum, message: `Duplicate entry for ${row.employeeId} / ${row.leaveTypeCode}` });
      return;
    }
    seen.add(key);

    const emp = empMap.get(row.employeeId.toUpperCase());
    if (!emp) {
      errors.push({ row: rowNum, message: `Employee ID ${row.employeeId} does not exist` });
      return;
    }

    const lt = ltMap.get(row.leaveTypeCode.toUpperCase());
    if (!lt) {
      errors.push({ row: rowNum, message: `Leave type code ${row.leaveTypeCode} is invalid` });
      return;
    }

    if (row.totalDays < 0) {
      errors.push({ row: rowNum, message: "Total days cannot be negative" });
      return;
    }

    if (row.usedDays !== undefined && row.usedDays < 0) {
      errors.push({ row: rowNum, message: "Used days cannot be negative" });
      return;
    }

    validRows.push({
      ...row,
      userId: emp.id,
      leaveTypeId: lt.id,
    });
  });

  return { errors, validRows };
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canBulkImportLeave(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const confirm = formData.get("confirm") === "true";

    if (!file || !(file instanceof Blob)) {
      return apiError("Excel file is required", 400);
    }

    const { parseExcelBuffer } = await import("@/lib/excel-utils");
    const buffer = await file.arrayBuffer();
    const rawRows = parseExcelBuffer(buffer);

    const importRows = rawRows
      .map((row): ImportRow | null => {
        const employeeId = getRowValue(row, "Employee ID", "employee_id", "employeeId");
        const leaveTypeCode = getRowValue(row, "Leave Type Code", "leave_type_code", "leaveTypeCode");
        const yearStr = getRowValue(row, "Year", "year");
        const totalStr = getRowValue(row, "Total Days", "total_days", "totalDays");
        const usedStr = getRowValue(row, "Used Days", "used_days", "usedDays");

        if (!employeeId && !leaveTypeCode) return null;

        const year = parseOptionalNumber(yearStr) ?? new Date().getFullYear();
        const totalDays = parseOptionalNumber(totalStr);
        if (totalDays === null) return null;

        const usedParsed = parseOptionalNumber(usedStr);
        const rowData: ImportRow = {
          employeeId,
          leaveTypeCode,
          year,
          totalDays,
        };
        if (usedParsed !== null) {
          rowData.usedDays = usedParsed;
        }
        return rowData;
      })
      .filter((r): r is ImportRow => r !== null);

    if (importRows.length === 0) {
      return apiError("No valid data rows found in Excel file", 400);
    }

    const { errors, validRows } = await validateImportRows(importRows);

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, errors, validCount: validRows.length },
        { status: 422 }
      );
    }

    if (!confirm) {
      return NextResponse.json({
        success: true,
        preview: validRows.map((r) => ({
          employeeId: r.employeeId,
          leaveTypeCode: r.leaveTypeCode,
          year: r.year,
          totalDays: r.totalDays,
          usedDays: r.usedDays,
        })),
        message: "Validation passed. Set confirm=true to apply changes.",
      });
    }

    for (const row of validRows) {
      const computed = await computeLeaveBalancesForUser(row.userId, row.year);
      const current = computed.find((b) => b.leaveType.id === row.leaveTypeId);
      const pendingDays = current?.pendingDays ?? 0;
      const usedDays = row.usedDays ?? current?.usedDays ?? 0;

      if (row.totalDays < usedDays + pendingDays) {
        return apiError(
          `Row ${row.employeeId}/${row.leaveTypeCode}: total days cannot be less than used + pending`,
          400
        );
      }

      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: row.userId,
            leaveTypeId: row.leaveTypeId,
            year: row.year,
          },
        },
        create: {
          userId: row.userId,
          leaveTypeId: row.leaveTypeId,
          year: row.year,
          totalDays: row.totalDays,
          usedDays,
          pendingDays,
          usedDaysManual: row.usedDays !== undefined,
        },
        update: {
          totalDays: row.totalDays,
          ...(row.usedDays !== undefined
            ? { usedDays: row.usedDays, usedDaysManual: true }
            : {}),
        },
      });
    }

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "LeaveBalance",
      details: `Bulk imported ${validRows.length} leave balance records via Excel`,
    });

    return NextResponse.json({
      success: true,
      updated: validRows.length,
      message: `Successfully updated ${validRows.length} leave balance records`,
    });
  } catch (err) {
    console.error("Leave balance import error:", err);
    return apiError("Failed to import leave balances", 500);
  }
}
