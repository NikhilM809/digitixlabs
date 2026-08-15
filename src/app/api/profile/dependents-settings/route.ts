import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
} from "@/lib/api-utils";
import { getDependentDetailsEnabled } from "@/lib/dependent-details-settings";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const enabled = await getDependentDetailsEnabled();
  return apiSuccess({ enabled });
}
