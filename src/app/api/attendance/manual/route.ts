import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import {
  manualAttendanceSchema,
  manualAttendanceUpdateSchema,
} from "@/lib/validations";
import { canManageManualAttendance } from "@/lib/permissions";
import {
  buildManualAuditNote,
  computeAttendanceMetrics,
} from "@/lib/manual-attendance";
import {
  getCompanyTimezone,
  startOfDayInZone,
  attendanceDateFromString,
} from "@/lib/company-timezone";

async function canManageEmployeeAttendance(
  role: RoleName,
  actorId: string,
  targetUserId: string
) {
  if (role === RoleName.ADMIN || role === RoleName.HR) {
    return true;
  }

  if (role === RoleName.MANAGER) {
    const employee = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        OR: [{ managerId: actorId }, { id: actorId }],
      },
      select: { id: true },
    });
    return !!employee;
  }

  return false;
}

async function resolveTargetEmployee(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, firstName: true, lastName: true },
  });
}

function appendNotes(existingNotes: string | null | undefined, ...parts: Array<string | undefined>) {
  return [existingNotes, ...parts.filter(Boolean)].filter(Boolean).join(" — ");
}

function parseTimestamp(value: string, label: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: apiError(`Invalid ${label} timestamp`, 400) };
  }
  return { value: parsed };
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
    if (error || !user) return error;

    if (!canManageManualAttendance(user.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = manualAttendanceSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { userId, action, timestamp, notes, lateReason, mode } = parsed.data;
    const eventTimeResult = parseTimestamp(timestamp, "event");
    if ("error" in eventTimeResult) return eventTimeResult.error;
    const eventTime = eventTimeResult.value;

    const allowed = await canManageEmployeeAttendance(user.role, user.id, userId);
    if (!allowed) {
      return apiError("Forbidden", 403);
    }

    const targetUser = await resolveTargetEmployee(userId);
    if (!targetUser || targetUser.status !== "ACTIVE") {
      return apiError("Employee not found or inactive", 404);
    }

    const timeZone = await getCompanyTimezone();
    const attendanceDate = startOfDayInZone(eventTime, timeZone);
    const manualNote = buildManualAuditNote(action, user);
    const isUpdate = mode === "update";

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: { userId, date: attendanceDate },
      },
    });

    if (!isUpdate) {
      const onLeave = await prisma.leaveRequest.findFirst({
        where: {
          userId,
          status: "APPROVED",
          fromDate: { lte: eventTime },
          toDate: { gte: attendanceDate },
        },
      });

      if (onLeave) {
        return apiError("Employee is on approved leave for this date", 400);
      }
    }

    if (action === "check-in") {
      if (existing?.checkIn && !isUpdate) {
        return apiError("Employee already checked in for this date", 400);
      }

      const metrics = await computeAttendanceMetrics({
        userId,
        attendanceDate,
        checkIn: eventTime,
        checkOut: existing?.checkOut ? new Date(existing.checkOut) : null,
        timeZone,
        lateReason,
      });

      if ("error" in metrics) {
        return apiError(metrics.error ?? "Invalid attendance data", 400);
      }

      const combinedNotes = appendNotes(
        isUpdate ? existing?.notes : null,
        manualNote,
        notes?.trim()
      );

      const attendance = await prisma.attendance.upsert({
        where: {
          userId_date: { userId, date: attendanceDate },
        },
        create: {
          userId,
          date: attendanceDate,
          checkIn: eventTime,
          status: metrics.status,
          isLate: metrics.isLate,
          lateReason: metrics.lateReason,
          notes: combinedNotes,
          workingHours: metrics.workingHours,
          overtimeHours: metrics.overtimeHours,
        },
        update: {
          checkIn: eventTime,
          status: metrics.status,
          isLate: metrics.isLate,
          lateReason: metrics.lateReason,
          notes: combinedNotes,
          workingHours: metrics.workingHours,
          overtimeHours: metrics.overtimeHours,
        },
        include: {
          user: {
            select: { firstName: true, lastName: true, employeeId: true },
          },
        },
      });

      await createAuditLog({
        userId: user.id,
        action: isUpdate ? "UPDATE" : "CREATE",
        entity: "Attendance",
        entityId: attendance.id,
        details: `Manual check-in for ${targetUser.firstName} ${targetUser.lastName} at ${eventTime.toISOString()}`,
      });

      return apiSuccess(attendance, isUpdate ? 200 : 201);
    }

    if (!existing?.checkIn) {
      return apiError("Employee must be checked in before checking out", 400);
    }

    const checkInTime = new Date(existing.checkIn);

    if (existing?.checkOut && !isUpdate) {
      return apiError("Employee already checked out for this date", 400);
    }

    const metrics = await computeAttendanceMetrics({
      userId,
      attendanceDate,
      checkIn: checkInTime,
      checkOut: eventTime,
      timeZone,
      lateReason: existing?.lateReason ?? lateReason,
    });

    if ("error" in metrics) {
      return apiError(metrics.error ?? "Invalid attendance data", 400);
    }

    const combinedNotes = appendNotes(existing?.notes, manualNote, notes?.trim());

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: { userId, date: attendanceDate },
      },
      create: {
        userId,
        date: attendanceDate,
        checkIn: checkInTime,
        checkOut: eventTime,
        status: metrics.status,
        isLate: metrics.isLate,
        lateReason: metrics.lateReason,
        notes: combinedNotes,
        workingHours: metrics.workingHours,
        overtimeHours: metrics.overtimeHours,
      },
      update: {
        checkOut: eventTime,
        status: metrics.status,
        isLate: metrics.isLate,
        workingHours: metrics.workingHours,
        overtimeHours: metrics.overtimeHours,
        notes: combinedNotes,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: isUpdate ? "UPDATE" : "UPDATE",
      entity: "Attendance",
      entityId: attendance.id,
      details: `Manual check-out for ${targetUser.firstName} ${targetUser.lastName} at ${eventTime.toISOString()}`,
    });

    return apiSuccess(attendance);
  } catch (err) {
    console.error("Manual attendance error:", err);
    return apiError("Failed to process manual attendance", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
    if (error || !user) return error;

    if (!canManageManualAttendance(user.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = manualAttendanceUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { userId, date, checkIn, checkOut, notes, lateReason } = parsed.data;

    const allowed = await canManageEmployeeAttendance(user.role, user.id, userId);
    if (!allowed) {
      return apiError("Forbidden", 403);
    }

    const targetUser = await resolveTargetEmployee(userId);
    if (!targetUser || targetUser.status !== "ACTIVE") {
      return apiError("Employee not found or inactive", 404);
    }

    let attendanceDate: Date;
    try {
      attendanceDate = attendanceDateFromString(date);
    } catch {
      return apiError("Invalid date format. Use YYYY-MM-DD", 400);
    }

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: { userId, date: attendanceDate },
      },
    });

    let nextCheckIn = existing?.checkIn ? new Date(existing.checkIn) : null;
    let nextCheckOut = existing?.checkOut ? new Date(existing.checkOut) : null;

    if (checkIn) {
      const parsedCheckIn = parseTimestamp(checkIn, "check-in");
      if ("error" in parsedCheckIn) return parsedCheckIn.error;
      nextCheckIn = parsedCheckIn.value;
    }

    if (checkOut) {
      const parsedCheckOut = parseTimestamp(checkOut, "check-out");
      if ("error" in parsedCheckOut) return parsedCheckOut.error;
      nextCheckOut = parsedCheckOut.value;
    }

    const timeZone = await getCompanyTimezone();
    const metrics = await computeAttendanceMetrics({
      userId,
      attendanceDate,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
      timeZone,
      lateReason: lateReason ?? existing?.lateReason,
    });

    if ("error" in metrics) {
      return apiError(metrics.error ?? "Invalid attendance data", 400);
    }

    const manualNote = buildManualAuditNote("backdate update", user);
    const combinedNotes = appendNotes(existing?.notes, manualNote, notes?.trim());

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: { userId, date: attendanceDate },
      },
      create: {
        userId,
        date: attendanceDate,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        status: metrics.status,
        isLate: metrics.isLate,
        lateReason: metrics.lateReason,
        notes: combinedNotes,
        workingHours: metrics.workingHours,
        overtimeHours: metrics.overtimeHours,
      },
      update: {
        ...(checkIn ? { checkIn: nextCheckIn } : {}),
        ...(checkOut ? { checkOut: nextCheckOut } : {}),
        status: metrics.status,
        isLate: metrics.isLate,
        lateReason: metrics.lateReason,
        workingHours: metrics.workingHours,
        overtimeHours: metrics.overtimeHours,
        notes: combinedNotes,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: existing ? "UPDATE" : "CREATE",
      entity: "Attendance",
      entityId: attendance.id,
      details: `Updated backdate attendance for ${targetUser.firstName} ${targetUser.lastName} on ${date}`,
    });

    return apiSuccess(attendance);
  } catch (err) {
    console.error("Manual attendance update error:", err);
    return apiError("Failed to update attendance", 500);
  }
}
