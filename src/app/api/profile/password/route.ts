import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  createAuditLog,
  apiSuccess,
  apiError,
} from "@/lib/api-utils";
import { changePasswordSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { id: true, password: true },
    });

    if (!dbUser) {
      return apiError("User not found", 404);
    }

    const isValid = await bcrypt.compare(
      parsed.data.currentPassword,
      dbUser.password
    );

    if (!isValid) {
      return apiError("Current password is incorrect", 401);
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.user.update({
      where: { id: user!.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "User",
      entityId: user!.id,
      details: JSON.stringify({ action: "password_changed" }),
    });

    return apiSuccess({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return apiError("Internal server error", 500);
  }
}
