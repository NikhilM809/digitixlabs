import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { formatDateTime } from "@/lib/utils";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getLast6Months() {
  const months: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString("en-IN", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

function buildEmployeeScope(role: RoleName, userId: string) {
  if (role === RoleName.ADMIN) {
    return { status: "ACTIVE" as const };
  }
  if (role === RoleName.MANAGER) {
    return { OR: [{ managerId: userId }, { id: userId }], status: "ACTIVE" as const };
  }
  return { id: userId };
}

export async function GET() {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const today = startOfDay();
    const todayEnd = endOfDay();
    const employeeScope = buildEmployeeScope(user.role, user.id);
    const scopedUserIds =
      user.role === RoleName.EMPLOYEE
        ? [user.id]
        : (
            await prisma.user.findMany({
              where: employeeScope,
              select: { id: true },
            })
          ).map((u) => u.id);

    const [
      employeeCount,
      presentToday,
      onLeaveToday,
      pendingApprovals,
      upcomingHolidays,
      employees,
      attendances,
      leaveRequests,
      departments,
      leaveTypes,
      auditLogs,
      announcements,
    ] = await Promise.all([
      user.role === RoleName.EMPLOYEE
        ? Promise.resolve(1)
        : prisma.user.count({ where: employeeScope }),

      prisma.attendance.count({
        where: {
          userId: { in: scopedUserIds },
          date: today,
          status: { in: ["PRESENT", "LATE", "WORK_FROM_HOME", "HALF_DAY"] },
        },
      }),

      prisma.leaveRequest.count({
        where: {
          userId: { in: scopedUserIds },
          status: "APPROVED",
          fromDate: { lte: todayEnd },
          toDate: { gte: today },
        },
      }),

      user.role === RoleName.EMPLOYEE
        ? prisma.leaveRequest.count({
            where: { userId: user.id, status: "PENDING" },
          })
        : prisma.leaveRequest.count({
            where: {
              userId: { in: scopedUserIds },
              status: "PENDING",
            },
          }),

      prisma.holidayCalendar.findMany({
        where: { isActive: true, date: { gte: today } },
        orderBy: { date: "asc" },
        take: 5,
      }),

      prisma.user.findMany({
        where:
          user.role === RoleName.EMPLOYEE
            ? { id: user.id }
            : { ...employeeScope, dateOfBirth: { not: null } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          joiningDate: true,
        },
      }),

      prisma.attendance.findMany({
        where: {
          userId: { in: scopedUserIds },
          date: {
            gte: new Date(today.getFullYear(), today.getMonth() - 5, 1),
          },
        },
        select: { date: true, status: true },
      }),

      prisma.leaveRequest.findMany({
        where: {
          userId: { in: scopedUserIds },
          createdAt: {
            gte: new Date(today.getFullYear(), today.getMonth() - 5, 1),
          },
        },
        select: { createdAt: true, status: true, totalDays: true, leaveTypeId: true, fromDate: true, toDate: true },
      }),

      user.role === RoleName.EMPLOYEE
        ? Promise.resolve([])
        : prisma.department.findMany({
            where: { isActive: true },
            include: { _count: { select: { employees: true } } },
          }),

      prisma.leaveType.findMany({ where: { isActive: true } }),

      isManager(user.role)
        ? prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          })
        : prisma.auditLog.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          }),

      prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const birthdays = employees
      .filter((emp) => {
        if (!emp.dateOfBirth) return false;
        const dob = new Date(emp.dateOfBirth);
        const thisYearBirthday = new Date(
          now.getFullYear(),
          dob.getMonth(),
          dob.getDate()
        );
        return thisYearBirthday >= today && thisYearBirthday <= in30Days;
      })
      .map((emp) => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        date: new Date(
          now.getFullYear(),
          new Date(emp.dateOfBirth!).getMonth(),
          new Date(emp.dateOfBirth!).getDate()
        ).toISOString(),
      }));

    const workAnniversaries = employees
      .filter((emp) => {
        const joinDate = new Date(emp.joiningDate);
        if (joinDate.getFullYear() === now.getFullYear()) return false;
        const anniversary = new Date(
          now.getFullYear(),
          joinDate.getMonth(),
          joinDate.getDate()
        );
        return anniversary >= today && anniversary <= in30Days;
      })
      .map((emp) => {
        const joinDate = new Date(emp.joiningDate);
        const years = now.getFullYear() - joinDate.getFullYear();
        return {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          date: new Date(
            now.getFullYear(),
            joinDate.getMonth(),
            joinDate.getDate()
          ).toISOString(),
          years,
        };
      });

    const months = getLast6Months();
    const attendanceTrend = months.map(({ label, year, month }) => {
      const monthAttendances = attendances.filter((a) => {
        const d = new Date(a.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      return {
        month: label,
        present: monthAttendances.filter((a) =>
          ["PRESENT", "WORK_FROM_HOME"].includes(a.status)
        ).length,
        absent: monthAttendances.filter((a) => a.status === "ABSENT").length,
        late: monthAttendances.filter((a) => a.status === "LATE").length,
      };
    });

    const leaveTrend = months.map(({ label, year, month }) => {
      const monthLeaves = leaveRequests.filter((l) => {
        const d = new Date(l.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      return {
        month: label,
        approved: monthLeaves.filter((l) => l.status === "APPROVED").length,
        rejected: monthLeaves.filter((l) => l.status === "REJECTED").length,
        pending: monthLeaves.filter((l) => l.status === "PENDING").length,
      };
    });

    const departmentWiseEmployees =
      user.role === RoleName.EMPLOYEE
        ? []
        : user.role === RoleName.MANAGER
          ? await Promise.all(
              departments.map(async (dept) => ({
                name: dept.name,
                count: await prisma.user.count({
                  where: {
                    departmentId: dept.id,
                    status: "ACTIVE",
                    OR: [{ managerId: user.id }, { id: user.id }],
                  },
                }),
              }))
            )
          : departments.map((dept) => ({
              name: dept.name,
              count: dept._count.employees,
            }));

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyLeaves = leaveRequests.filter((l) => {
      if (l.status !== "APPROVED") return false;
      const from = new Date(l.fromDate);
      const to = new Date(l.toDate);
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      return from <= monthEnd && to >= monthStart;
    });

    const monthlyLeaveSummary = leaveTypes.map((type) => ({
      type: type.name,
      days: monthlyLeaves
        .filter((l) => l.leaveTypeId === type.id)
        .reduce((sum, l) => sum + l.totalDays, 0),
    }));

    const recentActivities = auditLogs.map((log) => ({
      id: log.id,
      title: `${log.action} ${log.entity}`,
      description: log.details || `By ${log.user?.firstName ?? "System"} ${log.user?.lastName ?? ""}`.trim(),
      time: formatDateTime(log.createdAt),
      type: mapAuditToActivityType(log.entity),
    }));

    const upcomingEvents = [
      ...upcomingHolidays.map((h) => ({
        id: h.id,
        title: h.name,
        date: h.date.toISOString(),
        type: "holiday" as const,
      })),
      ...birthdays.map((b) => ({
        id: b.id,
        title: `${b.name}'s Birthday`,
        date: b.date,
        type: "birthday" as const,
      })),
      ...workAnniversaries.map((a) => ({
        id: a.id,
        title: `${a.name} - ${a.years} Year${a.years > 1 ? "s" : ""}`,
        date: a.date,
        type: "anniversary" as const,
      })),
    ]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);

    return apiSuccess({
      stats: {
        employeeCount,
        presentToday,
        onLeave: onLeaveToday,
        pendingApprovals,
        upcomingHolidays: upcomingHolidays.length,
        birthdays: birthdays.length,
        workAnniversaries: workAnniversaries.length,
      },
      charts: {
        attendanceTrend,
        leaveTrend,
        departmentWiseEmployees,
        monthlyLeaveSummary,
      },
      recentActivities,
      upcomingEvents,
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return apiError("Failed to fetch dashboard data", 500);
  }
}

function mapAuditToActivityType(
  entity: string
): "leave" | "attendance" | "announcement" | "birthday" | "anniversary" {
  const lower = entity.toLowerCase();
  if (lower.includes("leave")) return "leave";
  if (lower.includes("attendance")) return "attendance";
  if (lower.includes("announcement")) return "announcement";
  return "attendance";
}
