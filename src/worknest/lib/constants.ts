import {
  WnProjectStatus,
  WnTaskStatus,
  WnHourStatus,
  WnInvoiceStatus,
} from "@prisma/client";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";

export const APP_NAME = "Worknest";
export const APP_TAGLINE = "Where work comes together.";

export const PROJECT_STATUS_LABEL: Record<WnProjectStatus, string> = {
  BID: "Bid",
  NEED_TO_START: "Need to Start",
  SCRIPT_WIP: "Script WIP",
  CHANGES: "Changes",
  LIVE: "Live",
  HOLD: "Hold",
  CLOSE: "Close",
  CANCEL: "Cancelled",
};

/** Labels used on the efforts tracker Excel (Project_Billing_details_status). */
export function trackerWnProjectStatusLabel(status: WnProjectStatus) {
  if (status === "CLOSE") return "Closed";
  if (status === "LIVE") return "Full Launched";
  if (status === "HOLD") return "Hold";
  if (status === "SCRIPT_WIP") return "Programming";
  if (status === "NEED_TO_START") return "Need to Start";
  return PROJECT_STATUS_LABEL[status];
}

export const PROJECT_STATUS_ORDER: WnProjectStatus[] = [
  "BID",
  "NEED_TO_START",
  "SCRIPT_WIP",
  "CHANGES",
  "LIVE",
  "HOLD",
  "CLOSE",
  "CANCEL",
];

export const TASK_STATUS_LABEL: Record<WnTaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};

export const WORK_TYPE_LABEL: Record<string, string> = {
  INITIAL_SCRIPTING: "Initial Scripting",
  INITIAL_QA: "Initial QA",
  CHANGES: "Changes",
  CHANGES_QA: "Changes QA",
  LIVE: "Live",
  PROJECT_MANAGEMENT: "Project Management",
};

export function workTypeLabel(code: string) {
  if (WORK_TYPE_LABEL[code]) return WORK_TYPE_LABEL[code];
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const HOUR_STATUS_LABEL: Record<WnHourStatus, string> = {
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
};

export const INVOICE_STATUS_LABEL: Record<WnInvoiceStatus, string> = {
  GENERATED: "Invoice Generated",
  PAID: "Paid",
};

export const BILLING_STATUS_LABEL = {
  NONE: "Not billed",
  PENDING: "Pending Billing",
  APPROVAL_REQUIRED: "Approval Required",
  APPROVED: "Approved",
  GENERATED: "Invoice Generated",
  PAID: "Paid",
} as const;

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const PAGE_SIZE = 20;
