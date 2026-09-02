import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, createAuditLog } from "@/lib/api-utils";
import { canBulkManageLeaveBalances } from "@/lib/permissions";
import { buildExcelBuffer, getRowValue, parseOptionalNumber } from "@/lib/excel-utils";
import { computeLeaveBalancesForUser } from "@/lib/leave-balance";
import { DEPRECATED_LEAVE_TYPE_CODES } from "@/lib/leave-type-codes";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canBulkManageLeaveBalances(user.role)) {
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

  const [employees, leaveTypes] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", role: { not: "ADMIN" } },
      select: { id: true, employeeId: true, firstName: true, lastName: true },
      orderBy: { employeeId: "asc" },
    }),
    prisma.leaveType.findMany({
      where: {
        isActive: true,
        code: { notIn: [...DEPRECATED_LEAVE_TYPE_CODES] },
      },
      select: { id: true, code: true, defaultDays: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const rows: Record<string, string | number>[] = [];

  for (const emp of employees) {
    const balances = await computeLeaveBalancesForUser(emp.id, year);
    const balanceByType = new Map(balances.map((b) => [b.leaveType.id, b]));

    for (const lt of leaveTypes) {
      const b = balanceByType.get(lt.id);
      const totalDays = b?.totalDays ?? lt.defaultDays;
      const usedDays = b?.usedDays ?? 0;
      const pendingDays = b?.pendingDays ?? 0;
      const remaining = totalDays - usedDays - pendingDays;

      rows.push({
        "Employee ID": emp.employeeId,
        "Employee Name": `${emp.firstName} ${emp.lastName}`,
        "Leave Type Code": lt.code,
        Year: year,
        "Total Days": totalDays,
        "Used Days": usedDays,
        Pending: pendingDays,
        Remaining: remaining,
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
  usedDays: number;
}

interface RowError {
  row: number;
  message: string;
}

async function validateImportRows(rows: ImportRow[]): Promise<{
  errors: RowError[];
  validRows: (ImportRow & {
    userId: string;
    leaveTypeId: string;
    pendingDays: number;
    remaining: number;
  })[];
}> {
  const errors: RowError[] = [];
  const validRows: (ImportRow & {
    userId: string;
    leaveTypeId: string;
    pendingDays: number;
    remaining: number;
  })[] = [];
  const seen = new Set<string>();

  const [employees, leaveTypes] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, employeeId: true },
    }),
    prisma.leaveType.findMany({
      where: {
        isActive: true,
        code: { notIn: [...DEPRECATED_LEAVE_TYPE_CODES] },
      },
      select: { id: true, code: true },
    }),
  ]);

  const empMap = new Map(employees.map((e) => [e.employeeId.toUpperCase(), e]));
  const ltMap = new Map(leaveTypes.map((lt) => [lt.code.toUpperCase(), lt]));

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNum = index + 2;
    const key = `${row.employeeId}:${row.leaveTypeCode}:${row.year}`;
    if (seen.has(key)) {
      errors.push({ row: rowNum, message: `Duplicate entry for ${row.employeeId} / ${row.leaveTypeCode}` });
      continue;
    }
    seen.add(key);

    const emp = empMap.get(row.employeeId.toUpperCase());
    if (!emp) {
      errors.push({ row: rowNum, message: `Employee ID ${row.employeeId} does not exist` });
      continue;
    }

    const lt = ltMap.get(row.leaveTypeCode.toUpperCase());
    if (!lt) {
      errors.push({ row: rowNum, message: `Leave type code ${row.leaveTypeCode} is invalid` });
      continue;
    }

    if (row.totalDays < 0) {
      errors.push({ row: rowNum, message: "Total days cannot be negative" });
      continue;
    }

    if (row.usedDays < 0) {
      errors.push({ row: rowNum, message: "Used days cannot be negative" });
      continue;
    }

    const computed = await computeLeaveBalancesForUser(emp.id, row.year);
    const current = computed.find((b) => b.leaveType.id === lt.id);
    const pendingDays = current?.pendingDays ?? 0;
    const remaining = row.totalDays - row.usedDays - pendingDays;

    if (remaining < 0) {
      errors.push({
        row: rowNum,
        message: `Total days (${row.totalDays}) must be at least used (${row.usedDays}) + pending (${pendingDays})`,
      });
      continue;
    }

    validRows.push({
      ...row,
      userId: emp.id,
      leaveTypeId: lt.id,
      pendingDays,
      remaining,
    });
  }

  return { errors, validRows };
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canBulkManageLeaveBalances(user.role)) {
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

        if (!employeeId || !leaveTypeCode) return null;

        const year = parseOptionalNumber(yearStr) ?? new Date().getFullYear();
        const totalDays = parseOptionalNumber(totalStr);
        if (totalDays === null) return null;

        const usedDays = parseOptionalNumber(usedStr) ?? 0;

        return {
          employeeId,
          leaveTypeCode,
          year,
          totalDays,
          usedDays,
        };
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
          pendingDays: r.pendingDays,
          remaining: r.remaining,
        })),
        message:
          "Validation passed. Remaining is calculated as Total Days minus Used Days minus Pending. Set confirm=true to apply.",
      });
    }

    for (const row of validRows) {
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
          usedDays: row.usedDays,
          pendingDays: row.pendingDays,
          usedDaysManual: true,
        },
        update: {
          totalDays: row.totalDays,
          usedDays: row.usedDays,
          pendingDays: row.pendingDays,
          usedDaysManual: true,
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
