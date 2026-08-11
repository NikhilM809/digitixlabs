import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeKraConfigSchema } from "@/lib/validations";
import { canAccessKra } from "@/lib/permissions";
import { canManageEmployeeKra } from "@/lib/employee-kra";

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = employeeKraConfigSchema.safeParse(body);
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

    const existing = await prisma.employeeKraConfig.findUnique({
      where: { userId: parsed.data.userId },
    });
    if (existing?.isFinalized) {
      return apiError("KRA configuration is finalized. Reopen before editing.", 400);
    }

    const config = await prisma.employeeKraConfig.upsert({
      where: { userId: parsed.data.userId },
      create: {
        userId: parsed.data.userId,
        reviewCycle: parsed.data.reviewCycle ?? "MONTHLY",
        periodLabel: parsed.data.periodLabel ?? null,
        remarks: parsed.data.remarks ?? null,
      },
      update: {
        reviewCycle: parsed.data.reviewCycle ?? undefined,
        periodLabel: parsed.data.periodLabel ?? undefined,
        remarks: parsed.data.remarks ?? undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "EmployeeKraConfig",
      entityId: parsed.data.userId,
      details: `Updated KRA configuration for ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(config);
  } catch (err) {
    console.error("Employee KRA config update error:", err);
    return apiError("Failed to update KRA configuration", 500);
  }
}
