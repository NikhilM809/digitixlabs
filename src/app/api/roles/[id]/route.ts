import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requirePermission,
  createAuditLog,
} from "@/lib/api-utils";
import { customRoleSchema } from "@/lib/validations";
import { roleDetailInclude } from "@/lib/role-utils";
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

  const role = await prisma.customRole.findUnique({
    where: { id },
    include: roleDetailInclude,
  });

  if (!role) return apiError("Role not found", 404);

  return apiSuccess(role);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { error, user } = await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const existing = await prisma.customRole.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!existing) return apiError("Role not found", 404);

    const body = await req.json();
    const parsed = customRoleSchema.parse(body);

    if (existing.isSystem && parsed.name && parsed.name !== existing.name) {
      return apiError("System role names cannot be changed", 403);
    }

    const duplicateName = await prisma.customRole.findFirst({
      where: {
        name: { equals: parsed.name, mode: "insensitive" },
        NOT: { id },
      },
    });
    if (duplicateName) {
      return apiError("A role with this name already exists", 409);
    }

    if (parsed.code && parsed.code !== existing.code) {
      const codeTaken = await prisma.customRole.findFirst({
        where: { code: parsed.code, NOT: { id } },
      });
      if (codeTaken) return apiError("A role with this code already exists", 409);
    }

    const role = await prisma.customRole.update({
      where: { id },
      data: {
        name: parsed.name.trim(),
        ...(parsed.code ? { code: parsed.code.trim() } : {}),
        description: parsed.description?.trim() || null,
        departmentId: parsed.departmentId || null,
        managerId: parsed.managerId || null,
        parentRoleId: parsed.parentRoleId || null,
        hierarchyLevel: parsed.hierarchyLevel ?? existing.hierarchyLevel,
        status: parsed.status ?? existing.status,
      },
      include: roleDetailInclude,
    });

    if (parsed.permissionIds) {
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
    }

    await createRoleAuditLog({
      actorId: user!.id,
      action: "UPDATE",
      customRoleId: id,
      details: JSON.stringify({ name: role.name }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "CustomRole",
      entityId: id,
      details: `Updated role ${role.name}`,
    });

    const updated = await prisma.customRole.findUnique({
      where: { id },
      include: roleDetailInclude,
    });

    return apiSuccess(updated);
  } catch (err) {
    console.error(err);
    return apiError("Failed to update role", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const role = await prisma.customRole.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true, childRoles: true } } },
    });

    if (!role) return apiError("Role not found", 404);
    if (role.isSystem) return apiError("System roles cannot be deleted", 403);
    if (role._count.userRoles > 0) {
      return apiError("Cannot delete a role assigned to employees", 409);
    }
    if (role._count.childRoles > 0) {
      return apiError("Cannot delete a role that has child roles in the hierarchy", 409);
    }

    await prisma.customRole.delete({ where: { id } });

    await createRoleAuditLog({
      actorId: user!.id,
      action: "DELETE",
      customRoleId: id,
      details: JSON.stringify({ name: role.name, code: role.code }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "CustomRole",
      entityId: id,
      details: `Deleted role ${role.name}`,
    });

    invalidateUserPermissionCache();

    return apiSuccess({ id });
  } catch (err) {
    console.error(err);
    return apiError("Failed to delete role", 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { error, user } = await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    const role = await prisma.customRole.findUnique({ where: { id } });
    if (!role) return apiError("Role not found", 404);
    if (role.isSystem && action === "deactivate") {
      return apiError("System roles cannot be deactivated", 403);
    }

    if (action === "activate") {
      const updated = await prisma.customRole.update({
        where: { id },
        data: { status: "ACTIVE" },
        include: roleDetailInclude,
      });
      await createRoleAuditLog({
        actorId: user!.id,
        action: "ACTIVATE",
        customRoleId: id,
      });
      return apiSuccess(updated);
    }

    if (action === "deactivate") {
      const updated = await prisma.customRole.update({
        where: { id },
        data: { status: "INACTIVE" },
        include: roleDetailInclude,
      });
      await createRoleAuditLog({
        actorId: user!.id,
        action: "DEACTIVATE",
        customRoleId: id,
      });
      invalidateUserPermissionCache();
      return apiSuccess(updated);
    }

    return apiError("Invalid action", 400);
  } catch (err) {
    console.error(err);
    return apiError("Failed to update role status", 500);
  }
}
