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

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const userId = searchParams.get("userId");

  const where: Prisma.PayslipWhereInput = {};

  if (user!.role === "EMPLOYEE") {
    where.userId = user!.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (month) where.month = parseInt(month, 10);
  if (year) where.year = parseInt(year, 10);

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
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = payslipSchema.parse(body);
    const netSalary = parsed.salary + parsed.bonus - parsed.deductions;

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
        bonus: parsed.bonus,
        deductions: parsed.deductions,
        netSalary,
        fileUrl: parsed.fileUrl,
        uploadedBy: user!.id,
      },
      update: {
        salary: parsed.salary,
        bonus: parsed.bonus,
        deductions: parsed.deductions,
        netSalary,
        fileUrl: parsed.fileUrl,
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
