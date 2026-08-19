import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requirePermission,
  createAuditLog,
} from "@/lib/api-utils";
import { customRolePermissionsSchema } from "@/lib/validations";
import { createRoleAuditLog } from "@/lib/role-audit";
import {
  assertRetainsCriticalAdminAccess,
  invalidateUserPermissionCache,
} from "@/lib/authorization";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  const permissions = await prisma.customRolePermission.findMany({
    where: { customRoleId: id },
    include: {
      permission: {
        select: { id: true, name: true, description: true, module: true, action: true },
      },
    },
  });

  return apiSuccess(permissions.map((rp) => rp.permission));
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { error, user } = await requirePermission("admin.manage_permissions", ["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const role = await prisma.customRole.findUnique({ where: { id } });
    if (!role) return apiError("Role not found", 404);

    const body = await req.json();
    const parsed = customRolePermissionsSchema.parse(body);

    try {
      await assertRetainsCriticalAdminAccess(
        user!.id,
        user!.role,
        id,
        parsed.permissionIds
      );
    } catch (e) {
      return apiError(e instanceof Error ? e.message : "Permission change blocked", 403);
    }

    await prisma.customRolePermission.deleteMany({ where: { customRoleId: id } });
    if (parsed.permissionIds.length > 0) {
      await prisma.customRolePermission.createMany({
        data: parsed.permissionIds.map((permissionId) => ({
          customRoleId: id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    invalidateUserPermissionCache();

    await createRoleAuditLog({
      actorId: user!.id,
      action: "PERMISSION_CHANGE",
      customRoleId: id,
      details: JSON.stringify({ permissionCount: parsed.permissionIds.length }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "CustomRolePermission",
      entityId: id,
      details: `Updated permissions for role ${role.name}`,
    });

    const permissions = await prisma.customRolePermission.findMany({
      where: { customRoleId: id },
      include: { permission: true },
    });

    return apiSuccess(permissions.map((rp) => rp.permission));
  } catch (err) {
    console.error(err);
    return apiError("Failed to update role permissions", 500);
  }
}
