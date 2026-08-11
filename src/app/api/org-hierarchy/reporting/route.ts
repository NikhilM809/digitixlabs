import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { canManageOrgHierarchy } from "@/lib/permissions";
import { getDirectReports, getReportingHistory } from "@/lib/org-hierarchy";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const userId = request.nextUrl.searchParams.get("userId") ?? user.id;

  if (userId !== user.id && !canManageOrgHierarchy(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: { select: { name: true } },
          },
        },
      },
    });

    if (!employee) {
      return apiError("Employee not found", 404);
    }

    const directReports = await getDirectReports(userId, { activeOnly: true });
    const history =
      userId === user.id || canManageOrgHierarchy(user.role)
        ? await getReportingHistory(userId)
        : [];

    return apiSuccess({
      employee,
      manager: employee.manager,
      directReports,
      history,
    });
  } catch (err) {
    console.error("Reporting GET error:", err);
    return apiError("Failed to load reporting information", 500);
  }
}
