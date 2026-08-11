import { NextRequest } from "next/server";
import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeKraSchema } from "@/lib/validations";
import { canAccessKra } from "@/lib/permissions";
import {
  canManageEmployeeKra,
  kraWeightMessage,
  summarizeKraWeights,
} from "@/lib/employee-kra";

async function getEmployeeForKra(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, managerId: true, firstName: true, lastName: true, role: true },
  });
}

async function buildKraResponse(userId: string) {
  const [items, config] = await Promise.all([
    prisma.employeeKra.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.employeeKraConfig.findUnique({ where: { userId } }),
  ]);

  const weightSummary = summarizeKraWeights(items.map((i) => i.weight));

  return {
    items,
    config: config ?? { userId, isFinalized: false, finalizedAt: null, finalizedById: null },
    weightSummary,
    weightMessage: kraWeightMessage(weightSummary),
  };
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  const userId = request.nextUrl.searchParams.get("userId");

  if (user.role === RoleName.EMPLOYEE) {
    return apiSuccess(await buildKraResponse(user.id));
  }

  if (!userId) {
    return apiError("userId is required", 400);
  }

  const employee = await getEmployeeForKra(userId);
  if (!employee) {
    return apiError("Employee not found", 404);
  }

  if (!(await canManageEmployeeKra(user.role, user.id, employee)) && userId !== user.id) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(await buildKraResponse(userId));
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  if (!canAccessKra(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = employeeKraSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const employee = await getEmployeeForKra(parsed.data.userId);
    if (!employee) {
      return apiError("Employee not found", 404);
    }

    if (!(await canManageEmployeeKra(user.role, user.id, employee))) {
      return apiError("Forbidden", 403);
    }

    const config = await prisma.employeeKraConfig.findUnique({
      where: { userId: parsed.data.userId },
    });
    if (config?.isFinalized) {
      return apiError("KRA configuration is finalized. Reopen before editing.", 400);
    }

    const count = await prisma.employeeKra.count({ where: { userId: parsed.data.userId } });

    const item = await prisma.employeeKra.create({
      data: {
        userId: parsed.data.userId,
        name: parsed.data.name,
        measure: parsed.data.measure,
        weight: parsed.data.weight,
        sortOrder: parsed.data.sortOrder ?? count,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await prisma.employeeKraConfig.upsert({
      where: { userId: parsed.data.userId },
      create: { userId: parsed.data.userId, isFinalized: false },
      update: { isFinalized: false, finalizedAt: null, finalizedById: null },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "EmployeeKra",
      entityId: item.id,
      details: `Added KRA "${item.name}" for ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(await buildKraResponse(parsed.data.userId), 201);
  } catch (err) {
    console.error("Employee KRA create error:", err);
    return apiError("Failed to add KRA", 500);
  }
}
