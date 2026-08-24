import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requirePermission,
  requireAnyPermission,
  createAuditLog,
} from "@/lib/api-utils";
import { customRoleSchema } from "@/lib/validations";
import { generateRoleCode, roleListSelect } from "@/lib/role-utils";
import { createRoleAuditLog } from "@/lib/role-audit";
import { ensureSystemRoles, invalidateUserPermissionCache } from "@/lib/authorization";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const forAssignment = searchParams.get("forAssignment") === "true";

  const { error } = forAssignment
    ? await requireAnyPermission(
        ["admin.manage_users", "admin.manage_roles"],
        ["ADMIN", "HR"]
      )
    : await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  await ensureSystemRoles();

  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status");
  const departmentId = searchParams.get("departmentId");

  const where: Prisma.CustomRoleWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "ACTIVE" || status === "INACTIVE") {
    where.status = status;
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  const roles = await prisma.customRole.findMany({
    where,
    select: roleListSelect,
    orderBy: [{ hierarchyLevel: "desc" }, { name: "asc" }],
  });

  return apiSuccess(roles);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  try {
    await ensureSystemRoles();
    const body = await req.json();
    const parsed = customRoleSchema.parse(body);

    const existingName = await prisma.customRole.findFirst({
      where: { name: { equals: parsed.name, mode: "insensitive" } },
    });
    if (existingName) {
      return apiError("A role with this name already exists", 409);
    }

    const existingCodes = (await prisma.customRole.findMany({ select: { code: true } })).map(
      (r) => r.code
    );
    const code =
      parsed.code?.trim() ||
      generateRoleCode(parsed.name, existingCodes);

    const codeTaken = await prisma.customRole.findUnique({ where: { code } });
    if (codeTaken) {
      return apiError("A role with this code already exists", 409);
    }

    const role = await prisma.customRole.create({
      data: {
        name: parsed.name.trim(),
        code,
        description: parsed.description?.trim() || null,
        departmentId: parsed.departmentId || null,
        managerId: parsed.managerId || null,
        parentRoleId: parsed.parentRoleId || null,
        hierarchyLevel: parsed.hierarchyLevel ?? 0,
        status: parsed.status ?? "ACTIVE",
        permissions:
          parsed.permissionIds && parsed.permissionIds.length > 0
            ? {
                create: parsed.permissionIds.map((permissionId) => ({ permissionId })),
              }
            : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        permissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });

    await createRoleAuditLog({
      actorId: user!.id,
      action: "CREATE",
      customRoleId: role.id,
      details: JSON.stringify({ name: role.name, code: role.code }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "CustomRole",
      entityId: role.id,
      details: `Created role ${role.name}`,
    });

    return apiSuccess(role, 201);
  } catch (err) {
    console.error(err);
    return apiError("Failed to create role", 500);
  }
}
