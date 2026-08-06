import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api-utils";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "MANAGER"]);
  if (error) return error;

  const designations = await prisma.designation.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return apiSuccess(designations);
}
