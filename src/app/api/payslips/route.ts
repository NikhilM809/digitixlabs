import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import { payslipSchema } from "@/lib/validations";
import type { Prisma } from "@prisma/client";
import { calculateNetSalary } from "@/lib/payslip-calc";
import { canUploadPayslip, canViewAllSalaries } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "HR", "MANAGER", "EMPLOYEE"]);
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const userId = searchParams.get("userId");

    const where: Prisma.PayslipWhereInput = {};

    if (canViewAllSalaries(user!.role)) {
      if (userId) where.userId = userId;
    } else {
      where.userId = user!.id;
    }

    if (month) {
      const m = parseInt(month, 10);
      if (isNaN(m) || m < 1 || m > 12) return apiError("Invalid month", 400);
      where.month = m;
    }
    if (year) {
      const y = parseInt(year, 10);
      if (isNaN(y)) return apiError("Invalid year", 400);
      where.year = y;
    }

    const payslips = await prisma.payslip.findMany({
      where,
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
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return apiSuccess(payslips);
  } catch (err) {
    console.error("Payslips GET error:", err);
    return apiError("Failed to fetch payslips", 500);
  }
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  if (!canUploadPayslip(user!.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await req.json();
    const parsed = payslipSchema.parse(body);

    const employee = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { baseSalary: true, firstName: true, lastName: true },
    });
    if (!employee) {
      return apiError("Employee not found", 404);
    }
    if (!employee.baseSalary || employee.baseSalary <= 0) {
      return apiError(
        "Basic salary is not configured for this employee. Update it in Employee Management before creating a payslip.",
        400
      );
    }

    const netSalary = calculateNetSalary(parsed);

    const payslip = await prisma.payslip.upsert({
      where: {
        userId_month_year: {
          userId: parsed.userId,
          month: parsed.month,
          year: parsed.year,
        },
      },
      create: {
        userId: parsed.userId,
        month: parsed.month,
        year: parsed.year,
        salary: parsed.salary,
        hra: parsed.hra,
        specialAllowance: parsed.specialAllowance,
        internetAllowance: parsed.internetAllowance,
        performanceBonus: parsed.performanceBonus,
        deductions: parsed.deductions,
        netSalary,
        fileUrl: parsed.fileUrl || null,
        uploadedBy: user!.id,
      },
      update: {
        salary: parsed.salary,
        hra: parsed.hra,
        specialAllowance: parsed.specialAllowance,
        internetAllowance: parsed.internetAllowance,
        performanceBonus: parsed.performanceBonus,
        deductions: parsed.deductions,
        netSalary,
        fileUrl: parsed.fileUrl || null,
        uploadedBy: user!.id,
      },
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

    await createNotification({
      userId: parsed.userId,
      type: "PAYSLIP_UPLOADED",
      title: "Payslip Available",
      message: `Your payslip for ${parsed.month}/${parsed.year} has been uploaded.`,
      link: "/payslips",
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "Payslip",
      entityId: payslip.id,
      details: `Uploaded payslip for ${payslip.user.firstName} ${payslip.user.lastName} (${parsed.month}/${parsed.year})`,
    });

    return apiSuccess(payslip, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid payslip data", 422);
    }
    console.error(err);
    return apiError("Failed to upload payslip", 500);
  }
}
