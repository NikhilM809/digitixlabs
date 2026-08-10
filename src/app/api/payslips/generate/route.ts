import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import { payslipGenerateSchema } from "@/lib/validations";
import { canGeneratePayslip } from "@/lib/permissions";
import { generatePayslipPdfBuffer } from "@/lib/payslip-pdf";

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  if (!canGeneratePayslip(user!.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await req.json();
    const parsed = payslipGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { userId, month, year, salary, bonus, deductions } = parsed.data;
    const netSalary = salary + bonus - deductions;

    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });

    if (!employee) {
      return apiError("Employee not found", 404);
    }

    const settings = await prisma.companySettings.findFirst();
    const companyName = settings?.companyName ?? "Digitix Labs";

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const payableDays = await prisma.attendance.count({
      where: {
        userId,
        date: { gte: monthStart, lte: monthEnd },
        status: { in: ["PRESENT", "LATE", "HALF_DAY", "WORK_FROM_HOME"] },
      },
    });

    const pdfBuffer = generatePayslipPdfBuffer({
      companyName,
      companyEmail: settings?.companyEmail,
      employeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation?.name ?? "-",
      department: employee.department?.name ?? "-",
      month,
      year,
      salary,
      bonus,
      deductions,
      netSalary,
      payableDays,
      totalDaysInMonth: daysInMonth(month, year),
      generatedAt: new Date(),
    });

    const payslipDir = path.join(process.cwd(), "public", "generated-payslips");
    await mkdir(payslipDir, { recursive: true });

    const filename = `payslip-${employee.employeeId}-${month}-${year}.pdf`;
    const filePath = path.join(payslipDir, filename);
    await writeFile(filePath, pdfBuffer);

    const fileUrl = `/generated-payslips/${filename}`;

    const payslip = await prisma.payslip.upsert({
      where: {
        userId_month_year: { userId, month, year },
      },
      create: {
        userId,
        month,
        year,
        salary,
        bonus,
        deductions,
        netSalary,
        fileUrl,
        uploadedBy: user!.id,
      },
      update: {
        salary,
        bonus,
        deductions,
        netSalary,
        fileUrl,
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
      userId,
      type: "PAYSLIP_UPLOADED",
      title: "Payslip Available",
      message: `Your payslip for ${month}/${year} has been generated.`,
      link: "/payslips",
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "Payslip",
      entityId: payslip.id,
      details: `Generated PDF payslip for ${employee.firstName} ${employee.lastName} (${month}/${year})`,
    });

    return apiSuccess(payslip, 201);
  } catch (err) {
    console.error("Payslip generate error:", err);
    return apiError("Failed to generate payslip", 500);
  }
}
