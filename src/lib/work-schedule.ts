import { prisma } from "@/lib/prisma";

export interface ResolvedWorkSchedule {
  workStartTime: string;
  workEndTime: string;
  lateThreshold: number;
  source: "history" | "user" | "company";
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getWorkScheduleForUserOnDate(
  userId: string,
  date: Date
): Promise<ResolvedWorkSchedule> {
  const day = startOfDay(date);

  const historyEntry = await prisma.workScheduleEntry.findFirst({
    where: {
      userId,
      effectiveFrom: { lte: day },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (historyEntry) {
    return {
      workStartTime: historyEntry.workStartTime,
      workEndTime: historyEntry.workEndTime,
      lateThreshold: historyEntry.lateThreshold ?? 15,
      source: "history",
    };
  }

  const [employee, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { workStartTime: true, workEndTime: true, lateThreshold: true },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (employee?.workStartTime || employee?.workEndTime) {
    return {
      workStartTime: employee.workStartTime ?? settings?.workStartTime ?? "09:00",
      workEndTime: employee.workEndTime ?? settings?.workEndTime ?? "18:00",
      lateThreshold: employee.lateThreshold ?? settings?.lateThreshold ?? 15,
      source: "user",
    };
  }

  return {
    workStartTime: settings?.workStartTime ?? "09:00",
    workEndTime: settings?.workEndTime ?? "18:00",
    lateThreshold: settings?.lateThreshold ?? 15,
    source: "company",
  };
}

export async function getWorkScheduleHistory(userId: string) {
  return prisma.workScheduleEntry.findMany({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
  });
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function createWorkScheduleEntry(input: {
  userId: string;
  effectiveFrom: Date;
  workStartTime: string;
  workEndTime: string;
  lateThreshold?: number;
  createdBy?: string;
}) {
  const effectiveFrom = startOfDay(input.effectiveFrom);

  const overlapping = await prisma.workScheduleEntry.findFirst({
    where: {
      userId: input.userId,
      effectiveFrom: { lte: effectiveFrom },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (overlapping && overlapping.effectiveFrom.getTime() === effectiveFrom.getTime()) {
    throw new Error("A schedule already exists for this effective date");
  }

  if (overlapping && (!overlapping.effectiveTo || overlapping.effectiveTo >= effectiveFrom)) {
    const closeDate = addDays(effectiveFrom, -1);
    if (closeDate >= overlapping.effectiveFrom) {
      await prisma.workScheduleEntry.update({
        where: { id: overlapping.id },
        data: { effectiveTo: closeDate },
      });
    }
  }

  const futureOverlap = await prisma.workScheduleEntry.findFirst({
    where: {
      userId: input.userId,
      effectiveFrom: { gt: effectiveFrom },
    },
    orderBy: { effectiveFrom: "asc" },
  });

  const effectiveTo = futureOverlap
    ? addDays(futureOverlap.effectiveFrom, -1)
    : null;

  const entry = await prisma.workScheduleEntry.create({
    data: {
      userId: input.userId,
      effectiveFrom,
      effectiveTo,
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime,
      lateThreshold: input.lateThreshold,
      createdBy: input.createdBy,
    },
  });

  if (!futureOverlap) {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        workStartTime: input.workStartTime,
        workEndTime: input.workEndTime,
        ...(input.lateThreshold !== undefined
          ? { lateThreshold: input.lateThreshold }
          : {}),
      },
    });
  }

  return entry;
}

export function formatScheduleTime12h(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatScheduleRange(
  from: Date,
  to: Date | null
) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (!to) return `${fmt(from)} onwards`;
  return `${fmt(from)} - ${fmt(to)}`;
}
