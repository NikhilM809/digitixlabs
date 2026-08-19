import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  requirePermission,
  createAuditLog,
} from "@/lib/api-utils";
import { generateRoleCode } from "@/lib/role-utils";
import { createRoleAuditLog } from "@/lib/role-audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requirePermission("admin.manage_roles", ["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const source = await prisma.customRole.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });

    if (!source) return apiError("Role not found", 404);

    const existingCodes = (await prisma.customRole.findMany({ select: { code: true } })).map(
      (r) => r.code
    );
    const existingNames = (await prisma.customRole.findMany({ select: { name: true } })).map(
      (r) => r.name
    );

    let copyName = `${source.name} (Copy)`;
    let suffix = 2;
    while (existingNames.some((n) => n.toLowerCase() === copyName.toLowerCase())) {
      copyName = `${source.name} (Copy ${suffix})`;
      suffix += 1;
    }

    const code = generateRoleCode(copyName, existingCodes);

    const duplicate = await prisma.customRole.create({
      data: {
        name: copyName,
        code,
        description: source.description,
        departmentId: source.departmentId,
        managerId: source.managerId,
        parentRoleId: source.parentRoleId,
        hierarchyLevel: source.hierarchyLevel,
        status: "ACTIVE",
        permissions: {
          create: source.permissions.map((p) => ({ permissionId: p.permissionId })),
        },
      },
      include: {
        department: { select: { id: true, name: true } },
        permissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });

    await createRoleAuditLog({
      actorId: user!.id,
      action: "DUPLICATE",
      customRoleId: duplicate.id,
      details: JSON.stringify({ sourceRoleId: id, sourceName: source.name }),
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "CustomRole",
      entityId: duplicate.id,
      details: `Duplicated role ${source.name} as ${duplicate.name}`,
    });

    return apiSuccess(duplicate, 201);
  } catch (err) {
    console.error(err);
    return apiError("Failed to duplicate role", 500);
  }
}
