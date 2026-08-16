import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import {
  syncLeaveTypes,
  DEPRECATED_LEAVE_TYPE_CODES,
} from "@/lib/leave-types-sync";

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    await syncLeaveTypes();

    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        isActive: true,
        code: { notIn: [...DEPRECATED_LEAVE_TYPE_CODES] },
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess(leaveTypes);
  } catch (err) {
    console.error("Leave types GET error:", err);
    return apiError("Internal server error", 500);
  }
}
