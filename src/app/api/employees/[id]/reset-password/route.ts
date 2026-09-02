import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { adminResetPasswordSchema } from "@/lib/validations";
import { canResetEmployeePassword } from "@/lib/permissions";

const DEFAULT_TEMP_PASSWORD = "Digitix@123";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canResetEmployeePassword(user.role)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = adminResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    if (!target) {
      return apiError("Employee not found", 404);
    }

    if (target.status !== "ACTIVE") {
      return apiError("Cannot reset password for inactive employee", 400);
    }

    const plainPassword = parsed.data.newPassword ?? DEFAULT_TEMP_PASSWORD;
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: target.id,
      details: `Admin reset password for ${target.firstName} ${target.lastName}`,
    });

    return apiSuccess({
      message: "Password reset successfully",
      mustChangePassword: true,
      usedDefaultPassword: !parsed.data.newPassword,
    });
  } catch (err) {
    console.error("Admin password reset error:", err);
    return apiError("Failed to reset password", 500);
  }
}
