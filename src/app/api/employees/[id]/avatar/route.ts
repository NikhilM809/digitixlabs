import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { saveAvatarFile } from "@/lib/avatar-upload";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error || !user) return error;

  const { id } = await context.params;

  try {
    const employee = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("No image file provided", 400);
    }

    const avatarUrl = await saveAvatarFile(id, file);

    const updated = await prisma.user.update({
      where: { id },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        avatar: true,
        firstName: true,
        lastName: true,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      details: `Updated profile picture for ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload profile picture";
    return apiError(message, 400);
  }
}
