/**
 * Seed or refresh the default Employee & Corporate Policy Handbook.
 * Run: npm run db:seed-policies
 */
import "../scripts/load-env";
import { requireDatabaseUrl } from "../scripts/load-env";

requireDatabaseUrl();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { DEFAULT_COMPANY_POLICIES } from "../src/lib/default-company-policies";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
