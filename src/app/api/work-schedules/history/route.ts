import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, createAuditLog } from "@/lib/api-utils";
import { canManageWorkSchedules } from "@/lib/permissions";
import { workScheduleEntrySchema } from "@/lib/validations";
import { createWorkScheduleEntry, getWorkScheduleHistory } from "@/lib/work-schedule";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canManageWorkSchedules(user.role)) {
    return apiError("Forbidden", 403);
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return apiError("userId is required", 400);
  }

  const history = await getWorkScheduleHistory(userId);
  return apiSuccess(history);
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canManageWorkSchedules(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = workScheduleEntrySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { userId, effectiveFrom, workStartTime, workEndTime, lateThreshold } = parsed.data;

    const startMinutes =
      parseInt(workStartTime.split(":")[0], 10) * 60 +
      parseInt(workStartTime.split(":")[1], 10);
    const endMinutes =
      parseInt(workEndTime.split(":")[0], 10) * 60 +
      parseInt(workEndTime.split(":")[1], 10);
    if (endMinutes <= startMinutes) {
      return apiError("Work end time must be after start time", 400);
    }

    const entry = await createWorkScheduleEntry({
      userId,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
      workStartTime,
      workEndTime,
      lateThreshold,
      createdBy: user.id,
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "WorkScheduleEntry",
      entityId: entry.id,
      details: `Added work schedule for user ${userId} effective ${effectiveFrom}`,
    });

    return apiSuccess(entry, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save schedule";
    return apiError(message, 400);
  }
}
