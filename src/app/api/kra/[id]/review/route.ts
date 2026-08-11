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
import { kraReviewSubmitSchema } from "@/lib/validations";
import { canReviewKra, isAdminOrHr } from "@/lib/permissions";
import { serializeKraReviewScores, isKraLockedForManager } from "@/lib/kra";
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

async function canReview(
  reviewUserId: string,
  managerId: string | null,
  role: RoleName,
  userId: string
) {
  if (!canReviewKra(role)) return false;
  if (isAdminOrHr(role)) return true;
  if (managerId === userId) return true;
  if (role === RoleName.MANAGER) {
    const member = await prisma.user.findFirst({
      where: { id: reviewUserId, managerId: userId },
    });
    return !!member;
  }
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

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

  const allowed = await canReview(
    review.userId,
    review.managerId,
    user.role,
    user.id
  );
  if (!allowed) {
    return apiError("Forbidden", 403);
  }

  if (isKraLockedForManager(review)) {
    return apiError("This KRA review is already completed", 400);
  }

  if (!["EMPLOYEE_SUBMITTED", "UNDER_MANAGER_REVIEW", "MANAGER_REVIEWED"].includes(review.status)) {
    return apiError("Employee must submit evaluation before manager review", 400);
  }

  try {
    const body = await request.json();
    const parsed = kraReviewSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    for (const item of parsed.data.items) {
      const existing = review.items.find((i) => i.id === item.id);
      if (!existing) {
        return apiError("KRA item not found", 400);
      }
      if (
        existing.weight > 0 &&
        (item.managerPercentage === undefined || item.managerPercentage === null)
      ) {
        return apiError(`Manager rating is required for "${existing.name}"`, 400);
      }
      await getKraItemDelegate().update({
        where: { id: existing.id },
        data: {
          managerPercentage: item.managerPercentage ?? null,
          managerComments: item.managerComments,
        },
      });
    }

    const updated = await getKraReviewDelegate().update({
      where: { id },
      data: {
        status: "COMPLETED",
        managerReviewedAt: new Date(),
      },
      include: reviewInclude,
    });

    await createNotification({
      userId: review.userId,
      type: "GENERAL",
      title: "KRA Review Completed",
      message: `Your manager completed the KRA review for ${updated.month}/${updated.year}`,
      link: `/kra?tab=evaluation&id=${id}`,
    });

    await createAuditLog({
      userId: user.id,
      action: "APPROVE",
      entity: "KraReview",
      entityId: id,
      details: "Manager completed KRA review",
    });

    return apiSuccess({
      ...updated,
      ...serializeKraReviewScores(updated.items),
    });
  } catch (err) {
    console.error("KRA review error:", err);
    if (isKraSetupFailure(err)) {
      return kraDbSetupError() ?? apiError("Failed to complete KRA review", 503);
    }
    return apiError("Failed to complete KRA review", 500);
  }
}
