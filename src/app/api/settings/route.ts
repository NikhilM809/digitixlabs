import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requirePermission,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { companySettingsSchema } from "@/lib/validations";

export async function GET() {
  const { error } = await requirePermission("admin.manage_settings", ["ADMIN"]);
  if (error) return error;

  let settings = await prisma.companySettings.findFirst();

  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  return apiSuccess(settings);
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requirePermission("admin.manage_settings", ["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = companySettingsSchema.parse(body);

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
