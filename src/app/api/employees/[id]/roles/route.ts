import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requirePermission,
  requireAuth,
  createAuditLog,
} from "@/lib/api-utils";
import { assignUserRoleSchema } from "@/lib/validations";
import { createRoleAuditLog } from "@/lib/role-audit";
import { invalidateUserPermissionCache } from "@/lib/authorization";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id: employeeId } = await context.params;
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, managerId: true },
  });
  if (!employee) return apiError("Employee not found", 404);

  if (
    user!.id !== employeeId &&
    user!.role === "MANAGER" &&
    employee.managerId !== user!.id
  ) {
    return apiError("Forbidden", 403);
  }

  const assignments = await prisma.userCustomRole.findMany({
    where: { userId: employeeId },
    include: {
      customRole: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          isSystem: true,
          department: { select: { id: true, name: true } },
        },
      },
      assignedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { effectiveFrom: "desc" },
  });

  return apiSuccess(assignments);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id: employeeId } = await context.params;
  const { error, user } = await requirePermission("admin.manage_users", ["ADMIN", "HR"]);
  if (error) return error;

  try {
    const employee = await prisma.user.findUnique({ where: { id: employeeId } });
    if (!employee) return apiError("Employee not found", 404);

    const body = await req.json();
    const parsed = assignUserRoleSchema.parse(body);

    const role = await prisma.customRole.findUnique({
      where: { id: parsed.customRoleId },
    });
    if (!role) return apiError("Role not found", 404);
    if (role.status !== "ACTIVE") {
      return apiError("Cannot assign an inactive role", 400);
    }

    const effectiveFrom = parsed.effectiveFrom
      ? new Date(parsed.effectiveFrom)
      : new Date();
    const effectiveTo = parsed.effectiveTo ? new Date(parsed.effectiveTo) : null;

    const existing = await prisma.userCustomRole.findFirst({
      where: {
        userId: employeeId,
        customRoleId: parsed.customRoleId,
        effectiveTo: null,
      },
    });

    if (existing) {
      return apiError("Employee already has this role assigned", 409);
    }

    const assignment = await prisma.userCustomRole.create({
      data: {
        userId: employeeId,
        customRoleId: parsed.customRoleId,
        effectiveFrom,
        effectiveTo,
        assignedById: user!.id,
      },
      include: {
        customRole: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            department: { select: { name: true } },
          },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    invalidateUserPermissionCache(employeeId);

    await createRoleAuditLog({
      actorId: user!.id,
      action: "ASSIGN",
      customRoleId: parsed.customRoleId,
      userId: employeeId,
      details: JSON.stringify({
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveTo: effectiveTo?.toISOString() ?? null,
      }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "UserCustomRole",
      entityId: assignment.id,
      details: `Assigned role ${role.name} to ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(assignment, 201);
  } catch (err) {
    console.error(err);
    return apiError("Failed to assign role", 500);
  }
}
