import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeKraUpdateSchema } from "@/lib/validations";
import { canAccessKra } from "@/lib/permissions";
import {
  canManageEmployeeKra,
  kraWeightMessage,
  summarizeKraWeights,
} from "@/lib/employee-kra";

async function buildKraResponse(userId: string) {
  const [items, config] = await Promise.all([
    prisma.employeeKra.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.employeeKraConfig.findUnique({ where: { userId } }),
  ]);

  const weightSummary = summarizeKraWeights(items.map((i) => i.weight));

  return {
    items,
    config: config ?? { userId, isFinalized: false, finalizedAt: null, finalizedById: null },
    weightSummary,
    weightMessage: kraWeightMessage(weightSummary),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await params;
  const existing = await prisma.employeeKra.findUnique({ where: { id } });
  if (!existing) {
    return apiError("KRA not found", 404);
  }

  const employee = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { id: true, managerId: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return apiError("Employee not found", 404);
  }

  if (!(await canManageEmployeeKra(user.role, user.id, employee))) {
    return apiError("Forbidden", 403);
  }

  const config = await prisma.employeeKraConfig.findUnique({
    where: { userId: existing.userId },
  });
  if (config?.isFinalized) {
    return apiError("KRA configuration is finalized. Reopen before editing.", 400);
  }

  try {
    const body = await request.json();
    const parsed = employeeKraUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    await prisma.employeeKra.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedById: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "EmployeeKra",
      entityId: id,
      details: `Updated KRA for ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(await buildKraResponse(existing.userId));
  } catch (err) {
    console.error("Employee KRA update error:", err);
    return apiError("Failed to update KRA", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await params;
  const existing = await prisma.employeeKra.findUnique({ where: { id } });
  if (!existing) {
    return apiError("KRA not found", 404);
  }

  const employee = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { id: true, managerId: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return apiError("Employee not found", 404);
  }

  if (!(await canManageEmployeeKra(user.role, user.id, employee))) {
    return apiError("Forbidden", 403);
  }

  const config = await prisma.employeeKraConfig.findUnique({
    where: { userId: existing.userId },
  });
  if (config?.isFinalized) {
    return apiError("KRA configuration is finalized. Reopen before editing.", 400);
  }

  await prisma.employeeKra.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entity: "EmployeeKra",
    entityId: id,
    details: `Removed KRA "${existing.name}" for ${employee.firstName} ${employee.lastName}`,
  });

  return apiSuccess(await buildKraResponse(existing.userId));
}
