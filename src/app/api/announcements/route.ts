import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, createAuditLog, createNotification } from "@/lib/api-utils";
import { announcementSchema } from "@/lib/validations";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const announcements = await prisma.announcement.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return apiSuccess(announcements);
}

export async function POST(request: Request) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = announcementSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message);
    }

    const announcement = await prisma.announcement.create({
      data: {
        ...parsed.data,
        createdBy: user!.id,
      },
    });

    const allUsers = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    await Promise.all(
      allUsers.map((u) =>
        createNotification({
          userId: u.id,
          type: "COMPANY_ANNOUNCEMENT",
          title: parsed.data.title,
          message: parsed.data.content.substring(0, 200),
          link: "/dashboard",
        })
      )
    );

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "Announcement",
      entityId: announcement.id,
    });

    return apiSuccess(announcement, 201);
  } catch (err) {
    console.error("Create announcement error:", err);
    return apiError("Failed to create announcement", 500);
  }
}
