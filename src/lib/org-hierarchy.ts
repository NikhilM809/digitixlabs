import type { RoleName, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAdministrativePlaceholderNodeId,
  isAdministrativePlaceholderNodeId,
} from "@/lib/org-administrative-position";

export interface OrgEmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  status: UserStatus;
  managerId: string | null;
  administrativePositionId?: string | null;
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
  isAdministrativePlaceholder?: boolean;
  placeholderId?: string;
  placeholderCode?: string;
}

export interface BuildOrgTreeOptions {
  activeDirectReportsOnly?: boolean;
  topLevelEmployeeId?: string | null;
  includeAdministrativePlaceholder?: boolean;
  administrativePosition?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

const employeeSelect = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  managerId: true,
  administrativePositionId: true,
  avatar: true,
  department: { select: { name: true } },
  designation: { select: { name: true } },
} as const;

export async function getTopLevelEmployeeId() {
  const settings = await prisma.companySettings.findFirst({
    select: { topLevelEmployeeId: true },
  });
  return settings?.topLevelEmployeeId ?? null;
}

export async function fetchOrgEmployees(includeInactive = false) {
  return prisma.user.findMany({
    where: includeInactive ? {} : { status: "ACTIVE" },
    select: employeeSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

/** Resolve manager chain through inactive managers so active employees stay under correct hierarchy. */
export async function resolveActiveManagerIds(
  employees: OrgEmployee[]
): Promise<OrgEmployee[]> {
  const activeIds = new Set(employees.map((e) => e.id));
  const cache = new Map<string, string | null>();

  async function resolve(managerId: string | null): Promise<string | null> {
    if (!managerId) return null;
    if (activeIds.has(managerId)) return managerId;
    if (cache.has(managerId)) return cache.get(managerId)!;

    let current: string | null = managerId;
    const visited = new Set<string>();

    while (current) {
      if (visited.has(current)) {
        cache.set(managerId, null);
        return null;
      }
      visited.add(current);

      if (activeIds.has(current)) {
        cache.set(managerId, current);
        return current;
      }

      const record: { managerId: string | null } | null = await prisma.user.findUnique({
        where: { id: current },
        select: { managerId: true },
      });
      current = record?.managerId ?? null;
    }

    cache.set(managerId, null);
    return null;
  }

  const resolved = await Promise.all(
    employees.map(async (employee) => ({
      ...employee,
      managerId: await resolve(employee.managerId),
    }))
  );

  return resolved;
}

export function restrictToTopLevelSubtree(
  employees: OrgEmployee[],
  topLevelEmployeeId: string
): OrgEmployee[] {
  const byManager = new Map<string, OrgEmployee[]>();
  for (const employee of employees) {
    if (!employee.managerId) continue;
    const list = byManager.get(employee.managerId) ?? [];
    list.push(employee);
    byManager.set(employee.managerId, list);
  }

  const inSubtree = new Set<string>();
  const queue = [topLevelEmployeeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (inSubtree.has(id)) continue;
    inSubtree.add(id);
    for (const child of byManager.get(id) ?? []) {
      queue.push(child.id);
    }
  }

  return employees
    .filter((employee) => inSubtree.has(employee.id))
    .map((employee) =>
      employee.id === topLevelEmployeeId ? { ...employee, managerId: null } : employee
    );
}

export function enrichOrgChartTree(
  nodes: OrgTreeNode[],
  employees: OrgEmployee[]
): OrgChartNode[] {
  const byId = new Map(employees.map((e) => [e.id, e]));

  function enrich(node: OrgTreeNode): OrgChartNode {
    if (node.isAdministrativePlaceholder) {
      return {
        ...node,
        avatar: null,
        managerName: null,
        children: node.children.map(enrich),
      };
    }

    const manager = node.managerId ? byId.get(node.managerId) : null;
    return {
      ...node,
      avatar: node.avatar ?? null,
      managerName: manager ? `${manager.firstName} ${manager.lastName}` : null,
      children: node.children.map(enrich),
    };
  }

  return nodes.map(enrich);
}

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
  options?: BuildOrgTreeOptions
): OrgTreeNode[] {
  const activeDirectReportsOnly = options?.activeDirectReportsOnly ?? false;
  const includeAdministrativePlaceholder = options?.includeAdministrativePlaceholder ?? false;
  const administrativePosition = options?.administrativePosition ?? null;
  const topLevelEmployeeId = options?.topLevelEmployeeId ?? null;

  let workingEmployees = employees;

  if (topLevelEmployeeId && workingEmployees.some((e) => e.id === topLevelEmployeeId)) {
    workingEmployees = restrictToTopLevelSubtree(workingEmployees, topLevelEmployeeId);
  }

  const assigneesUnderPlaceholder = new Set<string>();
  if (includeAdministrativePlaceholder && administrativePosition) {
    for (const employee of workingEmployees) {
      if (employee.administrativePositionId === administrativePosition.id) {
        assigneesUnderPlaceholder.add(employee.id);
      }
    }
  }

  const byId = new Map(workingEmployees.map((e) => [e.id, e]));
  const childrenMap = new Map<string, OrgEmployee[]>();

  for (const emp of workingEmployees) {
    if (assigneesUnderPlaceholder.has(emp.id)) continue;

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

  let roots = workingEmployees.filter(
    (e) =>
      !assigneesUnderPlaceholder.has(e.id) &&
      (!e.managerId || !byId.has(e.managerId))
  );

  if (topLevelEmployeeId) {
    const topLevel = workingEmployees.find((e) => e.id === topLevelEmployeeId);
    if (topLevel) {
      roots = [{ ...topLevel, managerId: null }];
    }
  }

  let tree = roots
    .map(toNode)
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );

  if (includeAdministrativePlaceholder && administrativePosition) {
    const placeholderAssignees = workingEmployees.filter((e) =>
      assigneesUnderPlaceholder.has(e.id)
    );

    const placeholderNode: OrgTreeNode = {
      id: getAdministrativePlaceholderNodeId(administrativePosition.id),
      employeeId: administrativePosition.code,
      firstName: administrativePosition.name,
      lastName: "(Admin Placeholder)",
      role: "ADMIN",
      status: "ACTIVE",
      managerId: null,
      administrativePositionId: null,
      avatar: null,
      department: null,
      designation: null,
      directReportCount: placeholderAssignees.length,
      isAdministrativePlaceholder: true,
      placeholderId: administrativePosition.id,
      placeholderCode: administrativePosition.code,
      children: placeholderAssignees
        .map(toNode)
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        ),
    };

    if (topLevelEmployeeId && tree.length === 1) {
      tree = [
        {
          ...tree[0],
          children: [...tree[0].children, placeholderNode].sort((a, b) => {
            if (a.isAdministrativePlaceholder) return 1;
            if (b.isAdministrativePlaceholder) return -1;
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          }),
          directReportCount:
            tree[0].directReportCount + placeholderAssignees.length,
        },
      ];
    } else {
      tree = [...tree, placeholderNode].sort((a, b) => {
        if (a.isAdministrativePlaceholder) return 1;
        if (b.isAdministrativePlaceholder) return -1;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
    }
  }

  return tree;
}

export function filterOrgTree(nodes: OrgTreeNode[], query: string): OrgTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function filterNode(node: OrgTreeNode): OrgTreeNode | null {
    const label = `${node.firstName} ${node.lastName}`.toLowerCase();
    const matches =
      node.isAdministrativePlaceholder ||
      node.firstName.toLowerCase().includes(q) ||
      node.lastName.toLowerCase().includes(q) ||
      node.employeeId.toLowerCase().includes(q) ||
      label.includes(q);

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

export async function wouldCreateReportingCycle(
  userId: string,
  newManagerId: string | null
): Promise<boolean> {
  if (!newManagerId || isAdministrativePlaceholderNodeId(newManagerId)) return false;
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

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, managerId: true, joiningDate: true, status: true },
  });
  if (!employee) {
    throw new Error("Employee not found");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error("Only active employees can be updated in the hierarchy");
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

  if (employee.managerId === managerId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...employeeSelect,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  await ensureInitialReportingHistory(userId);

  await prisma.$transaction(async (tx) => {
    const openHistory = await tx.reportingHistory.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
    });

    if (openHistory) {
      await tx.reportingHistory.update({
        where: { id: openHistory.id },
        data: { effectiveTo: effectiveFrom },
      });
    } else if (employee.managerId !== null || managerId !== null) {
      await tx.reportingHistory.create({
        data: {
          userId,
          managerId: employee.managerId,
          effectiveFrom: employee.joiningDate,
          effectiveTo: effectiveFrom,
        },
      });
    }

    await tx.reportingHistory.create({
      data: {
        userId,
        managerId,
        effectiveFrom,
        effectiveTo: null,
        changedById,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        managerId,
        administrativePositionId: null,
      },
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

export async function assignAdministrativePosition(params: {
  userId: string;
  positionId: string | null;
}) {
  const employee = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, status: true },
  });
  if (!employee) {
    throw new Error("Employee not found");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error("Only active employees can be assigned to the administrative position");
  }

  if (params.positionId) {
    const position = await prisma.orgAdministrativePosition.findUnique({
      where: { id: params.positionId },
      select: { id: true, isActive: true },
    });
    if (!position || !position.isActive) {
      throw new Error("Administrative position not found");
    }
  }

  return prisma.user.update({
    where: { id: params.userId },
    data: { administrativePositionId: params.positionId },
    select: employeeSelect,
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

export async function prepareOrgHierarchyDataset(options: {
  includeInactive?: boolean;
  viewerIsAdmin?: boolean;
}) {
  const includeInactive = options.includeInactive ?? false;
  const viewerIsAdmin = options.viewerIsAdmin ?? false;

  let employees: OrgEmployee[] = await fetchOrgEmployees(includeInactive ? true : false);
  if (!includeInactive) {
    employees = await resolveActiveManagerIds(employees);
  }

  const topLevelEmployeeId = await getTopLevelEmployeeId();
  const administrativePosition =
    viewerIsAdmin ? await prisma.orgAdministrativePosition.findFirst({
      where: { code: "DR", isActive: true },
      select: { id: true, code: true, name: true },
    }) : null;

  if (!viewerIsAdmin) {
    employees = employees.map((e) => ({
      ...e,
      administrativePositionId: null,
    }));
  }

  return {
    employees,
    topLevelEmployeeId,
    administrativePosition,
  };
}
