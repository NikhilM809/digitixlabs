import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requireAuth,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeRoleDefinitionSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
  if (error) return error;

  const { id } = await context.params;
  const role = await prisma.employeeRoleDefinition.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });
  if (!role) return apiError("Role not found", 404);
  return apiSuccess(role);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const existing = await prisma.employeeRoleDefinition.findUnique({ where: { id } });
    if (!existing) return apiError("Role not found", 404);

    const body = await req.json();
    const parsed = employeeRoleDefinitionSchema.parse(body);

    if (existing.isSystem && parsed.name !== existing.name) {
      return apiError("System role names cannot be changed", 403);
    }

    const duplicate = await prisma.employeeRoleDefinition.findFirst({
      where: { name: { equals: parsed.name, mode: "insensitive" }, NOT: { id } },
    });
    if (duplicate) return apiError("A role with this name already exists", 409);

    const role = await prisma.employeeRoleDefinition.update({
      where: { id },
      data: {
        name: parsed.name.trim(),
        description: parsed.description?.trim() || null,
        accessLevel: parsed.accessLevel,
        isActive: parsed.isActive ?? existing.isActive,
      },
      include: { _count: { select: { employees: true } } },
    });

    if (existing.accessLevel !== role.accessLevel) {
      await prisma.user.updateMany({
        where: { orgRoleId: id },
        data: { role: role.accessLevel },
      });
    }

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "EmployeeRoleDefinition",
      entityId: role.id,
      details: `Updated role ${role.name}`,
    });

    return apiSuccess(role);
  } catch (err) {
    console.error(err);
    return apiError("Failed to update role", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const role = await prisma.employeeRoleDefinition.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!role) return apiError("Role not found", 404);
    if (role.isSystem) return apiError("System roles cannot be deleted", 403);
    if (role._count.employees > 0) {
      return apiError("Cannot delete a role assigned to employees", 409);
    }

    await prisma.employeeRoleDefinition.delete({ where: { id } });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "EmployeeRoleDefinition",
      entityId: id,
      details: `Deleted role ${role.name}`,
    });

    return apiSuccess({ id });
  } catch (err) {
    console.error(err);
    return apiError("Failed to delete role", 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const role = await prisma.employeeRoleDefinition.findUnique({ where: { id } });
    if (!role) return apiError("Role not found", 404);
    if (role.isSystem) return apiError("System roles cannot be deactivated", 403);

    const body = await req.json();
    const isActive = body?.isActive === true;

    const updated = await prisma.employeeRoleDefinition.update({
      where: { id },
      data: { isActive },
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "EmployeeRoleDefinition",
      entityId: id,
      details: `${isActive ? "Activated" : "Deactivated"} role ${role.name}`,
    });

    return apiSuccess(updated);
  } catch (err) {
    console.error(err);
    return apiError("Failed to update role status", 500);
  }
}
