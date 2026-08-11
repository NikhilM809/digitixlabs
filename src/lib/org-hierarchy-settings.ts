import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface OrgHierarchyVisibility {
  orgHierarchyVisibleToEmployees: boolean;
  orgHierarchyVisibleToManagers: boolean;
}

export async function getOrgHierarchyVisibility(): Promise<OrgHierarchyVisibility> {
  const settings = await prisma.companySettings.findFirst({
    select: {
      orgHierarchyVisibleToEmployees: true,
      orgHierarchyVisibleToManagers: true,
    },
  });

  return {
    orgHierarchyVisibleToEmployees:
      settings?.orgHierarchyVisibleToEmployees ?? true,
    orgHierarchyVisibleToManagers:
      settings?.orgHierarchyVisibleToManagers ?? true,
  };
}

export function canViewOrgStructure(
  role: RoleName,
  visibility: OrgHierarchyVisibility
): boolean {
  if (role === "ADMIN" || role === "HR") return true;
  if (role === "MANAGER") return visibility.orgHierarchyVisibleToManagers;
  if (role === "EMPLOYEE") return visibility.orgHierarchyVisibleToEmployees;
  return false;
}

export async function assertCanViewOrgStructure(role: RoleName) {
  const visibility = await getOrgHierarchyVisibility();
  if (!canViewOrgStructure(role, visibility)) {
    throw new Error("Organization structure is not available for your role");
  }
  return visibility;
}
