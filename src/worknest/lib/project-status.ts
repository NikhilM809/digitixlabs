import { WnProjectStatus } from "@prisma/client";
import { PROJECT_STATUS_ORDER } from "@/worknest/lib/constants";

export const INACTIVE_STATUSES: WnProjectStatus[] = ["CLOSE", "CANCEL"];

export function isInactiveStatus(status: WnProjectStatus) {
  return status === "CLOSE" || status === "CANCEL";
}

export function canSelectCancel(current: WnProjectStatus) {
  return current === "BID" || current === "CANCEL";
}

export function statusesAvailable(current: WnProjectStatus) {
  const base = PROJECT_STATUS_ORDER.filter((status) => status !== "CANCEL");
  return canSelectCancel(current) ? [...base, "CANCEL" as const] : base;
}
