import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, createAuditLog } from "@/lib/api-utils";
import { workScheduleUpdateSchema } from "@/lib/validations";
import {
  canAccessWorkSchedules,
  canBulkManageWorkSchedules,
} from "@/lib/permissions";
import { canManageEmployeeWorkSchedule } from "@/lib/work-schedule-access";
import {
  buildExcelBuffer,
  getRowValue,
  parseExcelBuffer,
  parseOptionalNumber,
  isValidTime,
} from "@/lib/excel-utils";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessWorkSchedules(user.role)) {
    return apiError("Forbidden", 403);
  }

  const templateOnly = request.nextUrl.searchParams.get("template") === "true";
  const listOnly = request.nextUrl.searchParams.get("list") === "true";
  const settings = await prisma.companySettings.findFirst();

  const employeeWhere =
    user.role === "MANAGER"
      ? { status: "ACTIVE" as const, managerId: user.id }
      : { status: "ACTIVE" as const };

  if (listOnly) {
    const employees = await prisma.user.findMany({
      where: employeeWhere,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        department: { select: { name: true } },
      },
      orderBy: { employeeId: "asc" },
    });
    return apiSuccess(employees);
  }

  if (!canBulkManageWorkSchedules(user.role)) {
    return apiError("Forbidden", 403);
  }

  if (templateOnly) {
    const buffer = buildExcelBuffer(
      [
        {
          "Employee ID": "DXL0003",
          "Work Start Time": settings?.workStartTime ?? "09:00",
          "Work End Time": settings?.workEndTime ?? "18:00",
          "Late Threshold (min)": settings?.lateThreshold ?? 15,
        },
      ],
      "WorkScheduleTemplate"
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="work-schedule-template.xlsx"',
      },
    });
  }

  const employees = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      workStartTime: true,
      workEndTime: true,
      lateThreshold: true,
    },
    orderBy: { employeeId: "asc" },
  });

  const rows = employees.map((e) => ({
    "Employee ID": e.employeeId,
    "Employee Name": `${e.firstName} ${e.lastName}`,
    "Work Start Time": e.workStartTime ?? settings?.workStartTime ?? "09:00",
    "Work End Time": e.workEndTime ?? settings?.workEndTime ?? "18:00",
    "Late Threshold (min)": e.lateThreshold ?? settings?.lateThreshold ?? 15,
  }));

  const buffer = buildExcelBuffer(rows, "WorkSchedules");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="work-schedules.xlsx"',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessWorkSchedules(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = workScheduleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { userId, workStartTime, workEndTime, lateThreshold } = parsed.data;

    const allowed = await canManageEmployeeWorkSchedule(user.role, user.id, userId);
    if (!allowed) {
      return apiError("Forbidden", 403);
    }

    const employee = await prisma.user.update({
      where: { id: userId },
      data: {
        workStartTime,
        workEndTime,
        ...(lateThreshold !== undefined ? { lateThreshold } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      details: `Updated work schedule for ${employee.employeeId}`,
    });

    return apiSuccess(employee);
  } catch {
    return apiError("Failed to update work schedule", 500);
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canBulkManageWorkSchedules(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const confirm = formData.get("confirm") === "true";

    if (!file || !(file instanceof Blob)) {
      return apiError("Excel file is required", 400);
    }

    const rawRows = parseExcelBuffer(await file.arrayBuffer());
    const errors: { row: number; message: string }[] = [];
    const validUpdates: {
      employeeId: string;
      userId: string;
      workStartTime: string;
      workEndTime: string;
      lateThreshold?: number;
    }[] = [];
    const seen = new Set<string>();

    const employees = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, employeeId: true },
    });
    const empMap = new Map(employees.map((e) => [e.employeeId.toUpperCase(), e]));

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const employeeId = getRowValue(row, "Employee ID", "employee_id", "employeeId");
      const workStartTime = getRowValue(row, "Work Start Time", "work_start_time", "workStartTime");
      const workEndTime = getRowValue(row, "Work End Time", "work_end_time", "workEndTime");
      const lateStr = getRowValue(row, "Late Threshold (min)", "late_threshold", "lateThreshold");

      if (!employeeId) return;

      if (seen.has(employeeId.toUpperCase())) {
        errors.push({ row: rowNum, message: `Duplicate Employee ID ${employeeId}` });
        return;
      }
      seen.add(employeeId.toUpperCase());

      const emp = empMap.get(employeeId.toUpperCase());
      if (!emp) {
        errors.push({ row: rowNum, message: `Employee ID ${employeeId} does not exist` });
        return;
      }

      if (!isValidTime(workStartTime)) {
        errors.push({ row: rowNum, message: "Work start time is invalid (use HH:MM)" });
        return;
      }

      if (!isValidTime(workEndTime)) {
        errors.push({ row: rowNum, message: "Work end time is invalid (use HH:MM)" });
        return;
      }

      const lateThreshold = parseOptionalNumber(lateStr);
      if (lateStr && lateThreshold === null) {
        errors.push({ row: rowNum, message: "Late threshold must be a number" });
        return;
      }

      validUpdates.push({
        employeeId,
        userId: emp.id,
        workStartTime,
        workEndTime,
        ...(lateThreshold !== null ? { lateThreshold: lateThreshold ?? undefined } : {}),
      });
    });

    if (validUpdates.length === 0) {
      return apiError("No valid schedule rows found", 400);
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 422 });
    }

    if (!confirm) {
      return NextResponse.json({
        success: true,
        preview: validUpdates,
        message: "Validation passed. Set confirm=true to apply changes.",
      });
    }

    for (const update of validUpdates) {
      await prisma.user.update({
        where: { id: update.userId },
        data: {
          workStartTime: update.workStartTime,
          workEndTime: update.workEndTime,
          ...(update.lateThreshold !== undefined
            ? { lateThreshold: update.lateThreshold }
            : {}),
        },
      });
    }

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      details: `Bulk imported ${validUpdates.length} work schedules via Excel`,
    });

    return NextResponse.json({
      success: true,
      updated: validUpdates.length,
    });
  } catch (err) {
    console.error("Work schedule import error:", err);
    return apiError("Failed to import work schedules", 500);
  }
}
