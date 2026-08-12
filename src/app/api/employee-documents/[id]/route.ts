import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { canManageEmployeeDocuments } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error || !user) return error;

  if (!canManageEmployeeDocuments(user.role)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.employeeDocument.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!existing || !existing.isActive) {
      return apiError("Document not found", 404);
    }

    await prisma.employeeDocument.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entity: "EmployeeDocument",
      entityId: id,
      details: `Removed document "${existing.title}" for ${existing.user.firstName} ${existing.user.lastName}`,
    });

    return apiSuccess({ id });
  } catch {
    return apiError("Failed to remove document", 500);
  }
}
