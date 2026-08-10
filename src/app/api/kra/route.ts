import { NextRequest } from "next/server";
import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { kraCreateSchema } from "@/lib/validations";
import { canAccessKra, isAdminOrHr } from "@/lib/permissions";
import { averageRating } from "@/lib/kra";
import {
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

function serializeReview(review: Awaited<ReturnType<typeof fetchReview>>) {
  if (!review) return null;
  return {
    ...review,
    avgEmployeeRating: averageRating(review.items, "employeeRating"),
    avgManagerRating: averageRating(review.items, "managerRating"),
  };
}

async function fetchReview(id: string) {
  return getKraReviewDelegate().findUnique({
    where: { id },
    include: reviewInclude,
  });
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const setupError = kraDbSetupError();
  if (setupError) return setupError;

  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const userId = searchParams.get("userId");
  const teamReview = searchParams.get("team") === "true";

  const where: Record<string, unknown> = {};

  if (teamReview && (user.role === RoleName.MANAGER || isAdminOrHr(user.role))) {
    if (user.role === RoleName.MANAGER) {
      const team = await prisma.user.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      where.userId = { in: team.map((t) => t.id) };
    }
    where.status = {
      in: ["EMPLOYEE_SUBMITTED", "UNDER_MANAGER_REVIEW", "MANAGER_REVIEWED", "COMPLETED"],
    };
  } else if (userId && (isAdminOrHr(user.role) || user.role === RoleName.MANAGER)) {
    where.userId = userId;
  } else {
    where.userId = user.id;
  }

  if (month) where.month = parseInt(month, 10);
  if (year) where.year = parseInt(year, 10);

  try {
    const reviews = await getKraReviewDelegate().findMany({
      where,
      include: reviewInclude,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return apiSuccess(
      reviews.map((r) => ({
        ...r,
        avgEmployeeRating: averageRating(r.items, "employeeRating"),
        avgManagerRating: averageRating(r.items, "managerRating"),
      }))
    );
  } catch (err) {
    console.error("KRA list error:", err);
    if (isKraSetupFailure(err)) {
      return kraDbSetupError() ?? apiSuccess([]);
    }
    return apiError("Failed to load KRA records", 500);
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const setupError = kraDbSetupError();
  if (setupError) return setupError;

  try {
    const body = await request.json();
    const parsed = kraCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const { month, year } = parsed.data;
    let targetUserId = parsed.data.userId ?? user.id;

    if (targetUserId !== user.id && !isAdminOrHr(user.role)) {
      return apiError("Forbidden", 403);
    }

    const employee = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, managerId: true },
    });
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    const existing = await getKraReviewDelegate().findUnique({
      where: {
        userId_month_year: { userId: targetUserId, month, year },
      },
    });
    if (existing) {
      const review = await fetchReview(existing.id);
      if (!review) {
        return apiError("KRA not found", 404);
      }
      return apiSuccess(serializeReview(review));
    }

    const review = await getKraReviewDelegate().create({
      data: {
        userId: targetUserId,
        managerId: employee.managerId,
        month,
        year,
        items: {
          create: [
            {
              goal: "Key Result Area 1",
              sortOrder: 0,
            },
          ],
        },
      },
      include: reviewInclude,
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "KraReview",
      entityId: review.id,
      details: `Created KRA for ${month}/${year}`,
    });

    return apiSuccess(serializeReview(review), 201);
  } catch (err) {
    console.error("KRA create error:", err);
    const message = err instanceof Error ? err.message : "Failed to create KRA";
    if (isKraSetupFailure(err)) {
      return kraDbSetupError() ?? apiError(message, 503);
    }
    return apiError(message, 500);
  }
}
