import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";

const attendanceActionSchema = z.object({
  action: z.enum(["check-in", "check-out"]),
  notes: z.string().optional(),
});

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function getAttendanceUserFilter(role: RoleName, userId: string, requestedUserId?: string | null) {
  if (role === RoleName.ADMIN) {
    return requestedUserId ? { userId: requestedUserId } : {};
  }
  if (role === RoleName.MANAGER) {
    if (requestedUserId) {
      const canAccess = await prisma.user.findFirst({
        where: {
          id: requestedUserId,
          OR: [{ managerId: userId }, { id: userId }],
        },
      });
      if (!canAccess) return null;
      return { userId: requestedUserId };
    }
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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;
    const userId = searchParams.get("userId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const userFilter = await getAttendanceUserFilter(user.role, user.id, userId);
    if (userFilter === null) {
      return apiError("Forbidden", 403);
    }

    const where: Record<string, unknown> = { ...userFilter };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
          return apiError("Invalid fromDate format. Use YYYY-MM-DD", 400);
        }
        (where.date as Record<string, Date>).gte = startOfDay(new Date(fromDate));
      }
      if (toDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
          return apiError("Invalid toDate format. Use YYYY-MM-DD", 400);
        }
        (where.date as Record<string, Date>).lte = startOfDay(new Date(toDate));
      }
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: "desc" }, { checkIn: "desc" }],
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return apiSuccess({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Attendance list error:", err);
    return apiError("Failed to fetch attendance records", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const body = await request.json();
    const parsed = attendanceActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { action, notes } = parsed.data;
    const today = startOfDay();
    const now = new Date();

    const onLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: user.id,
        status: "APPROVED",
        fromDate: { lte: now },
        toDate: { gte: today },
        isHalfDay: false,
      },
    });

    if (onLeave) {
      return apiError("You are on approved leave today", 400);
    }

    const settings = await prisma.companySettings.findFirst();
    const workStartTime = settings?.workStartTime ?? "09:00";
    const lateThreshold = settings?.lateThreshold ?? 15;

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: { userId: user.id, date: today },
      },
    });

    if (action === "check-in") {
      if (existing?.checkIn) {
        return apiError("Already checked in today", 400);
      }

      const workStart = parseTimeToDate(workStartTime, today);
      const lateCutoff = new Date(workStart.getTime() + lateThreshold * 60 * 1000);
      const isLate = now > lateCutoff;

      const attendance = await prisma.attendance.upsert({
        where: {
          userId_date: { userId: user.id, date: today },
        },
        create: {
          userId: user.id,
          date: today,
          checkIn: now,
          status: isLate ? "LATE" : "PRESENT",
          isLate,
          notes,
        },
        update: {
          checkIn: now,
          status: isLate ? "LATE" : "PRESENT",
          isLate,
          notes,
        },
        include: {
          user: {
            select: { firstName: true, lastName: true, employeeId: true },
          },
        },
      });

      await createAuditLog({
        userId: user.id,
        action: "CREATE",
        entity: "Attendance",
        entityId: attendance.id,
        details: `Checked in at ${now.toISOString()}${isLate ? " (Late)" : ""}`,
      });

      return apiSuccess(attendance, 201);
    }

    if (!existing?.checkIn) {
      return apiError("Must check in before checking out", 400);
    }

    if (existing.checkOut) {
      return apiError("Already checked out today", 400);
    }

    const workingHours =
      (now.getTime() - new Date(existing.checkIn).getTime()) / (1000 * 60 * 60);

    const workEndTime = settings?.workEndTime ?? "18:00";
    const workEnd = parseTimeToDate(workEndTime, today);
    const overtimeHours = Math.max(
      0,
      (now.getTime() - workEnd.getTime()) / (1000 * 60 * 60)
    );

    const attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        notes: notes || existing.notes,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "Attendance",
      entityId: attendance.id,
      details: `Checked out at ${now.toISOString()} (${workingHours.toFixed(2)} hours)`,
    });

    return apiSuccess(attendance);
  } catch (err) {
    console.error("Attendance action error:", err);
    return apiError("Failed to process attendance", 500);
  }
}
