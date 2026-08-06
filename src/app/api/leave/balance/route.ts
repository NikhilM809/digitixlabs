import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const year = new Date().getFullYear();

    const [balances, leaveTypes] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { userId: user.id, year },
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
    ]);

    const balanceMap = new Map(balances.map((b) => [b.leaveTypeId, b]));

    const result = leaveTypes.map((type) => {
      const balance = balanceMap.get(type.id);
      const totalDays = balance?.totalDays ?? type.defaultDays;
      const usedDays = balance?.usedDays ?? 0;
      const pendingDays = balance?.pendingDays ?? 0;
      const availableDays = totalDays - usedDays - pendingDays;

      return {
        leaveType: type,
        year,
        totalDays,
        usedDays,
        pendingDays,
        availableDays,
      };
    });

    return apiSuccess({ balances: result, year });
  } catch (err) {
    console.error("Leave balance error:", err);
    return apiError("Failed to fetch leave balances", 500);
  }
}
