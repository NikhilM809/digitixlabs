import { prisma } from "@/lib/prisma";

export const DEFAULT_COMPANY_TIMEZONE = "Asia/Kolkata";

export async function getCompanyTimezone() {
  const settings = await prisma.companySettings.findFirst({
    select: { timezone: true },
  });
  return settings?.timezone || DEFAULT_COMPANY_TIMEZONE;
}

/** Minutes since local midnight in the given IANA timezone. */
export function getMinutesSinceMidnightInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function parseScheduleTimeToMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isLateForSchedule(
  now: Date,
  workStartTime: string,
  lateThresholdMinutes: number,
  timeZone: string
) {
  const nowMinutes = getMinutesSinceMidnightInZone(now, timeZone);
  const startMinutes = parseScheduleTimeToMinutes(workStartTime);
  return nowMinutes > startMinutes + lateThresholdMinutes;
}

/** Calendar date string (YYYY-MM-DD) in the company timezone. */
export function getDateStringInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfDayInZone(date: Date, timeZone: string) {
  const dateStr = getDateStringInZone(date, timeZone);
  return new Date(`${dateStr}T00:00:00.000Z`);
}
