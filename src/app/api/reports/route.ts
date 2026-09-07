import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import {
  getCompanyTimezone,
  formatDateTimeInZone,
  attendanceDateFromString,
} from "@/lib/company-timezone";

async function getManagerUserFilter(userId: string) {
  const team = await prisma.user.findMany({
    where: { managerId: userId },
    select: { id: true },
  });
  return { in: [userId, ...team.map((t) => t.id)] };
}

function weekKey(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildHoursTotals(
  records: { userId: string; date: Date; workingHours: number | null }[],
) {
  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();

  for (const record of records) {
    const hours = record.workingHours ?? 0;
    const wKey = `${record.userId}:${weekKey(record.date)}`;
    const mKey = `${record.userId}:${monthKey(record.date)}`;
    weekly.set(wKey, (weekly.get(wKey) ?? 0) + hours);
    monthly.set(mKey, (monthly.get(mKey) ?? 0) + hours);
  }

  return { weekly, monthly };
}

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "MANAGER"]);
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") ?? "attendance";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const isLateParam = searchParams.get("isLate");

    const timeZone = await getCompanyTimezone();

    const dateFilter =
      from && to
        ? {
            gte: attendanceDateFromString(from),
            lte: attendanceDateFromString(to),
          }
        : undefined;

    const managerUserFilter =
      user!.role === "MANAGER" ? await getManagerUserFilter(user!.id) : undefined;

    switch (type) {
      case "attendance": {
        const where = {
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(managerUserFilter ? { userId: managerUserFilter } : {}),
          ...(employeeId ? { userId: employeeId } : {}),
          ...(isLateParam === "true"
            ? { isLate: true }
            : isLateParam === "false"
              ? { isLate: false }
              : {}),
        };

        const records = await prisma.attendance.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: [{ date: "desc" }, { user: { firstName: "asc" } }],
          take: 500,
        });

        const userIds = [...new Set(records.map((r) => r.userId))];
        const hoursSource = await prisma.attendance.findMany({
          where: {
            userId: { in: userIds },
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          select: { userId: true, date: true, workingHours: true },
        });
        const { weekly, monthly } = buildHoursTotals(hoursSource);

        return apiSuccess(
          records.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            employeeId: r.user.employeeId,
            employeeName: `${r.user.firstName} ${r.user.lastName}`,
            department: r.user.department?.name ?? "-",
            status: r.status,
            checkIn: r.checkIn ? formatDateTimeInZone(r.checkIn, timeZone) : "-",
            checkOut: r.checkOut ? formatDateTimeInZone(r.checkOut, timeZone) : "-",
            workingHours: r.workingHours ?? 0,
            weeklyHours: weekly.get(`${r.userId}:${weekKey(r.date)}`) ?? 0,
            monthlyHours: monthly.get(`${r.userId}:${monthKey(r.date)}`) ?? 0,
            isLate: r.isLate,
          }))
        );
      }

      case "leave": {
        const records = await prisma.leaveRequest.findMany({
          where: {
            ...(managerUserFilter ? { userId: managerUserFilter } : {}),
            ...(employeeId ? { userId: employeeId } : {}),
            ...(dateFilter
              ? {
                  fromDate: { lte: dateFilter.lte },
                  toDate: { gte: dateFilter.gte },
                }
              : {}),
          },
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
        if (user!.role === "MANAGER") {
          const teamUsers = await prisma.user.findMany({
            where: { OR: [{ managerId: user!.id }, { id: user!.id }], status: "ACTIVE" },
            select: { departmentId: true },
          });
          const deptIds = [...new Set(teamUsers.map((u) => u.departmentId).filter(Boolean))] as string[];

          const records = await prisma.department.findMany({
            where: { id: { in: deptIds } },
            include: {
              _count: { select: { employees: true } },
              employees: { where: { status: "ACTIVE" }, select: { id: true } },
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
  } catch (err) {
    console.error("Reports error:", err);
    return apiError("Failed to generate report", 500);
  }
}
