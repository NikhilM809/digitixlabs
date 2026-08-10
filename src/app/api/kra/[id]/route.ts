import { NextRequest } from "next/server";
import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { kraUpdateSchema } from "@/lib/validations";
import {
  canEmployeeEditKra,
  averageRating,
} from "@/lib/kra";
import { isAdminOrHr } from "@/lib/permissions";
import { getKraItemDelegate, getKraReviewDelegate, kraDbSetupError } from "@/lib/kra-db";

const reviewInclude = {
  user: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      managerId: true,
      department: { select: { name: true } },
    },
  },
  manager: {
    select: { id: true, firstName: true, lastName: true },
  },
  items: { orderBy: { sortOrder: "asc" as const } },
};

async function canAccessReview(
  reviewUserId: string,
  managerId: string | null,
  role: RoleName,
  userId: string
) {
  if (reviewUserId === userId) return true;
  if (isAdminOrHr(role)) return true;
  if (role === RoleName.MANAGER && managerId === userId) return true;
  if (role === RoleName.MANAGER) {
    const member = await prisma.user.findFirst({
      where: { id: reviewUserId, managerId: userId },
    });
    return !!member;
  }
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const setupError = kraDbSetupError();
  if (setupError) return setupError;

  const { id } = await params;
  const review = await getKraReviewDelegate().findUnique({
    where: { id },
    include: reviewInclude,
  });

  if (!review) {
    return apiError("KRA not found", 404);
  }

  const allowed = await canAccessReview(
    review.userId,
    review.managerId,
    user.role,
    user.id
  );
  if (!allowed) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess({
    ...review,
    avgEmployeeRating: averageRating(review.items, "employeeRating"),
    avgManagerRating: averageRating(review.items, "managerRating"),
  });
}

export async function PATCH(
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
    include: { items: true },
  });

  if (!review) {
    return apiError("KRA not found", 404);
  }

  if (review.userId !== user.id) {
    return apiError("Only the employee can update KRA items", 403);
  }

  if (!canEmployeeEditKra(review)) {
    return apiError("KRA is locked after submission. Contact HR to reopen.", 400);
  }

  try {
    const body = await request.json();
    const parsed = kraUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    await getKraItemDelegate().deleteMany({ where: { kraReviewId: id } });

    await getKraItemDelegate().createMany({
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

    const updated = await getKraReviewDelegate().findUnique({
      where: { id },
      include: reviewInclude,
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "KraReview",
      entityId: id,
      details: "Updated KRA draft",
    });

    return apiSuccess({
      ...updated,
      avgEmployeeRating: averageRating(updated!.items, "employeeRating"),
      avgManagerRating: averageRating(updated!.items, "managerRating"),
    });
  } catch (err) {
    console.error("KRA update error:", err);
    return apiError("Failed to update KRA", 500);
  }
}
