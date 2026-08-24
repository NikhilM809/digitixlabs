import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import {
  assertAdminAdministrativeAccess,
  getAdministrativePosition,
} from "@/lib/org-administrative-position";
import { assignAdministrativePosition } from "@/lib/org-hierarchy";

const assignSchema = z.object({
  userId: z.string().min(1),
  assign: z.boolean(),
});

export async function GET() {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  try {
    await assertAdminAdministrativeAccess(user.role);
  } catch {
    return apiError("Forbidden", 403);
  }

  const position = await getAdministrativePosition();
  if (!position) {
    return apiError("Administrative position not configured", 404);
  }

  return apiSuccess(position);
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  try {
    await assertAdminAdministrativeAccess(user.role);
  } catch {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = assignSchema.parse(body);
    const position = await getAdministrativePosition();
    if (!position) {
      return apiError("Administrative position not configured", 404);
    }

    const updated = await assignAdministrativePosition({
      userId: parsed.userId,
      positionId: parsed.assign ? position.id : null,
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "OrgAdministrativePosition",
      entityId: position.id,
      details: parsed.assign
        ? `Assigned ${updated.firstName} ${updated.lastName} to ${position.name}`
        : `Removed ${updated.firstName} ${updated.lastName} from ${position.name}`,
    });

    return apiSuccess(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update administrative assignment";
    return apiError(message, 400);
  }
}
