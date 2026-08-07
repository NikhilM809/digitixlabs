import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";

const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const where: Record<string, unknown> = { userId: user.id };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    return apiSuccess({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Notifications list error:", err);
    return apiError("Failed to fetch notifications", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) return error;

    const body = await request.json();
    const parsed = markReadSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { ids, markAll } = parsed.data;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });

      return apiSuccess({ message: "All notifications marked as read" });
    }

    if (!ids || ids.length === 0) {
      return apiError("Notification IDs are required", 400);
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      data: { isRead: true },
    });

    return apiSuccess({
      message: `${result.count} notification(s) marked as read`,
      count: result.count,
    });
  } catch (err) {
    console.error("Notifications update error:", err);
    return apiError("Failed to update notifications", 500);
  }
}
