import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageWorkSchedules, isManagerRole } from "@/lib/permissions";

/** Admin can manage any employee schedule; managers only their direct reports. */
export async function canManageEmployeeWorkSchedule(
  actorRole: RoleName,
  actorId: string,
  targetUserId: string
): Promise<boolean> {
  if (canManageWorkSchedules(actorRole)) {
    return true;
  }

  if (!isManagerRole(actorRole)) {
    return false;
  }

  const report = await prisma.user.findFirst({
    where: { id: targetUserId, managerId: actorId, status: "ACTIVE" },
    select: { id: true },
  });

  return !!report;
}
