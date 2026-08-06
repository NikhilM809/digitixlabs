import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "attendance";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter =
    from && to
      ? {
          gte: new Date(from),
          lte: new Date(to),
        }
      : undefined;

  switch (type) {
    case "attendance": {
      const records = await prisma.attendance.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        include: {
          user: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { date: "desc" },
        take: 500,
      });

      return apiSuccess(
        records.map((r) => ({
          date: r.date.toISOString().split("T")[0],
          employeeId: r.user.employeeId,
          employeeName: `${r.user.firstName} ${r.user.lastName}`,
          department: r.user.department?.name ?? "-",
          status: r.status,
          checkIn: r.checkIn?.toISOString() ?? "-",
          checkOut: r.checkOut?.toISOString() ?? "-",
          workingHours: r.workingHours ?? 0,
          isLate: r.isLate,
        }))
      );
    }

    case "leave": {
      const records = await prisma.leaveRequest.findMany({
        where: dateFilter ? { fromDate: dateFilter } : undefined,
        include: {
          user: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
          leaveType: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      return apiSuccess(
        records.map((r) => ({
          employeeId: r.user.employeeId,
          employeeName: `${r.user.firstName} ${r.user.lastName}`,
          department: r.user.department?.name ?? "-",
          leaveType: r.leaveType.name,
          fromDate: r.fromDate.toISOString().split("T")[0],
          toDate: r.toDate.toISOString().split("T")[0],
          totalDays: r.totalDays,
          status: r.status,
          reason: r.reason,
        }))
      );
    }

    case "employee": {
      const where =
        user!.role === "MANAGER"
          ? { OR: [{ managerId: user!.id }, { id: user!.id }] }
          : {};

      const records = await prisma.user.findMany({
        where,
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return apiSuccess(
        records.map((r) => ({
          employeeId: r.employeeId,
          name: `${r.firstName} ${r.lastName}`,
          email: r.email,
          role: r.role,
          status: r.status,
          employmentType: r.employmentType,
          department: r.department?.name ?? "-",
          designation: r.designation?.name ?? "-",
          joiningDate: r.joiningDate.toISOString().split("T")[0],
        }))
      );
    }

    case "department": {
      const records = await prisma.department.findMany({
        include: {
          _count: { select: { employees: true } },
          employees: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return apiSuccess(
        records.map((r) => ({
          name: r.name,
          description: r.description ?? "-",
          totalEmployees: r._count.employees,
          activeEmployees: r.employees.length,
          isActive: r.isActive,
          createdAt: r.createdAt.toISOString().split("T")[0],
        }))
      );
    }

    default:
      return apiError("Invalid report type", 400);
  }
}
