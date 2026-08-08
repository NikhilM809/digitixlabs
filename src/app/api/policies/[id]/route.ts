import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { companyPolicySchema } from "@/lib/validations";
import { canManagePolicies } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error) return error;

  if (!canManagePolicies(user!.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = companyPolicySchema.partial().parse(body);

    const policy = await prisma.companyPolicy.update({
      where: { id },
      data: parsed,
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "CompanyPolicy",
      entityId: policy.id,
    });

    return apiSuccess(policy);
  } catch {
    return apiError("Failed to update policy", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth();
  if (error) return error;

  if (!canManagePolicies(user!.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const { id } = await params;

    await prisma.companyPolicy.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "CompanyPolicy",
      entityId: id,
    });

    return apiSuccess({ message: "Policy removed" });
  } catch {
    return apiError("Failed to delete policy", 500);
  }
}
