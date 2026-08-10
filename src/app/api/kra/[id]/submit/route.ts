import { NextRequest } from "next/server";
import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import { kraUpdateSchema } from "@/lib/validations";
import { averageRating } from "@/lib/kra";

const reviewInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      managerId: true,
    },
  },
  manager: {
    select: { id: true, firstName: true, lastName: true },
  },
  items: { orderBy: { sortOrder: "asc" as const } },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const { id } = await params;
  const review = await prisma.kraReview.findUnique({
    where: { id },
    include: { items: true, user: { select: { managerId: true, firstName: true, lastName: true } } },
  });

  if (!review) {
    return apiError("KRA not found", 404);
  }

  if (review.userId !== user.id) {
    return apiError("Forbidden", 403);
  }

  if (review.status !== "DRAFT") {
    return apiError("KRA has already been submitted", 400);
  }

  try {
    const body = await request.json();
    const parsed = kraUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    for (const item of parsed.data.items) {
      if (item.employeeRating === undefined || item.employeeRating === null) {
        return apiError(`Self rating is required for "${item.goal}"`, 400);
      }
    }

    await prisma.kraItem.deleteMany({ where: { kraReviewId: id } });
    await prisma.kraItem.createMany({
      data: parsed.data.items.map((item, index) => ({
        kraReviewId: id,
        goal: item.goal,
        description: item.description,
        target: item.target,
        achievement: item.achievement,
        employeeComments: item.employeeComments,
        employeeRating: item.employeeRating ?? null,
        sortOrder: item.sortOrder ?? index,
      })),
    });

    const updated = await prisma.kraReview.update({
      where: { id },
      data: {
        status: "UNDER_MANAGER_REVIEW",
        employeeSubmittedAt: new Date(),
      },
      include: reviewInclude,
    });

    if (updated.managerId) {
      await createNotification({
        userId: updated.managerId,
        type: "KRA_SUBMITTED",
        title: "KRA Submitted for Review",
        message: `${review.user.firstName} ${review.user.lastName} submitted KRA for ${updated.month}/${updated.year}`,
        link: `/kra?id=${id}`,
      });
    }

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "KraReview",
      entityId: id,
      details: "Employee submitted KRA",
    });

    return apiSuccess({
      ...updated,
      avgEmployeeRating: averageRating(updated.items, "employeeRating"),
      avgManagerRating: averageRating(updated.items, "managerRating"),
    });
  } catch (err) {
    console.error("KRA submit error:", err);
    return apiError("Failed to submit KRA", 500);
  }
}
