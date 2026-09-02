import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ADMINISTRATIVE_PLACEHOLDER_PREFIX = "placeholder:";

export function getAdministrativePlaceholderNodeId(positionId: string) {
  return `${ADMINISTRATIVE_PLACEHOLDER_PREFIX}${positionId}`;
}

export function isAdministrativePlaceholderNodeId(id: string) {
  return id.startsWith(ADMINISTRATIVE_PLACEHOLDER_PREFIX);
}

export function canViewAdministrativePosition(role: RoleName) {
  return role === "ADMIN";
}

export async function getAdministrativePosition() {
  return prisma.orgAdministrativePosition.findFirst({
    where: { code: "DR", isActive: true },
    include: {
      assignees: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          managerId: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
    },
  });
}

export async function ensureAdministrativePosition() {
  return prisma.orgAdministrativePosition.upsert({
    where: { code: "DR" },
    update: {
      name: "DR (Administrative Placeholder)",
      description:
        "Admin-only dummy position for organizational planning. Not visible to non-admin users.",
      isActive: true,
    },
    create: {
      id: "org-admin-position-dr",
      code: "DR",
      name: "DR (Administrative Placeholder)",
      description:
        "Admin-only dummy position for organizational planning. Not visible to non-admin users.",
      isActive: true,
    },
  });
}

export async function assertAdminAdministrativeAccess(role: RoleName) {
  if (!canViewAdministrativePosition(role)) {
    throw new Error("Forbidden");
  }
}
