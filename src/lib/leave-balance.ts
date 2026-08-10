import { prisma } from "@/lib/prisma";

export async function computeLeaveBalancesForUser(userId: string, year: number) {
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

  const [balances, leaveTypes, leaveRequests] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId, year },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
            defaultDays: true,
          },
        },
      },
    }),
    prisma.leaveType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        isPaid: true,
        defaultDays: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: yearEnd },
        toDate: { gte: yearStart },
      },
      select: {
        leaveTypeId: true,
        totalDays: true,
        status: true,
        fromDate: true,
      },
    }),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.leaveTypeId, b]));

  const usedByType = new Map<string, number>();
  const pendingByType = new Map<string, number>();

  for (const request of leaveRequests) {
    if (new Date(request.fromDate).getFullYear() !== year) continue;
    const map = request.status === "PENDING" ? pendingByType : usedByType;
    map.set(request.leaveTypeId, (map.get(request.leaveTypeId) ?? 0) + request.totalDays);
  }

  return leaveTypes.map((type) => {
    const balance = balanceMap.get(type.id);
    const totalDays = balance?.totalDays ?? type.defaultDays;
    const computedUsed = usedByType.get(type.id) ?? 0;
    const usedDays = balance?.usedDaysManual ? balance.usedDays : computedUsed;
    const pendingDays = pendingByType.get(type.id) ?? 0;
    const availableDays = totalDays - usedDays - pendingDays;

    return {
      leaveType: type,
      balanceId: balance?.id ?? null,
      year,
      totalDays,
      usedDays,
      computedUsed,
      pendingDays,
      availableDays,
      usedDaysManual: balance?.usedDaysManual ?? false,
    };
  });
}

/** Sync DB leave balance from approved/pending requests after approval workflow */
export async function syncLeaveBalanceFromRequests(
  userId: string,
  leaveTypeId: string,
  year: number
) {
  const computed = await computeLeaveBalancesForUser(userId, year);
  const item = computed.find((b) => b.leaveType.id === leaveTypeId);
  if (!item) return;

  await prisma.leaveBalance.upsert({
    where: {
      userId_leaveTypeId_year: { userId, leaveTypeId, year },
    },
    create: {
      userId,
      leaveTypeId,
      year,
      totalDays: item.totalDays,
      usedDays: item.computedUsed,
      pendingDays: item.pendingDays,
      usedDaysManual: false,
    },
    update: {
      usedDays: item.computedUsed,
      pendingDays: item.pendingDays,
      usedDaysManual: false,
    },
  });
}
