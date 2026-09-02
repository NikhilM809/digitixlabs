import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/worknest/lib/data";
import { buildApprovalWorkbook } from "@/worknest/lib/approval-excel";
import { requireApiRole } from "@/worknest/lib/permissions";
import { userDisplayName } from "@/worknest/lib/user-adapter";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireApiRole("ADMIN");
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const url = new URL(request.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month") || now.getMonth() + 1);
  const year = Number(url.searchParams.get("year") || now.getFullYear());

  const project = await prisma.wnProject.findUnique({
    where: { id },
    include: {
      manager: true,
      currency: true,
      timeEntries: { select: { hours: true, workType: true } },
      invoices: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.status !== "CLOSE") {
    return NextResponse.json({ error: "Only closed projects can be exported for billing approval." }, { status: 400 });
  }

  const settings = await getSettings();
  const bytes = await buildApprovalWorkbook({
    companyName: settings.companyName,
    project: {
      ...project,
      manager: { name: userDisplayName(project.manager) },
    },
    billingMonth: month,
    billingYear: year,
    exportedBy: authz.user.name,
  });

  await prisma.wnProjectExport.create({
    data: {
      projectId: project.id,
      exportedById: authz.user.id,
      billingMonth: month,
      billingYear: year,
      exportType: "APPROVAL",
    },
  });

  if (project.billingStage === "PENDING" || project.billingStage === "NONE") {
    await prisma.wnProject.update({
      where: { id: project.id },
      data: { billingStage: "APPROVAL_REQUIRED" },
    });
  }

  const filename = `${project.code}-approval-${year}-${String(month).padStart(2, "0")}.xlsx`;
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
