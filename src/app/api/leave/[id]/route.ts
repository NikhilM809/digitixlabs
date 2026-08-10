import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import { canApproveLeave, canManageAllLeaves } from "@/lib/permissions";
import { syncLeaveBalanceFromRequests } from "@/lib/leave-balance";

const leaveActionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  managerComment: z.string().optional(),
});

async function canAccessLeave(
  leaveUserId: string,
  role: RoleName,
  userId: string
): Promise<boolean> {
  if (role === RoleName.ADMIN || role === RoleName.HR) return true;
  if (leaveUserId === userId) return true;
  if (role === RoleName.MANAGER) {
    const teamMember = await prisma.user.findFirst({
      where: { id: leaveUserId, managerId: userId },
    });
    return !!teamMember;
  }
  return false;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const { id } = await params;
    const body = await request.json();
    const parsed = leaveActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { action, managerComment } = parsed.data;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, managerId: true } },
        leaveType: { select: { name: true } },
      },
    });

    if (!leave) {
      return apiError("Leave request not found", 404);
    }

    if (action === "cancel") {
      if (leave.userId !== user.id && !canManageAllLeaves(user.role)) {
        return apiError("Forbidden", 403);
      }
      if (!["PENDING", "APPROVED"].includes(leave.status)) {
        return apiError("Cannot cancel this leave request", 400);
      }
    } else {
      if (!canApproveLeave(user.role)) {
        return apiError("Forbidden", 403);
      }
      const canManage = await canAccessLeave(leave.userId, user.role, user.id);
      if (!canManage || leave.userId === user.id) {
        if (!canManageAllLeaves(user.role)) {
          return apiError("Forbidden", 403);
        }
      }
      if (leave.status !== "PENDING") {
        return apiError("Leave request is not pending", 400);
      }
    }

    const year = new Date(leave.fromDate).getFullYear();

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        const approved = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedById: user.id,
            approvedAt: new Date(),
            managerComment,
          },
          include: {
            leaveType: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        });

        return approved;
      }

      if (action === "reject") {
        const rejected = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: "REJECTED",
            approvedById: user.id,
            approvedAt: new Date(),
            managerComment,
          },
          include: {
            leaveType: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        });

        return rejected;
      }

      const cancelled = await tx.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: {
          leaveType: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });

      return cancelled;
    });

    await syncLeaveBalanceFromRequests(leave.userId, leave.leaveTypeId, year);

    const notificationType =
      action === "approve"
        ? "LEAVE_APPROVED"
        : action === "reject"
          ? "LEAVE_REJECTED"
          : "LEAVE_CANCELLED";

    const notificationTitle =
      action === "approve"
        ? "Leave Approved"
        : action === "reject"
          ? "Leave Rejected"
          : "Leave Cancelled";

    await createNotification({
      userId: leave.userId,
      type: notificationType,
      title: notificationTitle,
      message: `Your ${leave.leaveType.name} request has been ${
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled"
      }`,
      link: "/leave",
    });

    await createAuditLog({
      userId: user.id,
      action: action === "approve" ? "APPROVE" : action === "reject" ? "REJECT" : "UPDATE",
      entity: "LeaveRequest",
      entityId: leave.id,
      details: `${action.charAt(0).toUpperCase() + action.slice(1)} leave request for ${leave.user.firstName} ${leave.user.lastName}`,
    });

    return apiSuccess(updated);
  } catch (err) {
    console.error("Leave update error:", err);
    return apiError("Failed to update leave request", 500);
  }
}
