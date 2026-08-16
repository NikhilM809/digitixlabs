import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { getWorkScheduleForUserOnDate } from "@/lib/work-schedule";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const today = startOfDay();
  const now = new Date();
  const schedule = await getWorkScheduleForUserOnDate(user.id, today);
  const workStart = parseTimeToDate(schedule.workStartTime, today);
  const lateCutoff = new Date(workStart.getTime() + schedule.lateThreshold * 60 * 1000);
  const isLateNow = now > lateCutoff;

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
  });
}
