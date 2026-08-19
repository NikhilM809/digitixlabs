import { NextRequest } from "next/server";
import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { canViewTeam, isAdminOrHr } from "@/lib/permissions";
import { assertCanViewOrgStructure } from "@/lib/org-hierarchy-settings";
import { getDirectReports, getReportingHistory } from "@/lib/org-hierarchy";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canViewTeam(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    if (!isAdminOrHr(user.role)) {
      await assertCanViewOrgStructure(user.role);
    }
    const targetUserId = request.nextUrl.searchParams.get("userId");
    const managerId =
      targetUserId && isAdminOrHr(user.role)
        ? targetUserId
        : user.id;

    if (
      user.role === RoleName.MANAGER &&
      managerId !== user.id
    ) {
      return apiError("Forbidden", 403);
    }

    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        role: true,
        designation: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    if (!manager) {
      return apiError("Manager not found", 404);
    }

    const directReports = await getDirectReports(managerId, { activeOnly: true });
    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true" &&
      isAdminOrHr(user.role);
    const allReports = includeInactive
      ? await getDirectReports(managerId, { activeOnly: false })
      : directReports;

    return apiSuccess({
      manager,
      directReports: allReports,
      activeCount: directReports.length,
    });
  } catch (err) {
    console.error("Team GET error:", err);
    return apiError("Failed to load team", 500);
  }
}
