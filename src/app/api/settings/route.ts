import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { companySettingsSchema } from "@/lib/validations";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  let settings = await prisma.companySettings.findFirst();

  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  return apiSuccess(settings);
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = companySettingsSchema.parse(body);

    if (parsed.topLevelEmployeeId) {
      const topLevel = await prisma.user.findUnique({
        where: { id: parsed.topLevelEmployeeId },
        select: { id: true, status: true },
      });
      if (!topLevel || topLevel.status !== "ACTIVE") {
        return apiError("Top-level employee must be an active employee", 400);
      }
    }

    const existing = await prisma.companySettings.findFirst();

    const settings = existing
      ? await prisma.companySettings.update({
          where: { id: existing.id },
          data: {
            ...parsed,
            companyEmail: parsed.companyEmail || null,
            companyTan: parsed.companyTan || null,
          },
        })
      : await prisma.companySettings.create({
          data: {
            ...parsed,
            companyEmail: parsed.companyEmail || null,
            companyTan: parsed.companyTan || null,
          },
        });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "CompanySettings",
      entityId: settings.id,
      details: "Updated company settings",
    });

    return apiSuccess(settings);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid settings data", 422);
    }
    return apiError("Failed to update settings", 500);
  }
}
