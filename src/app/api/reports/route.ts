import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import {
  getCompanyTimezone,
  formatDateTimeInZone,
  attendanceDateFromString,
  getDateStringInZone,
} from "@/lib/company-timezone";
import {
  expandToMonthBounds,
  expandToWeekBounds,
  monthKeyInZone,
  resolveWorkingHours,
  roundHours,
  weekKeyInZone,
} from "@/lib/attendance-hours";

async function getManagerUserFilter(userId: string) {
  const team = await prisma.user.findMany({
    where: { managerId: userId },
    select: { id: true },
  });
  return { in: [userId, ...team.map((t) => t.id)] };
}

function buildHoursTotals(
  records: {
    userId: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    workingHours: number | null;
  }[],
  timeZone: string,
) {
  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();

  for (const record of records) {
    const hours = resolveWorkingHours(
      record.date,
      record.checkIn,
      record.checkOut,
      record.workingHours,
      timeZone,
    );
    const wKey = `${record.userId}:${weekKeyInZone(record.date, timeZone)}`;
    const mKey = `${record.userId}:${monthKeyInZone(record.date, timeZone)}`;
    weekly.set(wKey, roundHours((weekly.get(wKey) ?? 0) + hours));
    monthly.set(mKey, roundHours((monthly.get(mKey) ?? 0) + hours));
  }

  return { weekly, monthly };
}

function getExpandedHoursRange(
  records: { date: Date }[],
  timeZone: string,
) {
  if (records.length === 0) return null;

  let min = records[0].date;
  let max = records[0].date;
  for (const record of records) {
    if (record.date < min) min = record.date;
    if (record.date > max) max = record.date;
  }

  const minMonth = expandToMonthBounds(monthKeyInZone(min, timeZone));
  const maxMonth = expandToMonthBounds(monthKeyInZone(max, timeZone));
  const minWeek = expandToWeekBounds(weekKeyInZone(min, timeZone));
  const maxWeek = expandToWeekBounds(weekKeyInZone(max, timeZone));

  const start = new Date(Math.min(minMonth.start.getTime(), minWeek.start.getTime()));
  const end = new Date(Math.max(maxMonth.end.getTime(), maxWeek.end.getTime()));
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
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
        const expandedRange = getExpandedHoursRange(records, timeZone);

        const hoursSource = expandedRange
          ? await prisma.attendance.findMany({
              where: {
                userId: { in: userIds },
                date: { gte: expandedRange.start, lte: expandedRange.end },
              },
              select: {
                userId: true,
                date: true,
                checkIn: true,
                checkOut: true,
                workingHours: true,
              },
            })
          : [];

        const { weekly, monthly } = buildHoursTotals(hoursSource, timeZone);

        const lastWeeklyRow = new Map<string, string>();
        const lastMonthlyRow = new Map<string, string>();

        for (const record of records) {
          const dateKey = getDateStringInZone(record.date, timeZone);
          const weekKey = `${record.userId}:${weekKeyInZone(record.date, timeZone)}`;
          const monthKey = `${record.userId}:${monthKeyInZone(record.date, timeZone)}`;

          const existingWeek = lastWeeklyRow.get(weekKey);
          if (!existingWeek || dateKey > existingWeek) {
            lastWeeklyRow.set(weekKey, dateKey);
          }

          const existingMonth = lastMonthlyRow.get(monthKey);
          if (!existingMonth || dateKey > existingMonth) {
            lastMonthlyRow.set(monthKey, dateKey);
          }
        }

        return apiSuccess(
          records.map((r) => {
            const dateKey = getDateStringInZone(r.date, timeZone);
            const weekKey = `${r.userId}:${weekKeyInZone(r.date, timeZone)}`;
            const monthKey = `${r.userId}:${monthKeyInZone(r.date, timeZone)}`;
            const workingHours = resolveWorkingHours(
              r.date,
              r.checkIn,
              r.checkOut,
              r.workingHours,
              timeZone,
            );
            const weeklyTotal = weekly.get(weekKey) ?? 0;
            const monthlyTotal = monthly.get(monthKey) ?? 0;

            return {
              date: r.date.toISOString().split("T")[0],
              employeeId: r.user.employeeId,
              employeeName: `${r.user.firstName} ${r.user.lastName}`,
              department: r.user.department?.name ?? "-",
              status: r.status,
              checkIn: r.checkIn ? formatDateTimeInZone(r.checkIn, timeZone) : "-",
              checkOut: r.checkOut ? formatDateTimeInZone(r.checkOut, timeZone) : "-",
              workingHours,
              weeklyHours: lastWeeklyRow.get(weekKey) === dateKey ? weeklyTotal : "",
              monthlyHours: lastMonthlyRow.get(monthKey) === dateKey ? monthlyTotal : "",
              isLate: r.isLate,
            };
          })
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
