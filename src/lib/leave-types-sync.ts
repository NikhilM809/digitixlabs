import { prisma } from "@/lib/prisma";

/** Leave types removed from the application — kept in DB for historical records only */
export const DEPRECATED_LEAVE_TYPE_CODES = ["WFH", "HD"] as const;

const FLOATER_LEAVE = {
  name: "Floater Leave",
  code: "FL",
  description: "Optional floater leave for special occasions",
  defaultDays: 2,
  isPaid: true,
  requiresAttachment: false,
  isActive: true,
} as const;

/**
 * Ensures leave types match product rules even when migrations were not applied
 * (e.g. local DB created with db push).
 */
export async function syncLeaveTypes() {
  await prisma.leaveType.updateMany({
    where: { code: { in: [...DEPRECATED_LEAVE_TYPE_CODES] } },
    data: { isActive: false },
  });

  await prisma.leaveType.upsert({
    where: { code: FLOATER_LEAVE.code },
    update: {
      name: FLOATER_LEAVE.name,
      description: FLOATER_LEAVE.description,
      defaultDays: FLOATER_LEAVE.defaultDays,
      isPaid: FLOATER_LEAVE.isPaid,
      requiresAttachment: FLOATER_LEAVE.requiresAttachment,
      isActive: true,
    },
    create: { ...FLOATER_LEAVE },
  });
}

export function isDeprecatedLeaveTypeCode(code: string) {
  return DEPRECATED_LEAVE_TYPE_CODES.includes(
    code as (typeof DEPRECATED_LEAVE_TYPE_CODES)[number]
  );
}
