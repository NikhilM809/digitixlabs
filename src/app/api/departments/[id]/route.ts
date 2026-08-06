import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { departmentSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = departmentSchema.parse(body);

    const existing = await prisma.department.findFirst({
      where: { name: parsed.name, NOT: { id } },
    });
    if (existing) {
      return apiError("Department name already in use", 409);
    }

    const department = await prisma.department.update({
      where: { id },
      data: parsed,
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "Department",
      entityId: department.id,
      details: `Updated department ${department.name}`,
    });

    return apiSuccess(department);
  } catch {
    return apiError("Failed to update department", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  const employeeCount = await prisma.user.count({ where: { departmentId: id } });
  if (employeeCount > 0) {
    return apiError("Cannot delete department with assigned employees", 400);
  }

  try {
    const department = await prisma.department.delete({ where: { id } });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "Department",
      entityId: department.id,
      details: `Deleted department ${department.name}`,
    });

    return apiSuccess({ id: department.id });
  } catch {
    return apiError("Failed to delete department", 500);
  }
}
