import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  if (error) return error;

  const { id } = await context.params;

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  if (!payslip) return apiError("Payslip not found", 404);

  if (user!.role === "EMPLOYEE" && payslip.userId !== user!.id) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(payslip);
}
