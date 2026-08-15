import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeDependentSchema } from "@/lib/validations";
import { getDependentDetailsEnabled } from "@/lib/dependent-details-settings";

export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const enabled = await getDependentDetailsEnabled();
  if (!enabled) {
    return apiSuccess([]);
  }

  const dependents = await prisma.employeeDependent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(dependents);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const enabled = await getDependentDetailsEnabled();
  if (!enabled) {
    return apiError("Dependent details are not enabled", 403);
  }

  try {
    const body = await req.json();
    const parsed = employeeDependentSchema.parse(body);

    const dependent = await prisma.employeeDependent.create({
      data: {
        userId: user.id,
        name: parsed.name,
        relationship: parsed.relationship,
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
        gender: parsed.gender || null,
        metadata: parsed.metadata ?? undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "EmployeeDependent",
      entityId: dependent.id,
      details: `Added dependent ${dependent.name}`,
    });

    return apiSuccess(dependent, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid dependent data", 422);
    }
    console.error(err);
    return apiError("Failed to add dependent", 500);
  }
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const enabled = await getDependentDetailsEnabled();
  if (!enabled) {
    return apiError("Dependent details are not enabled", 403);
  }

  try {
    const body = await req.json();
    const { id, ...rest } = body as { id?: string } & Record<string, unknown>;

    if (!id) {
      return apiError("Dependent id is required", 400);
    }

    const existing = await prisma.employeeDependent.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return apiError("Dependent not found", 404);
    }

    const parsed = employeeDependentSchema.parse(rest);

    const dependent = await prisma.employeeDependent.update({
      where: { id },
      data: {
        name: parsed.name,
        relationship: parsed.relationship,
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
        gender: parsed.gender || null,
        metadata: parsed.metadata ?? undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "EmployeeDependent",
      entityId: dependent.id,
      details: `Updated dependent ${dependent.name}`,
    });

    return apiSuccess(dependent);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid dependent data", 422);
    }
    console.error(err);
    return apiError("Failed to update dependent", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  if (!id) {
    return apiError("Dependent id is required", 400);
  }

  const existing = await prisma.employeeDependent.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return apiError("Dependent not found", 404);
  }

  await prisma.employeeDependent.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entity: "EmployeeDependent",
    entityId: id,
    details: `Removed dependent ${existing.name}`,
  });

  return apiSuccess({ id });
}
