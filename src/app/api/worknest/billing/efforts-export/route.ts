import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/worknest/lib/data";
import { buildEffortsTrackerWorkbook } from "@/worknest/lib/efforts-tracker-excel";
import { formatMonthYear } from "@/worknest/lib/format";
import { requireApiRole } from "@/worknest/lib/permissions";
import { userDisplayName } from "@/worknest/lib/user-adapter";

export async function POST(request: Request) {
  const authz = await requireApiRole("ADMIN");
  if (!authz.ok) return authz.response;

  const body = (await request.json().catch(() => null)) as
    | { projectIds?: string[]; month?: number; year?: number }
    | null;
  const projectIds = [...new Set((body?.projectIds ?? []).map(String).filter(Boolean))];
  if (!projectIds.length) {
    return NextResponse.json({ error: "Select at least one project to export." }, { status: 400 });
  }

  const now = new Date();
  const month = Number(body?.month || now.getMonth() + 1);
  const year = Number(body?.year || now.getFullYear());

  const projects = await prisma.wnProject.findMany({
    where: { id: { in: projectIds } },
    include: {
      manager: true,
      currency: true,
      timeEntries: { select: { date: true, hours: true, workType: true, notes: true }, orderBy: { date: "asc" } },
      invoices: { select: { status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!projects.length) {
    return NextResponse.json({ error: "No matching projects found." }, { status: 404 });
  }

  const settings = await getSettings();
  const bytes = await buildEffortsTrackerWorkbook({
    companyName: settings.companyName,
    periodLabel: formatMonthYear(month, year),
    exportedBy: authz.user.name,
    projects: projects.map((project) => ({
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      description: project.description,
      status: project.status,
      sellValue: project.sellValue,
      startDate: project.startDate,
      createdAt: project.createdAt,
      eta: project.eta,
      actualCompletionDate: project.actualCompletionDate,
      managerName: userDisplayName(project.manager),
      currencyCode: project.currency?.code ?? "",
      timeEntries: project.timeEntries,
      invoices: project.invoices,
    })),
  });

  await prisma.wnProjectExport.createMany({
    data: projects.map((project) => ({
      projectId: project.id,
      exportedById: authz.user.id,
      billingMonth: month,
      billingYear: year,
      exportType: "EFFORTS_TRACKER",
    })),
  });

  const clients = [...new Set(projects.map((project) => project.clientName))];
  const clientPart = clients.length === 1 ? clients[0].replace(/[^a-zA-Z0-9]+/g, "") : "Unbilled";
  const filename = `DigitiXLabs_${clientPart}_${formatMonthYear(month, year).replace(" ", "")}_Efforts_Tracker.xlsx`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
