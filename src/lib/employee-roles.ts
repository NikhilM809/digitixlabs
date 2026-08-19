import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SYSTEM_ROLE_SEEDS = [
  { name: "Admin", code: "ADMIN", accessLevel: "ADMIN" as RoleName, description: "Full system access" },
  { name: "HR", code: "HR", accessLevel: "HR" as RoleName, description: "Human resources operations" },
  { name: "Manager", code: "MANAGER", accessLevel: "MANAGER" as RoleName, description: "Team manager" },
  { name: "Employee", code: "EMPLOYEE", accessLevel: "EMPLOYEE" as RoleName, description: "Standard employee" },
] as const;

export const SAMPLE_CUSTOM_ROLES = [
  { name: "CEO", code: "CEO", accessLevel: "ADMIN" as RoleName, description: "Chief Executive Officer" },
  { name: "CTO", code: "CTO", accessLevel: "MANAGER" as RoleName, description: "Chief Technology Officer" },
  { name: "Delivery Manager", code: "DELIVERY_MANAGER", accessLevel: "MANAGER" as RoleName, description: "Delivery and execution lead" },
  { name: "Project Manager", code: "PROJECT_MANAGER", accessLevel: "MANAGER" as RoleName, description: "Project delivery manager" },
  { name: "Team Lead", code: "TEAM_LEAD", accessLevel: "MANAGER" as RoleName, description: "Functional team lead" },
] as const;

export function roleNameToCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function ensureEmployeeRoles() {
  for (const seed of SYSTEM_ROLE_SEEDS) {
    await prisma.employeeRoleDefinition.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        description: seed.description,
        accessLevel: seed.accessLevel,
        isSystem: true,
        isActive: true,
      },
      create: {
        name: seed.name,
        code: seed.code,
        description: seed.description,
        accessLevel: seed.accessLevel,
        isSystem: true,
        isActive: true,
      },
    });
  }

  for (const seed of SAMPLE_CUSTOM_ROLES) {
    await prisma.employeeRoleDefinition.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        description: seed.description,
        accessLevel: seed.accessLevel,
        isActive: true,
      },
      create: {
        name: seed.name,
        code: seed.code,
        description: seed.description,
        accessLevel: seed.accessLevel,
        isSystem: false,
        isActive: true,
      },
    });
  }
}

export async function resolveOrgRole(orgRoleId: string) {
  const orgRole = await prisma.employeeRoleDefinition.findUnique({
    where: { id: orgRoleId },
  });
  if (!orgRole) {
    throw new Error("Invalid role selected");
  }
  if (!orgRole.isActive) {
    throw new Error("Selected role is inactive");
  }
  return orgRole;
}
