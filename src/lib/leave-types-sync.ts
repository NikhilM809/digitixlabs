import { prisma } from "@/lib/prisma";
import {
  DEPRECATED_LEAVE_TYPE_CODES,
  PARENTAL_LEAVE_CODE,
} from "@/lib/leave-type-codes";

export { DEPRECATED_LEAVE_TYPE_CODES, isDeprecatedLeaveTypeCode } from "@/lib/leave-type-codes";

const FLOATER_LEAVE = {
  name: "Floater Leave",
  code: "FL",
  description: "Optional floater leave for special occasions",
  defaultDays: 2,
  isPaid: true,
  requiresAttachment: false,
  isActive: true,
} as const;

const PARENTAL_LEAVE = {
  name: "Maternity/Parental Leave",
  code: PARENTAL_LEAVE_CODE,
  description:
    "Parental leave (maternity/paternity). Days are assigned per employee as required.",
  defaultDays: 0,
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

  await prisma.leaveType.upsert({
    where: { code: PARENTAL_LEAVE.code },
    update: {
      name: PARENTAL_LEAVE.name,
      description: PARENTAL_LEAVE.description,
      defaultDays: PARENTAL_LEAVE.defaultDays,
      isPaid: PARENTAL_LEAVE.isPaid,
      requiresAttachment: PARENTAL_LEAVE.requiresAttachment,
      isActive: true,
    },
    create: { ...PARENTAL_LEAVE },
  });
}
