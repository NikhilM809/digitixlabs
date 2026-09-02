import { format, isAfter, isBefore, addDays, startOfDay } from "date-fns";

export function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd-MMM-yyyy");
}

export function formatMonthYear(month: number, year: number) {
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

export function formatHours(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatMoney(value: number, currency?: string | null) {
  const amount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  return currency ? `${amount} ${currency}` : amount;
}

/** PDF Helvetica cannot draw ₹; invoices always print CODE + amount. */
export function formatMoneyPdf(value: number, currency: string) {
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currency} ${amount}`;
}

export function pdfSafeText(value: string) {
  return value
    .replaceAll("₹", "Rs.")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replace(/[^\u0000-\u00FF]/g, "?");
}

export function hoursProgress(actual: number, estimated: number) {
  const remaining = estimated - actual;
  const over = actual > estimated;
  return {
    actual,
    estimated,
    remaining,
    over,
    overBy: over ? actual - estimated : 0,
    ratio: estimated > 0 ? actual / estimated : 0,
    label: `${formatHours(actual)} / ${formatHours(estimated)} Hours`,
  };
}

/** Delivery overdue only while work is still in bid / not started / scripting. */
const DELIVERY_TRACKED_STATUSES = new Set(["BID", "NEED_TO_START", "SCRIPT_WIP"]);

export function isOverdue(eta: Date, status: string, now = new Date()) {
  if (!DELIVERY_TRACKED_STATUSES.has(status)) return false;
  return isAfter(startOfDay(now), startOfDay(eta));
}

export function isEtaSoon(eta: Date, days: number, status: string, now = new Date()) {
  if (!DELIVERY_TRACKED_STATUSES.has(status)) return false;
  const limit = addDays(startOfDay(now), days);
  const etaDay = startOfDay(eta);
  return !isAfter(startOfDay(now), etaDay) && !isAfter(etaDay, limit);
}

export function isHoursExceeded(actual: number, estimated: number) {
  return actual > estimated;
}

export { isBefore, isAfter };
