import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { designationSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = designationSchema.parse(body);

    const existing = await prisma.designation.findFirst({
      where: { name: { equals: parsed.name, mode: "insensitive" }, NOT: { id } },
    });
    if (existing) {
      return apiError("Designation name already in use", 409);
    }

    const designation = await prisma.designation.update({
      where: { id },
      data: parsed,
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "Designation",
      entityId: designation.id,
      details: `Updated designation ${designation.name}`,
    });

    return apiSuccess(designation);
  } catch {
    return apiError("Failed to update designation", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  const employeeCount = await prisma.user.count({ where: { designationId: id } });
  if (employeeCount > 0) {
    return apiError("Cannot delete designation with assigned employees", 400);
  }

  try {
    const designation = await prisma.designation.delete({ where: { id } });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "Designation",
      entityId: designation.id,
      details: `Deleted designation ${designation.name}`,
    });

    return apiSuccess({ id: designation.id });
  } catch {
    return apiError("Failed to delete designation", 500);
  }
}
