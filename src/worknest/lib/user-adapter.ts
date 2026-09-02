/**
 * Maps HRMS RoleName to Worknest PM roles (ADMIN | MANAGER | EMPLOYEE).
 */
import type { RoleName } from "@prisma/client";

export type WnRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

export function toWnRole(role: RoleName): WnRole {
  if (role === "ADMIN" || role === "HR") return "ADMIN";
  if (role === "MANAGER") return "MANAGER";
  return "EMPLOYEE";
}

export function userDisplayName(user: {
  firstName: string;
  lastName: string;
}) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function isWnActiveUser(user: { status: string }) {
  return user.status === "ACTIVE";
}

export const userOrderByName = [{ firstName: "asc" as const }, { lastName: "asc" as const }];

export function withDisplayName<T extends { firstName: string; lastName: string }>(user: T) {
  return { ...user, name: userDisplayName(user) };
}

export function withDisplayNameAndActive<T extends { firstName: string; lastName: string; status: string }>(
  user: T,
) {
  return { ...user, name: userDisplayName(user), active: user.status === "ACTIVE" };
}
