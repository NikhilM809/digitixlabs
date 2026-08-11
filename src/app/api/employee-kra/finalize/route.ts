import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeKraFinalizeSchema } from "@/lib/validations";
import { canAccessKra } from "@/lib/permissions";
import {
  canManageEmployeeKra,
  kraWeightMessage,
  summarizeKraWeights,
} from "@/lib/employee-kra";

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = employeeKraFinalizeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const employee = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, managerId: true, firstName: true, lastName: true },
    });
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    if (!(await canManageEmployeeKra(user.role, user.id, employee))) {
      return apiError("Forbidden", 403);
    }

    const items = await prisma.employeeKra.findMany({
      where: { userId: parsed.data.userId },
    });

    if (items.length === 0) {
      return apiError("Add at least one KRA before finalizing", 400);
    }

    const weightSummary = summarizeKraWeights(items.map((i) => i.weight));
    if (!weightSummary.isValid) {
      return apiError(kraWeightMessage(weightSummary), 400);
    }

    const config = await prisma.employeeKraConfig.upsert({
      where: { userId: parsed.data.userId },
      create: {
        userId: parsed.data.userId,
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedById: user.id,
      },
      update: {
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedById: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "EmployeeKraConfig",
      entityId: parsed.data.userId,
      details: `Finalized KRA configuration for ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess({
      config,
      weightSummary,
      weightMessage: kraWeightMessage(weightSummary),
    });
  } catch (err) {
    console.error("Employee KRA finalize error:", err);
    return apiError("Failed to finalize KRA configuration", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return apiError("userId is required", 400);
  }

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, managerId: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return apiError("Employee not found", 404);
  }

  if (!(await canManageEmployeeKra(user.role, user.id, employee))) {
    return apiError("Forbidden", 403);
  }

  const config = await prisma.employeeKraConfig.upsert({
    where: { userId },
    create: { userId, isFinalized: false },
    update: {
      isFinalized: false,
      finalizedAt: null,
      finalizedById: null,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entity: "EmployeeKraConfig",
    entityId: userId,
    details: `Reopened KRA configuration for ${employee.firstName} ${employee.lastName}`,
  });

  return apiSuccess(config);
}
