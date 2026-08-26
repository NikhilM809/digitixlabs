import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { manualAttendanceSchema } from "@/lib/validations";
import { getWorkScheduleForUserOnDate } from "@/lib/work-schedule";
import { canManageManualAttendance } from "@/lib/permissions";
import {
  getCompanyTimezone,
  isLateForSchedule,
  startOfDayInZone,
  getMinutesSinceMidnightInZone,
  parseScheduleTimeToMinutes,
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

    const { userId, action, timestamp, notes, lateReason } = parsed.data;
    const eventTime = new Date(timestamp);

    if (Number.isNaN(eventTime.getTime())) {
      return apiError("Invalid timestamp", 400);
    }

    const allowed = await canManageEmployeeAttendance(user.role, user.id, userId);
    if (!allowed) {
      return apiError("Forbidden", 403);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, firstName: true, lastName: true },
    });

    if (!targetUser || targetUser.status !== "ACTIVE") {
      return apiError("Employee not found or inactive", 404);
    }

    const timeZone = await getCompanyTimezone();
    const attendanceDate = startOfDayInZone(eventTime, timeZone);
    const manualNote = `[Manual ${action} by ${user.firstName} ${user.lastName} (${user.employeeId})]`;

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

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: { userId, date: attendanceDate },
      },
    });

    if (action === "check-in") {
      if (existing?.checkIn) {
        return apiError("Employee already checked in for this date", 400);
      }

      const schedule = await getWorkScheduleForUserOnDate(userId, attendanceDate);
      const isLate = isLateForSchedule(
        eventTime,
        schedule.workStartTime,
        schedule.lateThreshold,
        timeZone
      );

      if (isLate && (!lateReason || lateReason.trim().length < 5)) {
        return apiError("Reason for late arrival is required (minimum 5 characters)", 400);
      }

      const combinedNotes = [manualNote, notes?.trim()].filter(Boolean).join(" — ");

      const attendance = await prisma.attendance.upsert({
        where: {
          userId_date: { userId, date: attendanceDate },
        },
        create: {
          userId,
          date: attendanceDate,
          checkIn: eventTime,
          status: isLate ? "LATE" : "PRESENT",
          isLate,
          lateReason: isLate ? lateReason?.trim() : null,
          notes: combinedNotes,
        },
        update: {
          checkIn: eventTime,
          status: isLate ? "LATE" : "PRESENT",
          isLate,
          lateReason: isLate ? lateReason?.trim() : null,
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
        action: "CREATE",
        entity: "Attendance",
        entityId: attendance.id,
        details: `Manual check-in for ${targetUser.firstName} ${targetUser.lastName} at ${eventTime.toISOString()}`,
      });

      return apiSuccess(attendance, 201);
    }

    if (!existing?.checkIn) {
      return apiError("Employee must be checked in before checking out", 400);
    }

    if (existing.checkOut) {
      return apiError("Employee already checked out for this date", 400);
    }

    if (eventTime.getTime() < new Date(existing.checkIn).getTime()) {
      return apiError("Check-out time cannot be before check-in time", 400);
    }

    const workingHours =
      (eventTime.getTime() - new Date(existing.checkIn).getTime()) / (1000 * 60 * 60);

    const checkoutSchedule = await getWorkScheduleForUserOnDate(userId, attendanceDate);
    const eventMinutes = getMinutesSinceMidnightInZone(eventTime, timeZone);
    const workEndMinutes = parseScheduleTimeToMinutes(checkoutSchedule.workEndTime);
    const overtimeHours = Math.max(0, (eventMinutes - workEndMinutes) / 60);

    const combinedNotes = [existing.notes, manualNote, notes?.trim()]
      .filter(Boolean)
      .join(" — ");

    const attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: eventTime,
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
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
      action: "UPDATE",
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
