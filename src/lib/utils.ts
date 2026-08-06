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
