import { prisma } from "@/lib/prisma";

export async function getDependentDetailsEnabled() {
  const settings = await prisma.companySettings.findFirst({
    select: { dependentDetailsEnabled: true },
  });
  return settings?.dependentDetailsEnabled ?? false;
}
