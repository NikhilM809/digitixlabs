import { roleNameToCode } from "@/lib/permission-definitions";

export function generateRoleCode(name: string, existingCodes: string[] = []): string {
  let base = roleNameToCode(name);
  if (!base) base = "ROLE";
  if (!existingCodes.includes(base)) return base;

  let counter = 2;
  while (existingCodes.includes(`${base}_${counter}`)) {
    counter += 1;
  }
  return `${base}_${counter}`;
}

export const roleListSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  status: true,
  isSystem: true,
  systemRoleKey: true,
  hierarchyLevel: true,
  parentRoleId: true,
  departmentId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  parentRole: { select: { id: true, name: true, code: true } },
  _count: { select: { userRoles: true, permissions: true } },
} as const;

export const roleDetailInclude = {
  department: { select: { id: true, name: true } },
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  parentRole: { select: { id: true, name: true, code: true } },
  childRoles: { select: { id: true, name: true, code: true, hierarchyLevel: true } },
  permissions: {
    include: {
      permission: {
        select: { id: true, name: true, description: true, module: true, action: true },
      },
    },
  },
  _count: { select: { userRoles: true } },
} as const;
