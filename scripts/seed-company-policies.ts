/**
 * Seed or refresh the default Employee & Corporate Policy Handbook.
 * Run: npx tsx scripts/seed-company-policies.ts
 */
import { prisma } from "../src/lib/prisma";
import { DEFAULT_COMPANY_POLICIES } from "../src/lib/default-company-policies";

async function main() {
  for (const policy of DEFAULT_COMPANY_POLICIES) {
    await prisma.companyPolicy.upsert({
      where: { id: policy.id },
      update: {
        title: policy.title,
        content: policy.content,
        sortOrder: policy.sortOrder,
        isActive: true,
      },
      create: {
        id: policy.id,
        title: policy.title,
        content: policy.content,
        sortOrder: policy.sortOrder,
      },
    });
    console.log(`✓ ${policy.title}`);
  }
  console.log(`\nSeeded ${DEFAULT_COMPANY_POLICIES.length} policy sections.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
