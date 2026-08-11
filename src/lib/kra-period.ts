import type { KraReviewCycle } from "@prisma/client";
import { MONTH_NAMES } from "@/lib/kra";

export const QUARTER_END_MONTHS = [3, 6, 9, 12] as const;

export const QUARTER_LABELS: Record<number, string> = {
  1: "Q1 (Jan–Mar)",
  2: "Q2 (Apr–Jun)",
  3: "Q3 (Jul–Sep)",
  4: "Q4 (Oct–Dec)",
};

export function getQuarterFromEndMonth(month: number): number {
  return Math.ceil(month / 3);
}

export function getQuarterEndMonth(quarter: number): number {
  return quarter * 3;
}

export function isValidKraPeriodMonth(reviewCycle: KraReviewCycle, month: number): boolean {
  if (month < 1 || month > 12) return false;
  if (reviewCycle === "QUARTERLY") {
    return QUARTER_END_MONTHS.includes(month as (typeof QUARTER_END_MONTHS)[number]);
  }
  return true;
}

export function getKraDueDate(month: number, year: number): Date {
  return new Date(year, month, 0);
}

export function formatKraDueDate(month: number, year: number): string {
  const due = getKraDueDate(month, year);
  return due.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatKraReviewPeriod(
  reviewCycle: KraReviewCycle,
  month: number,
  year: number
): string {
  if (reviewCycle === "QUARTERLY") {
    const quarter = getQuarterFromEndMonth(month);
    return `${QUARTER_LABELS[quarter] ?? `Q${quarter}`} ${year}`;
  }
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

export function getDefaultEvaluationMonth(reviewCycle: KraReviewCycle): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  if (reviewCycle === "QUARTERLY") {
    return getQuarterEndMonth(Math.ceil(currentMonth / 3));
  }
  return currentMonth;
}
