import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { designationSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
  if (error) return error;

  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

  const designations = await prisma.designation.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: {
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(designations);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = designationSchema.parse(body);

    const existing = await prisma.designation.findFirst({
      where: { name: { equals: parsed.name, mode: "insensitive" } },
    });
    if (existing) {
      return apiError("Designation already exists", 409);
    }

    const designation = await prisma.designation.create({
      data: parsed,
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "Designation",
      entityId: designation.id,
      details: `Created designation ${designation.name}`,
    });

    return apiSuccess(designation, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid designation data", 422);
    }
    return apiError("Failed to create designation", 500);
  }
}
