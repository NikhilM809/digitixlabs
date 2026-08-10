import { NextRequest } from "next/server";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { canReopenKra } from "@/lib/permissions";
import { averageRating } from "@/lib/kra";
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canReopenKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const setupError = kraDbSetupError();
  if (setupError) return setupError;

  const { id } = await params;

  try {
    const review = await getKraReviewDelegate().findUnique({ where: { id } });
    if (!review) {
      return apiError("KRA not found", 404);
    }

    await getKraReviewDelegate().update({
      where: { id },
      data: {
        status: "DRAFT",
        employeeSubmittedAt: null,
        managerReviewedAt: null,
      },
    });

    await getKraItemDelegate().updateMany({
      where: { kraReviewId: id },
      data: { managerRating: null, managerComments: null },
    });

    const refreshed = await getKraReviewDelegate().findUnique({
      where: { id },
      include: reviewInclude,
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "KraReview",
      entityId: id,
      details: "Reopened KRA to draft",
    });

    return apiSuccess({
      ...refreshed,
      avgEmployeeRating: averageRating(refreshed!.items, "employeeRating"),
      avgManagerRating: averageRating(refreshed!.items, "managerRating"),
    });
  } catch (err) {
    console.error("KRA reopen error:", err);
    if (isKraSetupFailure(err)) {
      return kraDbSetupError() ?? apiError("Failed to reopen KRA", 503);
    }
    return apiError("Failed to reopen KRA", 500);
  }
}
