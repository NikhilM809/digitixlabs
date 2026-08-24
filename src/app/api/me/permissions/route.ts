import { getUserPermissionSlugs } from "@/lib/authorization";
import { apiSuccess, requireAuth } from "@/lib/api-utils";

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;

  const permissions = await getUserPermissionSlugs(user!.id, user!.role);

  return apiSuccess({
    permissions: Array.from(permissions),
    role: user!.role,
  });
}
