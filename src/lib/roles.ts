import type { RoleName } from "@prisma/client";

export function isManager(role: RoleName) {
  return role === "MANAGER" || role === "ADMIN";
}

export function isAdmin(role: RoleName) {
  return role === "ADMIN";
}
