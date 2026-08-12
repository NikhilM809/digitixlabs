import { requireAuth, apiSuccess, apiError } from "@/lib/api-utils";
import {
  getOrgHierarchyVisibility,
  canViewOrgStructure,
} from "@/lib/org-hierarchy-settings";

export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const visibility = await getOrgHierarchyVisibility();
  const canView = canViewOrgStructure(user.role, visibility);

  return apiSuccess({
    ...visibility,
    canView,
  });
}
