import {
  getDateStringInZone,
  getMinutesSinceMidnightInZone,
  parseScheduleTimeToMinutes,
} from "@/lib/timezone-utils";

const DEFAULT_WORK_END_TIME = "18:30";

/** Round hours to 2 decimal places and avoid float display artifacts. */
export function roundHours(hours: number) {
  return Math.round(hours * 100) / 100;
}

/**
 * Working hours for a single attendance day.
 * If check-out falls on a later calendar day (forgotten checkout), hours are capped
 * to the scheduled work end time on the attendance date.
 */
export function calculateWorkingHours(
  checkIn: Date,
  checkOut: Date,
  attendanceDate: Date,
  timeZone: string,
  workEndTime: string = DEFAULT_WORK_END_TIME
): number {
  if (checkOut.getTime() < checkIn.getTime()) {
    return 0;
  }

  const attendanceDay = getDateStringInZone(attendanceDate, timeZone);
  const checkOutDay = getDateStringInZone(checkOut, timeZone);

  if (checkOutDay === attendanceDay) {
    return roundHours((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
  }

  const checkInMinutes = getMinutesSinceMidnightInZone(checkIn, timeZone);
  const endMinutes = parseScheduleTimeToMinutes(workEndTime);
  if (endMinutes <= checkInMinutes) {
    return roundHours((24 * 60 - checkInMinutes + endMinutes) / 60);
  }
  return roundHours((endMinutes - checkInMinutes) / 60);
}

export function resolveWorkingHours(
  attendanceDate: Date,
  checkIn: Date | null,
  checkOut: Date | null,
  storedHours: number | null | undefined,
  timeZone: string
): number {
  if (checkIn && checkOut) {
    return calculateWorkingHours(checkIn, checkOut, attendanceDate, timeZone);
  }
  return roundHours(storedHours ?? 0);
}

/** ISO week key (Monday start) using company timezone calendar dates. */
export function weekKeyInZone(date: Date, timeZone: string) {
  const dayStr = getDateStringInZone(date, timeZone);
  const [year, month, day] = dayStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - weekday + 1);
  return utcDate.toISOString().slice(0, 10);
}

/** Month key YYYY-MM using company timezone. */
export function monthKeyInZone(date: Date, timeZone: string) {
  const dayStr = getDateStringInZone(date, timeZone);
  return dayStr.slice(0, 7);
}

export function expandToMonthBounds(dateStr: string) {
  const [year, month] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

export function expandToWeekBounds(weekStartStr: string) {
  const [year, month, day] = weekStartStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start, end };
}
