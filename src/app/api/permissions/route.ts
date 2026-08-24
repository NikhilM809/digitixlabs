import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, requirePermission } from "@/lib/api-utils";
import { PERMISSION_MODULES } from "@/lib/permission-definitions";
import { ensureSystemRoles } from "@/lib/authorization";

export async function GET() {
  const { error } = await requirePermission("admin.manage_permissions", ["ADMIN"]);
  if (error) return error;

  await ensureSystemRoles();

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { name: "asc" }],
  });

  const grouped = Object.entries(PERMISSION_MODULES).map(([key, value]) => ({
    module: key,
    label: value.label,
    permissions: permissions
      .filter((p) => p.module === key)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        action: p.action,
      })),
  }));

  return apiSuccess({ permissions, grouped });
}
