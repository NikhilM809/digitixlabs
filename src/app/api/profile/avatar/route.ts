import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { canEmployeeEditOwnProfile } from "@/lib/profile-editing";
import { saveAvatarFile } from "@/lib/avatar-upload";

export async function POST(request: Request) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        role: true,
        profileCompletedAt: true,
        profileEditingEnabled: true,
      },
    });

    if (currentUser && !canEmployeeEditOwnProfile(currentUser)) {
      return apiError(
        "Your profile is read-only. Contact Admin to enable profile editing.",
        403
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("No image file provided", 400);
    }

    const avatarUrl = await saveAvatarFile(user.id, file);

    const profile = await prisma.user.update({
      where: { id: user.id },
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
      entityId: user.id,
      details: "Updated profile picture",
    });

    return apiSuccess(profile);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload profile picture";
    return apiError(message, 400);
  }
}
