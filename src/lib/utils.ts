import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function calculateLeaveDays(
  fromDate: Date,
  toDate: Date,
  isHalfDay: boolean,
  holidays: Date[] = []
): number {
  if (isHalfDay) return 0.5;

  let days = 0;
  const current = new Date(fromDate);
  const end = new Date(toDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isHoliday = holidays.some(
      (h) => h.toDateString() === current.toDateString()
    );
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function generateEmployeeId(count: number): string {
  return `DXL${String(count + 1).padStart(4, "0")}`;
}

/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift bugs) */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as local midnight */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateString(dateStr: string): boolean {
  const d = parseLocalDate(dateStr);
  return !isNaN(d.getTime());
}
