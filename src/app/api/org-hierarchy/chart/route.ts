import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import { assertCanViewOrgStructure } from "@/lib/org-hierarchy-settings";
import {
  buildOrgTree,
  enrichOrgChartTree,
  filterOrgTree,
  findAncestorIds,
  getDirectReports,
  prepareOrgHierarchyDataset,
} from "@/lib/org-hierarchy";
import {
  applyOrgChartLayoutToTree,
} from "@/lib/org-chart-layout";
import { getOrgChartLayout } from "@/lib/org-chart-layout-server";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  try {
    await assertCanViewOrgStructure(user.role);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Forbidden",
      403
    );
  }

  try {
    const search = request.nextUrl.searchParams.get("search") ?? "";
    const { employees, topLevelEmployeeId } = await prepareOrgHierarchyDataset({
      includeInactive: false,
      viewerIsAdmin: false,
    });

    const tree = buildOrgTree(employees, {
      activeDirectReportsOnly: true,
      topLevelEmployeeId,
      includeAdministrativePlaceholder: false,
    });
    const layout = await getOrgChartLayout();
    const laidOut = applyOrgChartLayoutToTree(tree, layout);
    const filtered = filterOrgTree(laidOut, search);
    const chart = enrichOrgChartTree(filtered, employees);

    const ancestorIds = findAncestorIds(tree, user.id) ?? [];
    const directReports = await getDirectReports(user.id, { activeOnly: true });

    const self = employees.find((e) => e.id === user.id);
    const manager = self?.managerId
      ? employees.find((e) => e.id === self.managerId)
      : null;

    return apiSuccess({
      tree: chart,
      layout,
      currentUserId: user.id,
      expandPath: [...ancestorIds, user.id],
      topLevelEmployeeId,
      self: self
        ? {
            ...self,
            managerName: manager
              ? `${manager.firstName} ${manager.lastName}`
              : null,
          }
        : null,
      directReports,
    });
  } catch (err) {
    console.error("Org chart GET error:", err);
    return apiError("Failed to load organization structure", 500);
  }
}
