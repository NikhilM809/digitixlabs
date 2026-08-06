import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return apiSuccess(leaveTypes);
  } catch (err) {
    console.error("Leave types GET error:", err);
    return apiError("Internal server error", 500);
  }
}
