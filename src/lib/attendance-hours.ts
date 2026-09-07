import { getDateStringInZone } from "@/lib/timezone-utils";

/** Standard working day length applied when checkout was forgotten. */
export const FORGOTTEN_CHECKOUT_HOURS = 9;

/** Round hours to 2 decimal places and avoid float display artifacts. */
export function roundHours(hours: number) {
  return Math.round(hours * 100) / 100;
}

export function buildForgottenCheckoutTime(checkIn: Date) {
  return new Date(checkIn.getTime() + FORGOTTEN_CHECKOUT_HOURS * 60 * 60 * 1000);
}

/** Weekday in company timezone: 0 = Sunday, 5 = Friday, 6 = Saturday. */
export function getWeekdayInZone(date: Date, timeZone: string) {
  const dayStr = getDateStringInZone(date, timeZone);
  const [year, month, day] = dayStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Working hours for a single attendance day.
 * Cross-day checkout (forgotten checkout) is treated as a fixed 9-hour day.
 */
export function calculateWorkingHours(
  checkIn: Date,
  checkOut: Date,
  attendanceDate: Date,
  timeZone: string
): number {
  if (checkOut.getTime() < checkIn.getTime()) {
    return 0;
  }

  const attendanceDay = getDateStringInZone(attendanceDate, timeZone);
  const checkOutDay = getDateStringInZone(checkOut, timeZone);

  if (checkOutDay !== attendanceDay) {
    return FORGOTTEN_CHECKOUT_HOURS;
  }

  return roundHours((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
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
