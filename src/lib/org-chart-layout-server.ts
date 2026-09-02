import { prisma } from "@/lib/prisma";
import {
  orgChartLayoutSchema,
  parseOrgChartLayout,
  type OrgChartLayoutSettings,
} from "@/lib/org-chart-layout";

export async function getOrgChartLayout(): Promise<OrgChartLayoutSettings> {
  const settings = await prisma.companySettings.findFirst({
    select: { orgChartLayoutJson: true },
  });
  return parseOrgChartLayout(settings?.orgChartLayoutJson);
}

export async function saveOrgChartLayout(layout: OrgChartLayoutSettings) {
  const parsed = orgChartLayoutSchema.parse(layout);
  const payload = JSON.stringify(parsed);

  const existing = await prisma.companySettings.findFirst({ select: { id: true } });
  if (existing) {
    await prisma.companySettings.update({
      where: { id: existing.id },
      data: { orgChartLayoutJson: payload },
    });
  } else {
    await prisma.companySettings.create({
      data: { orgChartLayoutJson: payload },
    });
  }

  return parsed;
}
