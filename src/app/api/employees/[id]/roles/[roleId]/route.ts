import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requirePermission,
  createAuditLog,
} from "@/lib/api-utils";
import { createRoleAuditLog } from "@/lib/role-audit";
import { invalidateUserPermissionCache } from "@/lib/authorization";

type RouteContext = { params: Promise<{ id: string; roleId: string }> };

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id: employeeId, roleId: assignmentId } = await context.params;
  const { error, user } = await requirePermission("admin.manage_users", ["ADMIN", "HR"]);
  if (error) return error;

  try {
    const assignment = await prisma.userCustomRole.findFirst({
      where: { id: assignmentId, userId: employeeId },
      include: {
        customRole: { select: { id: true, name: true, isSystem: true, systemRoleKey: true } },
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    if (!assignment) return apiError("Role assignment not found", 404);

    await prisma.userCustomRole.delete({ where: { id: assignmentId } });

    invalidateUserPermissionCache(employeeId);

    await createRoleAuditLog({
      actorId: user!.id,
      action: "REMOVE",
      customRoleId: assignment.customRole.id,
      userId: employeeId,
      details: JSON.stringify({ roleName: assignment.customRole.name }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "UserCustomRole",
      entityId: assignmentId,
      details: `Removed role ${assignment.customRole.name} from ${assignment.user.firstName} ${assignment.user.lastName}`,
    });

    return apiSuccess({ id: assignmentId });
  } catch (err) {
    console.error(err);
    return apiError("Failed to remove role assignment", 500);
  }
}
