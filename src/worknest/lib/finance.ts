import { WnBillingStage, WnInvoiceStatus, WnProjectStatus } from "@prisma/client";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";

type FinancialFields = {
  sellValue?: number | null;
  invoices?: unknown;
  billingStatus?: string | null;
  currency?: unknown;
  currencyId?: string | null;
};

export function stripFinance<T extends FinancialFields>(record: T, role: Role): T {
  if (role === "ADMIN") return record;
  const clone = { ...record };
  delete clone.sellValue;
  delete clone.invoices;
  delete clone.billingStatus;
  delete clone.currency;
  delete clone.currencyId;
  return clone;
}

export function displayBillingStatus(project: {
  status: WnProjectStatus;
  billingStage: WnBillingStage;
  invoices: { status: WnInvoiceStatus }[];
}) {
  if (project.invoices.some((invoice) => invoice.status === "PAID")) return "Paid";
  if (project.invoices.length > 0) return "Invoice Generated";
  if (project.billingStage === "APPROVED") return "Approved";
  if (project.status !== "CLOSE") return "Not billed";
  if (project.billingStage === "APPROVAL_REQUIRED") return "Approval Required";
  return "Pending Billing";
}

export function billingStatusForProject(
  status: WnProjectStatus,
  invoices: { status: WnInvoiceStatus }[],
  billingStage: WnBillingStage = "NONE",
) {
  return displayBillingStatus({ status, invoices, billingStage });
}

export function totalsByCurrency<T>(
  rows: T[],
  getAmount: (row: T) => number,
  getCode: (row: T) => string = (row) => {
    const item = row as { currency?: { code?: string } | null; currencyCode?: string };
    return item.currency?.code ?? item.currencyCode ?? "Unknown";
  },
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = getCode(row);
    map.set(code, (map.get(code) ?? 0) + getAmount(row));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function remainingByCurrency(total: [string, number][], billed: [string, number][]) {
  const billedMap = new Map(billed);
  const codes = new Set([...total.map(([code]) => code), ...billed.map(([code]) => code)]);
  return [...codes]
    .sort((a, b) => a.localeCompare(b))
    .map((code) => {
      const value = (total.find(([item]) => item === code)?.[1] ?? 0) - (billedMap.get(code) ?? 0);
      return [code, Math.max(0, value)] as [string, number];
    })
    .filter(([, amount]) => amount > 0);
}

export function isCurrentOrPastPeriod(month: number, year: number, now = new Date()) {
  return year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1);
}

export function periodSortKey(month: number, year: number) {
  return year * 12 + month;
}
