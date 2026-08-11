import type { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface OrgEmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: UserStatus;
  managerId: string | null;
  avatar: string | null;
  department: { name: string } | null;
  designation: { name: string } | null;
}

export interface OrgChartNode extends OrgTreeNode {
  avatar: string | null;
  managerName: string | null;
}

export interface OrgTreeNode extends OrgEmployee {
  directReportCount: number;
  children: OrgTreeNode[];
}

const employeeSelect = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  managerId: true,
  avatar: true,
  department: { select: { name: true } },
  designation: { select: { name: true } },
} as const;

export async function fetchOrgEmployees(includeInactive = true) {
  return prisma.user.findMany({
    where: includeInactive ? {} : { status: "ACTIVE" },
    select: employeeSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export function enrichOrgChartTree(
  nodes: OrgTreeNode[],
  employees: OrgEmployee[]
): OrgChartNode[] {
  const byId = new Map(employees.map((e) => [e.id, e]));

  function enrich(node: OrgTreeNode): OrgChartNode {
    const manager = node.managerId ? byId.get(node.managerId) : null;
    return {
      ...node,
      avatar: node.avatar ?? null,
      managerName: manager
        ? `${manager.firstName} ${manager.lastName}`
        : null,
      children: node.children.map(enrich),
    };
  }

  return nodes.map(enrich);
}

/** Collect ancestor IDs from roots down to target user (for auto-expand). */
export function findAncestorIds(
  nodes: OrgTreeNode[],
  targetUserId: string,
  path: string[] = []
): string[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node.id];
    if (node.id === targetUserId) return path;
    const found = findAncestorIds(node.children, targetUserId, nextPath);
    if (found) return found;
  }
  return null;
}

export function buildOrgTree(
  employees: OrgEmployee[],
  options?: { activeDirectReportsOnly?: boolean }
): OrgTreeNode[] {
  const activeDirectReportsOnly = options?.activeDirectReportsOnly ?? false;
  const byId = new Map(employees.map((e) => [e.id, e]));
  const childrenMap = new Map<string, OrgEmployee[]>();

  for (const emp of employees) {
    if (!emp.managerId || !byId.has(emp.managerId)) continue;
    const list = childrenMap.get(emp.managerId) ?? [];
    list.push(emp);
    childrenMap.set(emp.managerId, list);
  }

  function toNode(emp: OrgEmployee): OrgTreeNode {
    const rawChildren = childrenMap.get(emp.id) ?? [];
    const children = rawChildren
      .filter((c) => !activeDirectReportsOnly || c.status === "ACTIVE")
      .map(toNode)
      .sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );

    return {
      ...emp,
      directReportCount: rawChildren.filter((c) => c.status === "ACTIVE").length,
      children,
    };
  }

  const roots = employees.filter(
    (e) => !e.managerId || !byId.has(e.managerId)
  );

  return roots
    .map(toNode)
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
}

export function filterOrgTree(nodes: OrgTreeNode[], query: string): OrgTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function filterNode(node: OrgTreeNode): OrgTreeNode | null {
    const matches =
      node.firstName.toLowerCase().includes(q) ||
      node.lastName.toLowerCase().includes(q) ||
      node.employeeId.toLowerCase().includes(q) ||
      `${node.firstName} ${node.lastName}`.toLowerCase().includes(q);

    const filteredChildren = node.children
      .map(filterNode)
      .filter((c): c is OrgTreeNode => c !== null);

    if (matches || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  return nodes.map(filterNode).filter((n): n is OrgTreeNode => n !== null);
}

/** Walk up manager chain; returns true if assigning managerId would create a cycle. */
export async function wouldCreateReportingCycle(
  userId: string,
  newManagerId: string | null
): Promise<boolean> {
  if (!newManagerId) return false;
  if (userId === newManagerId) return true;

  const visited = new Set<string>();
  let currentId: string | null = newManagerId;

  while (currentId) {
    if (currentId === userId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const record: { managerId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { managerId: true },
    });
    currentId = record?.managerId ?? null;
  }

  return false;
}

export async function ensureInitialReportingHistory(userId: string) {
  const existing = await prisma.reportingHistory.findFirst({
    where: { userId },
  });
  if (existing) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true, joiningDate: true },
  });
  if (!user) return;

  await prisma.reportingHistory.create({
    data: {
      userId,
      managerId: user.managerId,
      effectiveFrom: user.joiningDate,
      effectiveTo: null,
    },
  });
}

export async function assignEmployeeManager(params: {
  userId: string;
  managerId: string | null;
  effectiveFrom: Date;
  changedById: string;
}) {
  const { userId, managerId, effectiveFrom, changedById } = params;

  if (userId === managerId) {
    throw new Error("An employee cannot be their own manager");
  }

  if (managerId) {
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, status: true },
    });
    if (!manager) {
      throw new Error("Selected manager not found");
    }
    if (manager.status !== "ACTIVE") {
      throw new Error("Selected manager must be an active employee");
    }
  }

  const cycle = await wouldCreateReportingCycle(userId, managerId);
  if (cycle) {
    throw new Error("This assignment would create a circular reporting relationship");
  }

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, managerId: true, joiningDate: true },
  });
  if (!employee) {
    throw new Error("Employee not found");
  }

  if (employee.managerId === managerId) {
    return employee;
  }

  await ensureInitialReportingHistory(userId);

  const effectiveDate = effectiveFrom;

  await prisma.$transaction(async (tx) => {
    const openHistory = await tx.reportingHistory.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
    });

    if (openHistory) {
      await tx.reportingHistory.update({
        where: { id: openHistory.id },
        data: { effectiveTo: effectiveDate },
      });
    } else if (employee.managerId !== null || managerId !== null) {
      await tx.reportingHistory.create({
        data: {
          userId,
          managerId: employee.managerId,
          effectiveFrom: employee.joiningDate,
          effectiveTo: effectiveDate,
        },
      });
    }

    await tx.reportingHistory.create({
      data: {
        userId,
        managerId,
        effectiveFrom: effectiveDate,
        effectiveTo: null,
        changedById,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { managerId },
    });
  });

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...employeeSelect,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getDirectReports(
  managerId: string,
  options?: { activeOnly?: boolean }
) {
  const activeOnly = options?.activeOnly ?? true;
  return prisma.user.findMany({
    where: {
      managerId,
      ...(activeOnly ? { status: "ACTIVE" } : {}),
    },
    select: {
      ...employeeSelect,
      email: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function getReportingHistory(userId: string) {
  await ensureInitialReportingHistory(userId);

  return prisma.reportingHistory.findMany({
    where: { userId },
    include: {
      manager: {
        select: { id: true, firstName: true, lastName: true, employeeId: true },
      },
    },
    orderBy: { effectiveFrom: "desc" },
  });
}
