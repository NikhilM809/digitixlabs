import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, createAuditLog } from "@/lib/api-utils";
import { leaveBalanceUpdateSchema } from "@/lib/validations";
import { canEditLeaveBalance } from "@/lib/permissions";
import { computeLeaveBalancesForUser } from "@/lib/leave-balance";

export async function GET(request: NextRequest) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const { searchParams } = request.nextUrl;
    const requestedUserId = searchParams.get("userId");
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

    let targetUserId = user.id;

    if (requestedUserId && requestedUserId !== user.id) {
      if (!canEditLeaveBalance(user.role)) {
        return apiError("Forbidden", 403);
      }
      targetUserId = requestedUserId;
    }

    const balances = await computeLeaveBalancesForUser(targetUserId, year);

    return apiSuccess({ balances, year, userId: targetUserId });
  } catch (err) {
    console.error("Leave balance error:", err);
    return apiError("Failed to fetch leave balances", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    if (!canEditLeaveBalance(user.role)) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = leaveBalanceUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { userId, leaveTypeId, year, totalDays } = parsed.data;

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });

    if (!leaveType || !leaveType.isActive) {
      return apiError("Invalid leave type", 400);
    }

    const computed = await computeLeaveBalancesForUser(userId, year);
    const current = computed.find((b) => b.leaveType.id === leaveTypeId);
    const usedDays = current?.usedDays ?? 0;
    const pendingDays = current?.pendingDays ?? 0;

    if (totalDays < usedDays + pendingDays) {
      return apiError(
        `Total days cannot be less than used (${usedDays}) + pending (${pendingDays})`,
        400
      );
    }

    const balance = await prisma.leaveBalance.upsert({
      where: {
        userId_leaveTypeId_year: { userId, leaveTypeId, year },
      },
      create: {
        userId,
        leaveTypeId,
        year,
        totalDays,
        usedDays,
        pendingDays,
      },
      update: {
        totalDays,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "LeaveBalance",
      entityId: balance.id,
      details: `Updated ${leaveType.name} total to ${totalDays} days for employee ${userId}`,
    });

    const updatedBalances = await computeLeaveBalancesForUser(userId, year);

    return apiSuccess({ balance, balances: updatedBalances });
  } catch (err) {
    console.error("Leave balance update error:", err);
    return apiError("Failed to update leave balance", 500);
  }
}
