import { NextRequest } from "next/server";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { isAdmin } from "@/lib/permissions";
import {
  buildOrgTree,
  enrichOrgChartTree,
  prepareOrgHierarchyDataset,
} from "@/lib/org-hierarchy";
import {
  applyOrgChartLayoutToTree,
} from "@/lib/org-chart-layout";
import { getOrgChartLayout, saveOrgChartLayout } from "@/lib/org-chart-layout-server";
import { orgChartLayoutSchema } from "@/lib/org-chart-layout";
import { wrapOrgTreeWithCompanyRoot } from "@/lib/org-company-root";

export async function GET() {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!isAdmin(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const layout = await getOrgChartLayout();
    const { employees, topLevelEmployeeId, companyName, administrativePosition } =
      await prepareOrgHierarchyDataset({
        includeInactive: false,
        viewerIsAdmin: true,
      });

    const tree = wrapOrgTreeWithCompanyRoot(
      buildOrgTree(employees, {
        activeDirectReportsOnly: true,
        topLevelEmployeeId,
        includeAdministrativePlaceholder: true,
        administrativePosition,
      }),
      companyName,
      topLevelEmployeeId
    );

    const chart = enrichOrgChartTree(tree, employees);
    const previewTree = applyOrgChartLayoutToTree(chart, layout, topLevelEmployeeId);

    return apiSuccess({ layout, tree: chart, previewTree, topLevelEmployeeId, companyName });
  } catch (err) {
    console.error("Org chart layout GET error:", err);
    return apiError("Failed to load org chart layout", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!isAdmin(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await req.json();
    const parsed = orgChartLayoutSchema.parse(body.layout ?? body);
    const layout = await saveOrgChartLayout(parsed);

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "CompanySettings",
      details: "Updated organization chart layout settings",
    });

    return apiSuccess({ layout });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid layout settings", 422);
    }
    console.error("Org chart layout PATCH error:", err);
    return apiError("Failed to save org chart layout", 500);
  }
}
