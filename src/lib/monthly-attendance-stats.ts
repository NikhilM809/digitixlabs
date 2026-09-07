import { prisma } from "@/lib/prisma";
import { formatLocalDate, parseLocalDate } from "@/lib/utils";

/** Show monthly working hours on payslips from September 2026 onwards */
export const MONTHLY_HOURS_PAYSLIP_FROM = { year: 2026, month: 9 };

export function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function shouldShowMonthlyWorkingHours(month: number, year: number) {
  if (year > MONTHLY_HOURS_PAYSLIP_FROM.year) return true;
  if (year === MONTHLY_HOURS_PAYSLIP_FROM.year) {
    return month >= MONTHLY_HOURS_PAYSLIP_FROM.month;
  }
  return false;
}

function enumerateWeekdays(fromDate: Date, toDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export type MonthlyPayslipAttendance = {
  daysPresent: number;
  totalDaysInMonth: number;
  monthlyWorkingHours: number;
  showMonthlyWorkingHours: boolean;
};

/**
 * Days present = calendar days in month minus unpaid / out-of-balance leave days.
 * Paid leave within balance does not reduce days present.
 */
export async function computeMonthlyPayslipAttendance(
  userId: string,
  month: number,
  year: number
): Promise<MonthlyPayslipAttendance> {
  const totalDaysInMonth = daysInMonth(month, year);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const monthStartUtc = new Date(Date.UTC(year, month - 1, 1));
  const monthEndUtc = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const [attendanceRecords, balances, leaveTypes] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: monthStartUtc, lte: monthEndUtc },
      },
      select: { workingHours: true },
    }),
    prisma.leaveBalance.findMany({
      where: { userId, year },
      select: { leaveTypeId: true, totalDays: true },
    }),
    prisma.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, defaultDays: true, isPaid: true },
    }),
  ]);

  const monthlyWorkingHours = attendanceRecords.reduce(
    (sum, record) => sum + (record.workingHours ?? 0),
    0
  );

  const leaveTypeMap = new Map(leaveTypes.map((type) => [type.id, type]));
  const balanceRemaining = new Map<string, number>();

  for (const type of leaveTypes) {
    const balance = balances.find((item) => item.leaveTypeId === type.id);
    balanceRemaining.set(type.id, balance?.totalDays ?? type.defaultDays);
  }

  const lwpDates = new Set<string>();

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const leavesForYear = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      fromDate: { lte: yearEnd },
      toDate: { gte: yearStart },
    },
    select: {
      leaveTypeId: true,
      fromDate: true,
      toDate: true,
    },
    orderBy: [{ fromDate: "asc" }, { createdAt: "asc" }],
  });

  for (const leave of leavesForYear) {
    const leaveType = leaveTypeMap.get(leave.leaveTypeId);
    if (!leaveType) continue;

    const weekdays = enumerateWeekdays(leave.fromDate, leave.toDate);

    if (!leaveType.isPaid) {
      for (const day of weekdays) {
        lwpDates.add(formatLocalDate(day));
      }
      continue;
    }

    let remaining = balanceRemaining.get(leave.leaveTypeId) ?? 0;
    for (const day of weekdays) {
      if (remaining > 0) {
        remaining -= 1;
      } else {
        lwpDates.add(formatLocalDate(day));
      }
    }
    balanceRemaining.set(leave.leaveTypeId, remaining);
  }

  let lwpDaysInMonth = 0;
  for (const dateStr of lwpDates) {
    const day = parseLocalDate(dateStr);
    if (day >= monthStart && day <= monthEnd) {
      lwpDaysInMonth += 1;
    }
  }

  const daysPresent = Math.max(0, totalDaysInMonth - lwpDaysInMonth);

  return {
    daysPresent,
    totalDaysInMonth,
    monthlyWorkingHours: Math.round(monthlyWorkingHours * 100) / 100,
    showMonthlyWorkingHours: shouldShowMonthlyWorkingHours(month, year),
  };
}
