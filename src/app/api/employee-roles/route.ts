import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requireAuth,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeRoleDefinitionSchema } from "@/lib/validations";
import { ensureEmployeeRoles, roleNameToCode } from "@/lib/employee-roles";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
  if (error) return error;

  await ensureEmployeeRoles();

  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

  const roles = await prisma.employeeRoleDefinition.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: { _count: { select: { employees: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return apiSuccess(roles);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = employeeRoleDefinitionSchema.parse(body);

    const existing = await prisma.employeeRoleDefinition.findFirst({
      where: { name: { equals: parsed.name, mode: "insensitive" } },
    });
    if (existing) return apiError("A role with this name already exists", 409);

    const codes = (await prisma.employeeRoleDefinition.findMany({ select: { code: true } })).map(
      (r) => r.code
    );
    let code = parsed.code?.trim() || roleNameToCode(parsed.name);
    if (codes.includes(code)) {
      let n = 2;
      while (codes.includes(`${code}_${n}`)) n++;
      code = `${code}_${n}`;
    }

    const role = await prisma.employeeRoleDefinition.create({
      data: {
        name: parsed.name.trim(),
        code,
        description: parsed.description?.trim() || null,
        accessLevel: parsed.accessLevel,
        isActive: parsed.isActive ?? true,
      },
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "EmployeeRoleDefinition",
      entityId: role.id,
      details: `Created role ${role.name}`,
    });

    return apiSuccess(role, 201);
  } catch (err) {
    console.error(err);
    return apiError("Failed to create role", 500);
  }
}
