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

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const policies = await prisma.companyPolicy.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return apiSuccess(policies);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  if (!canManagePolicies(user!.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await req.json();
    const parsed = companyPolicySchema.parse(body);

    const count = await prisma.companyPolicy.count({ where: { isActive: true } });

    const policy = await prisma.companyPolicy.create({
      data: {
        title: parsed.title,
        content: parsed.content,
        sortOrder: parsed.sortOrder ?? count,
      },
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "CompanyPolicy",
      entityId: policy.id,
      details: `Created policy: ${policy.title}`,
    });

    return apiSuccess(policy, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid policy data", 422);
    }
    return apiError("Failed to create policy", 500);
  }
}
