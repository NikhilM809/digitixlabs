import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import {
  leaveApplicationSchema,
  adminLeaveApplicationSchema,
} from "@/lib/validations";
import { calculateLeaveDays } from "@/lib/utils";
import {
  canApplyLeaveOnBehalf,
  canManageAllLeaves,
} from "@/lib/permissions";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getLeaveUserFilter(role: RoleName, userId: string) {
  if (role === RoleName.ADMIN || role === RoleName.HR) return {};
  if (role === RoleName.MANAGER) {
    const teamIds = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    return { userId: { in: [userId, ...teamIds.map((t) => t.id)] } };
  }
  return { userId };
}

export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = await getLeaveUserFilter(user.role, user.id);

    if (status) {
      const validStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        return apiError("Invalid status filter", 400);
      }
      where.status = status;
    }

    if (canManageAllLeaves(user.role) && searchParams.get("userId")) {
      where.userId = searchParams.get("userId");
    }

    const [leaves, total] = await Promise.all([
      prisma.leaveRequest.findMany({
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
          leaveType: { select: { id: true, name: true, code: true } },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return apiSuccess({
      leaves,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Leave list error:", err);
    return apiError("Failed to fetch leave requests", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const body = await request.json();
    const onBehalf = canApplyLeaveOnBehalf(user.role) && body.userId;

    const parsed = onBehalf
      ? adminLeaveApplicationSchema.safeParse(body)
      : leaveApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const data = parsed.data;
    const targetUserId: string =
      onBehalf && "userId" in data && typeof data.userId === "string"
        ? data.userId
        : user.id;

    if (onBehalf) {
      const employee = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, status: true },
      });
      if (!employee || employee.status !== "ACTIVE") {
        return apiError("Invalid employee", 400);
      }
    }

    const fromDate = startOfDay(new Date(data.fromDate));
    const toDate = startOfDay(new Date(data.toDate));

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: data.leaveTypeId },
    });

    if (!leaveType || !leaveType.isActive) {
      return apiError("Invalid leave type", 400);
    }

    if (leaveType.requiresAttachment && !data.attachment) {
      return apiError("Attachment is required for this leave type", 400);
    }

    const totalDays = calculateLeaveDays(fromDate, toDate);

    if (totalDays <= 0) {
      return apiError("No working days in the selected date range", 400);
    }

    const year = fromDate.getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: targetUserId,
          leaveTypeId: data.leaveTypeId,
          year,
        },
      },
    });

    const availableDays = balance
      ? balance.totalDays - balance.usedDays - balance.pendingDays
      : leaveType.defaultDays;

    if (totalDays > availableDays) {
      return apiError(
        `Insufficient leave balance. Available: ${availableDays} days`,
        400
      );
    }

    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId: targetUserId,
        status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: toDate },
        toDate: { gte: fromDate },
      },
    });

    if (overlapping) {
      return apiError("Leave request overlaps with an existing request", 400);
    }

    const leaveRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          userId: targetUserId,
          leaveTypeId: data.leaveTypeId,
          fromDate,
          toDate,
          isHalfDay: false,
          halfDayPeriod: null,
          totalDays,
          reason: data.reason,
          attachment: data.attachment,
          emergencyContact: data.emergencyContact,
        },
        include: {
          leaveType: { select: { name: true } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              managerId: true,
            },
          },
        },
      });

      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pendingDays: { increment: totalDays } },
        });
      } else {
        await tx.leaveBalance.create({
          data: {
            userId: targetUserId,
            leaveTypeId: data.leaveTypeId,
            year,
            totalDays: leaveType.defaultDays,
            pendingDays: totalDays,
          },
        });
      }

      return created;
    });

    const employee = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { managerId: true, firstName: true, lastName: true },
    });

    if (employee?.managerId) {
      await createNotification({
        userId: employee.managerId,
        type: "LEAVE_PENDING",
        title: "New Leave Request",
        message: onBehalf
          ? `Leave applied on behalf of ${employee.firstName} ${employee.lastName} for ${leaveRequest.leaveType.name}`
          : `${leaveRequest.user.firstName} ${leaveRequest.user.lastName} applied for ${leaveRequest.leaveType.name}`,
        link: "/leave",
      });
    }

    if (!onBehalf && !canManageAllLeaves(user.role)) {
      const admins = await prisma.user.findMany({
        where: { role: { in: [RoleName.ADMIN, RoleName.HR] }, status: "ACTIVE" },
        select: { id: true },
      });

      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin.id,
            type: "LEAVE_PENDING",
            title: "New Leave Request",
            message: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName} applied for ${leaveRequest.leaveType.name}`,
            link: "/leave",
          })
        )
      );
    }

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "LeaveRequest",
      entityId: leaveRequest.id,
      details: onBehalf
        ? `Applied on behalf of employee for ${totalDays} day(s) of ${leaveRequest.leaveType.name}`
        : `Applied for ${totalDays} day(s) of ${leaveRequest.leaveType.name}`,
    });

    return apiSuccess(leaveRequest, 201);
  } catch (err) {
    console.error("Leave apply error:", err);
    return apiError("Failed to apply for leave", 500);
  }
}
