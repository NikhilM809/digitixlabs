import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { getWorkScheduleForUserOnDate } from "@/lib/work-schedule";
import {
  getCompanyTimezone,
  isLateForSchedule,
  startOfDayInZone,
} from "@/lib/company-timezone";
import { autoCloseForgottenCheckouts } from "@/lib/forgotten-checkout";

export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const now = new Date();
  const timeZone = await getCompanyTimezone();
  const today = startOfDayInZone(now, timeZone);

  const autoClosed = await autoCloseForgottenCheckouts(
    user.id,
    now,
    timeZone,
    "saturday-preview"
  );

  const schedule = await getWorkScheduleForUserOnDate(user.id, today);
  const isLateNow = isLateForSchedule(
    now,
    schedule.workStartTime,
    schedule.lateThreshold,
    timeZone
  );

  const existing = await prisma.attendance.findUnique({
    where: {
      userId_date: { userId: user.id, date: today },
    },
    select: { checkIn: true },
  });

  return apiSuccess({
    workStartTime: schedule.workStartTime,
    lateThreshold: schedule.lateThreshold,
    isLateNow,
    alreadyCheckedIn: !!existing?.checkIn,
    timezone: timeZone,
    autoClosedForgottenCheckouts: autoClosed,
  });
}
