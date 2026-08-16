import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { canViewEmployeeDependents } from "@/lib/permissions";
import { getDependentDetailsEnabled } from "@/lib/dependent-details-settings";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error || !user) return error;

  if (!canViewEmployeeDependents(user.role)) {
    return apiError("Forbidden", 403);
  }

  const enabled = await getDependentDetailsEnabled();
  if (!enabled) {
    return apiSuccess({ enabled: false, dependents: [] });
  }

  const { id } = await context.params;

  const employee = await prisma.user.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return apiError("Employee not found", 404);
  }

  const dependents = await prisma.employeeDependent.findMany({
    where: { userId: id },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess({ enabled: true, dependents });
}
