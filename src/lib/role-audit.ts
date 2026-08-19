import { prisma } from "@/lib/prisma";
import type { RoleAuditAction } from "@prisma/client";

export async function createRoleAuditLog(params: {
  actorId?: string;
  action: RoleAuditAction;
  customRoleId?: string;
  userId?: string;
  details?: string;
}) {
  try {
    await prisma.roleAuditLog.create({ data: params });
  } catch (error) {
    console.error("Failed to create role audit log:", error);
  }
}
