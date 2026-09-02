import { prisma } from "@/lib/prisma";

export const DEFAULT_WORK_TYPES = [
  { code: "INITIAL_SCRIPTING", name: "Initial Scripting", category: "initial", sortOrder: 10 },
  { code: "INITIAL_QA", name: "Initial QA", category: "initial", sortOrder: 20 },
  { code: "CHANGES", name: "Changes", category: "changes", sortOrder: 30 },
  { code: "CHANGES_QA", name: "Changes QA", category: "changes", sortOrder: 40 },
  { code: "LIVE", name: "Live", category: "live", sortOrder: 50 },
  { code: "PROJECT_MANAGEMENT", name: "Project Management", category: "pm", sortOrder: 60 },
] as const;

export const DEFAULT_INVOICE_SERVICES = ["Survey Programming and Consulting"];

export async function ensureCatalog() {
  const [workTypes, services, clients] = await Promise.all([
    prisma.wnWorkTypeOption.count(),
    prisma.wnInvoiceService.count(),
    prisma.wnClient.count(),
  ]);
  if (workTypes === 0) {
    await prisma.wnWorkTypeOption.createMany({ data: [...DEFAULT_WORK_TYPES] });
  }
  if (services === 0) {
    await prisma.wnInvoiceService.createMany({
      data: DEFAULT_INVOICE_SERVICES.map((name) => ({ name })),
    });
  }
  if (clients === 0) {
    const names = [
      ...new Set(
        (await prisma.wnProject.findMany({ select: { clientName: true } })).map((row) => row.clientName.trim()).filter(Boolean),
      ),
    ];
    const settings = await prisma.worknestSetting.findUnique({ where: { id: "default" } });
    if (!names.length) names.push("Pureprofile");
    await prisma.wnClient.createMany({
      data: names.map((name) => ({
        name,
        legalName: name.toLowerCase().includes("pureprofile") ? settings?.billToName || "PUREPROFILE LIMITED" : name,
        address: name.toLowerCase().includes("pureprofile") ? settings?.billToAddress || "" : "",
      })),
    });
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "WnProject" SET "initialSellValue" = "sellValue" WHERE "initialSellValue" = 0 AND "sellValue" > 0`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "WnProject" SET "initialEstimatedHours" = "estimatedHours" WHERE "initialEstimatedHours" = 0 AND "estimatedHours" > 0`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "WnProject" SET "programmerHours" = ROUND(("estimatedHours" * 0.6)::numeric, 1)::double precision, "qaHours" = ROUND(("estimatedHours" * 0.3)::numeric, 1)::double precision, "marginHours" = ROUND(("estimatedHours" - ROUND(("estimatedHours" * 0.6)::numeric, 1) - ROUND(("estimatedHours" * 0.3)::numeric, 1))::numeric, 1)::double precision WHERE "programmerHours" = 0 AND "estimatedHours" > 0`,
  );
  return {
    clients: await prisma.wnClient.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    workTypes: await prisma.wnWorkTypeOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    services: await prisma.wnInvoiceService.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  };
}

export async function getActiveClients() {
  await ensureCatalog();
  return prisma.wnClient.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function getActiveWorkTypes() {
  await ensureCatalog();
  return prisma.wnWorkTypeOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export async function getActiveInvoiceServices() {
  await ensureCatalog();
  return prisma.wnInvoiceService.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function findClientByName(name: string) {
  return prisma.wnClient.findFirst({ where: { name } });
}
