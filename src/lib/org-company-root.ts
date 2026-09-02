import type { OrgTreeNode } from "@/lib/org-hierarchy";

export const COMPANY_ROOT_NODE_ID = "company:root";

export function isCompanyRootNodeId(id: string) {
  return id === COMPANY_ROOT_NODE_ID;
}

/** Replace the configured top-level employee with a company root node in chart views. */
export function wrapOrgTreeWithCompanyRoot(
  tree: OrgTreeNode[],
  companyName: string,
  topLevelEmployeeId: string | null
): OrgTreeNode[] {
  if (!topLevelEmployeeId || tree.length !== 1) return tree;

  const topNode = tree[0];
  if (topNode.id !== topLevelEmployeeId) return tree;

  const companyRoot: OrgTreeNode = {
    id: COMPANY_ROOT_NODE_ID,
    employeeId: "COMPANY",
    firstName: companyName.trim(),
    lastName: "",
    role: "ADMIN",
    status: "ACTIVE",
    managerId: null,
    administrativePositionId: null,
    avatar: null,
    department: null,
    designation: null,
    directReportCount: topNode.children.length,
    isCompanyRoot: true,
    topLevelEmployeeId,
    children: topNode.children,
  };

  return [companyRoot];
}

export function remapLayoutSiblingOrdersForCompanyRoot(
  siblingOrders: Record<string, string[]>,
  topLevelEmployeeId: string | null
): Record<string, string[]> {
  if (!topLevelEmployeeId || !siblingOrders[topLevelEmployeeId]) {
    return siblingOrders;
  }

  const next = { ...siblingOrders };
  if (!next[COMPANY_ROOT_NODE_ID]) {
    next[COMPANY_ROOT_NODE_ID] = next[topLevelEmployeeId];
  }
  return next;
}
