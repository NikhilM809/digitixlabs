import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
  createNotification,
} from "@/lib/api-utils";
import { kraUpdateSchema } from "@/lib/validations";
import { canAccessKra } from "@/lib/permissions";
import { weightedAverageRating } from "@/lib/kra";
import {
  getKraItemDelegate,
  getKraReviewDelegate,
  isKraSetupFailure,
  kraDbSetupError,
} from "@/lib/kra-db";

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

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const setupError = kraDbSetupError();
  if (setupError) return setupError;

  const { id } = await params;
  const review = await getKraReviewDelegate().findUnique({
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
      const existing = review.items.find((i) => i.id === item.id);
      if (!existing) {
        return apiError("KRA item not found", 400);
      }
      if (item.employeeRating === undefined || item.employeeRating === null) {
        return apiError(`Self rating is required for "${existing.name}"`, 400);
      }
    }

    for (const item of parsed.data.items) {
      const existing = review.items.find((i) => i.id === item.id);
      if (!existing) {
        return apiError("KRA item not found", 400);
      }
      await getKraItemDelegate().update({
        where: { id: existing.id },
        data: {
          achievement: item.achievement,
          employeeComments: item.employeeComments,
          employeeRating: item.employeeRating ?? null,
        },
      });
    }

    const updated = await getKraReviewDelegate().update({
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
        type: "GENERAL",
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
      avgEmployeeRating: weightedAverageRating(updated.items, "employeeRating"),
      avgManagerRating: weightedAverageRating(updated.items, "managerRating"),
    });
  } catch (err) {
    console.error("KRA submit error:", err);
    if (isKraSetupFailure(err)) {
      return kraDbSetupError() ?? apiError("Failed to submit KRA", 503);
    }
    return apiError("Failed to submit KRA", 500);
  }
}
