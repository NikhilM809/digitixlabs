import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/api-utils";
import { startOfDayInZone } from "@/lib/company-timezone";
import {
  buildForgottenCheckoutTime,
  FORGOTTEN_CHECKOUT_HOURS,
  getWeekdayInZone,
} from "@/lib/attendance-hours";
import { getDateStringInZone } from "@/lib/timezone-utils";

type AutoCloseTrigger = "check-in" | "saturday-preview";

export async function autoCloseForgottenCheckouts(
  userId: string,
  now: Date,
  timeZone: string,
  trigger: AutoCloseTrigger
) {
  const today = startOfDayInZone(now, timeZone);
  const todayWeekday = getWeekdayInZone(now, timeZone);

  if (trigger === "saturday-preview" && todayWeekday !== 6) {
    return [];
  }

  const openRecords = await prisma.attendance.findMany({
    where: {
      userId,
      checkIn: { not: null },
      checkOut: null,
      date: { lt: today },
    },
    orderBy: { date: "asc" },
  });

  if (openRecords.length === 0) {
    return [];
  }

  const closed = [];

  for (const record of openRecords) {
    const checkIn = new Date(record.checkIn!);
    const checkOut = buildForgottenCheckoutTime(checkIn);
    const attendanceDay = getDateStringInZone(record.date, timeZone);
    const recordWeekday = getWeekdayInZone(record.date, timeZone);

    if (trigger === "saturday-preview" && recordWeekday !== 5) {
      continue;
    }

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut,
        workingHours: FORGOTTEN_CHECKOUT_HOURS,
        overtimeHours: 0,
        notes: record.notes
          ? `${record.notes}\n[Auto checkout: ${FORGOTTEN_CHECKOUT_HOURS}h after check-in on forgotten checkout]`
          : `[Auto checkout: ${FORGOTTEN_CHECKOUT_HOURS}h after check-in on forgotten checkout]`,
      },
    });

    closed.push({
      id: updated.id,
      date: attendanceDay,
      checkOut,
      workingHours: FORGOTTEN_CHECKOUT_HOURS,
    });

    await createAuditLog({
      userId,
      action: "UPDATE",
      entity: "Attendance",
      entityId: updated.id,
      details: `Auto checkout applied for ${attendanceDay} (${FORGOTTEN_CHECKOUT_HOURS}h after check-in, forgotten checkout)`,
    });
  }

  return closed;
}
