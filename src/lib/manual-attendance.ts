import type { AttendanceStatus } from "@prisma/client";
import { getWorkScheduleForUserOnDate } from "@/lib/work-schedule";
import {
  isLateForSchedule,
  getMinutesSinceMidnightInZone,
  parseScheduleTimeToMinutes,
} from "@/lib/company-timezone";

export function buildManualAuditNote(
  action: string,
  actor: { firstName: string; lastName: string; employeeId: string }
) {
  return `[Manual ${action} by ${actor.firstName} ${actor.lastName} (${actor.employeeId})]`;
}

export async function computeAttendanceMetrics(params: {
  userId: string;
  attendanceDate: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  timeZone: string;
  lateReason?: string | null;
  /** When set, overrides schedule-based late detection. */
  isLateOverride?: boolean;
}) {
  const { userId, attendanceDate, checkIn, checkOut, timeZone, lateReason, isLateOverride } =
    params;

  let status: AttendanceStatus = "PRESENT";
  let isLate = false;
  let resolvedLateReason: string | null = null;

  if (checkIn) {
    if (isLateOverride !== undefined) {
      isLate = isLateOverride;
    } else {
      const schedule = await getWorkScheduleForUserOnDate(userId, attendanceDate);
      isLate = isLateForSchedule(
        checkIn,
        schedule.workStartTime,
        schedule.lateThreshold,
        timeZone
      );
    }
    status = isLate ? "LATE" : "PRESENT";

    if (isLate) {
      if (!lateReason || lateReason.trim().length < 5) {
        return {
          error: "Reason for late arrival is required (minimum 5 characters)",
        } as const;
      }
      resolvedLateReason = lateReason.trim();
    }
  } else if (isLateOverride !== undefined) {
    isLate = isLateOverride;
    status = isLate ? "LATE" : "PRESENT";
    if (isLate) {
      if (!lateReason || lateReason.trim().length < 5) {
        return {
          error: "Reason for late arrival is required (minimum 5 characters)",
        } as const;
      }
      resolvedLateReason = lateReason.trim();
    }
  }

  if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
    return { error: "Check-out time cannot be before check-in time" } as const;
  }

  let workingHours: number | null = null;
  let overtimeHours: number | null = null;

  if (checkIn && checkOut) {
    workingHours = Math.round(
      ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100
    ) / 100;

    const schedule = await getWorkScheduleForUserOnDate(userId, attendanceDate);
    const checkoutMinutes = getMinutesSinceMidnightInZone(checkOut, timeZone);
    const workEndMinutes = parseScheduleTimeToMinutes(schedule.workEndTime);
    overtimeHours = Math.max(0, Math.round(((checkoutMinutes - workEndMinutes) / 60) * 100) / 100);
  }

  return {
    status,
    isLate,
    lateReason: resolvedLateReason,
    workingHours,
    overtimeHours,
  } as const;
}
