import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { canViewAllSalaries } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

async function canAccessPayslip(
  payslipUserId: string,
  role: string,
  userId: string
): Promise<boolean> {
  if (canViewAllSalaries(role as "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE")) return true;
  return payslipUserId === userId;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "HR", "MANAGER", "EMPLOYEE"]);
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

    const allowed = await canAccessPayslip(payslip.userId, user!.role, user!.id);
    if (!allowed) return apiError("Forbidden", 403);

    return apiSuccess(payslip);
  } catch (err) {
    console.error("Payslip GET error:", err);
    return apiError("Failed to fetch payslip", 500);
  }
}
