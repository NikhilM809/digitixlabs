import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { departmentSchema } from "@/lib/validations";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const departments = await prisma.department.findMany({
    include: {
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(departments);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = departmentSchema.parse(body);

    const existing = await prisma.department.findUnique({
      where: { name: parsed.name },
    });
    if (existing) {
      return apiError("Department already exists", 409);
    }

    const department = await prisma.department.create({
      data: parsed,
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "Department",
      entityId: department.id,
      details: `Created department ${department.name}`,
    });

    return apiSuccess(department, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid department data", 422);
    }
    return apiError("Failed to create department", 500);
  }
}
