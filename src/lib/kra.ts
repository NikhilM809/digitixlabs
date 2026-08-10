import type { KraItem, KraReview, KraStatus } from "@prisma/client";

export const KRA_RATING_LABELS: Record<number, string> = {
  1: "Needs Significant Improvement",
  2: "Needs Improvement",
  3: "Meets Expectations",
  4: "Exceeds Expectations",
  5: "Outstanding",
};

export const KRA_STATUS_LABELS: Record<KraStatus, string> = {
  DRAFT: "Draft",
  EMPLOYEE_SUBMITTED: "Employee Submitted",
  UNDER_MANAGER_REVIEW: "Under Manager Review",
  MANAGER_REVIEWED: "Manager Reviewed",
  COMPLETED: "Completed",
};

export function averageRating(items: KraItem[], field: "employeeRating" | "managerRating") {
  const values = items
    .map((i) => i[field])
    .filter((v): v is number => v !== null && v !== undefined);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function canEmployeeEditKra(review: Pick<KraReview, "status">) {
  return review.status === "DRAFT";
}

export function canManagerEditKra(review: Pick<KraReview, "status">) {
  return (
    review.status === "EMPLOYEE_SUBMITTED" ||
    review.status === "UNDER_MANAGER_REVIEW" ||
    review.status === "MANAGER_REVIEWED"
  );
}

export function isKraLockedForEmployee(review: Pick<KraReview, "status">) {
  return review.status !== "DRAFT";
}

export function isKraLockedForManager(review: Pick<KraReview, "status">) {
  return review.status === "COMPLETED";
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatKraPeriod(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}
