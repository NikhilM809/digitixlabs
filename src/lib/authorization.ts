import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSION_SLUGS,
  CRITICAL_ADMIN_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  type PermissionSlug,
} from "@/lib/permission-definitions";

const permissionCache = new Map<string, { permissions: Set<string>; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function cacheKey(userId: string) {
  return `user-perms:${userId}`;
}

export function invalidateUserPermissionCache(userId?: string) {
  if (userId) {
    permissionCache.delete(cacheKey(userId));
    return;
  }
  permissionCache.clear();
}

function isAssignmentActive(effectiveFrom: Date, effectiveTo: Date | null, at = new Date()) {
  if (effectiveFrom > at) return false;
  if (effectiveTo && effectiveTo < at) return false;
  return true;
}

async function loadSystemRolePermissions(role: RoleName): Promise<string[]> {
  const systemRole = await prisma.customRole.findFirst({
    where: { isSystem: true, systemRoleKey: role, status: "ACTIVE" },
    include: {
      permissions: { include: { permission: { select: { name: true } } } },
    },
  });

  if (systemRole && systemRole.permissions.length > 0) {
    return systemRole.permissions.map((rp) => rp.permission.name);
  }

  const legacy = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: { select: { name: true } } },
  });

  if (legacy.length > 0) {
    return legacy.map((rp) => rp.permission.name);
  }

  return [...(SYSTEM_ROLE_PERMISSIONS[role] ?? [])];
}

export async function getUserPermissionSlugs(userId: string, role: RoleName): Promise<Set<string>> {
  const cached = permissionCache.get(cacheKey(userId));
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  const permissions = new Set<string>();

  const systemPerms = await loadSystemRolePermissions(role);
  systemPerms.forEach((p) => permissions.add(p));

  const nowDate = new Date();
  const customAssignments = await prisma.userCustomRole.findMany({
    where: {
      userId,
      customRole: { status: "ACTIVE" },
    },
    include: {
      customRole: {
        include: {
          permissions: { include: { permission: { select: { name: true } } } },
        },
      },
    },
  });

  for (const assignment of customAssignments) {
    if (!isAssignmentActive(assignment.effectiveFrom, assignment.effectiveTo, nowDate)) {
      continue;
    }
    for (const rp of assignment.customRole.permissions) {
      permissions.add(rp.permission.name);
    }
  }

  if (role === "ADMIN") {
    ALL_PERMISSION_SLUGS.forEach((p) => permissions.add(p));
  }

  permissionCache.set(cacheKey(userId), {
    permissions,
    expiresAt: now + CACHE_TTL_MS,
  });

  return permissions;
}

export async function userHasPermission(
  userId: string,
  role: RoleName,
  permission: PermissionSlug | string
): Promise<boolean> {
  const permissions = await getUserPermissionSlugs(userId, role);
  return permissions.has(permission);
}

export async function userHasAnyPermission(
  userId: string,
  role: RoleName,
  permissionList: string[]
): Promise<boolean> {
  const permissions = await getUserPermissionSlugs(userId, role);
  return permissionList.some((p) => permissions.has(p));
}

export async function assertRetainsCriticalAdminAccess(
  actorId: string,
  actorRole: RoleName,
  targetRoleId: string,
  nextPermissionIds: string[]
) {
  const actorAssignments = await prisma.userCustomRole.findMany({
    where: { userId: actorId, customRoleId: targetRoleId },
  });

  const isEditingOwnRole = actorAssignments.length > 0;
  const isSystemAdminRole = await prisma.customRole.findFirst({
    where: { id: targetRoleId, isSystem: true, systemRoleKey: "ADMIN" },
  });

  if (!isEditingOwnRole && !isSystemAdminRole) return;

  const nextPermissions = await prisma.permission.findMany({
    where: { id: { in: nextPermissionIds } },
    select: { name: true },
  });
  const nextSlugs = new Set(nextPermissions.map((p) => p.name));

  const actorPerms = await getUserPermissionSlugs(actorId, actorRole);
  for (const critical of CRITICAL_ADMIN_PERMISSIONS) {
    if (actorPerms.has(critical) && !nextSlugs.has(critical)) {
      throw new Error(
        "Cannot remove critical administrative permissions from your own role."
      );
    }
  }
}

export async function syncPermissionsCatalog() {
  const { ALL_PERMISSION_DEFINITIONS } = await import("@/lib/permission-definitions");

  for (const def of ALL_PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { name: def.name },
      update: {
        description: def.description,
        module: def.module,
        action: def.action,
      },
      create: {
        name: def.name,
        description: def.description,
        module: def.module,
        action: def.action,
      },
    });
  }
}

export async function ensureSystemRoles() {
  const { SYSTEM_ROLE_LABELS, roleNameToCode } = await import("@/lib/permission-definitions");

  await syncPermissionsCatalog();

  const allPermissions = await prisma.permission.findMany();
  const permissionByName = new Map(allPermissions.map((p) => [p.name, p.id]));

  for (const systemRoleKey of ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const) {
    const label = SYSTEM_ROLE_LABELS[systemRoleKey];
    const code = roleNameToCode(label === "Super Admin" ? "ADMIN" : label);

    const role = await prisma.customRole.upsert({
      where: { code },
      update: {
        name: label,
        isSystem: true,
        systemRoleKey,
        status: "ACTIVE",
      },
      create: {
        name: label,
        code,
        description: `System role: ${label}`,
        isSystem: true,
        systemRoleKey,
        status: "ACTIVE",
        hierarchyLevel:
          systemRoleKey === "ADMIN"
            ? 100
            : systemRoleKey === "HR"
              ? 80
              : systemRoleKey === "MANAGER"
                ? 60
                : 10,
      },
    });

    const slugs = SYSTEM_ROLE_PERMISSIONS[systemRoleKey];
    const permissionIds = slugs
      .map((name) => permissionByName.get(name))
      .filter(Boolean) as string[];

    await prisma.customRolePermission.deleteMany({ where: { customRoleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.customRolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          customRoleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    for (const slug of slugs) {
      const permissionId = permissionByName.get(slug);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: { role: systemRoleKey, permissionId },
        },
        update: {},
        create: { role: systemRoleKey, permissionId },
      }).catch(() => {});
    }
  }
}
