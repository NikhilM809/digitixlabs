import "../scripts/load-env";
import { requireDatabaseUrl } from "../scripts/load-env";

requireDatabaseUrl();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { BUILT_IN_CURRENCIES } from "../src/worknest/lib/currency";
import { DEFAULT_INVOICE_SERVICES, DEFAULT_WORK_TYPES } from "../src/worknest/lib/catalog";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Worknest defaults...");

  await prisma.worknestSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Digitixlabs LLP",
      companyAddress: "Flat no - 101, Tower - 2, ACE Parkway, Sector - 150, Noida, UP - 201310",
      companyEmail: "billing@digitixlabs.com",
      companyPhone: "+91 20 0000 0000",
      panNumber: "AAXFD9269P",
      gstin: "09AAXFD9269P1Z0",
      lutNumber: "AD0904260343634",
      servicesDescription: "Survey Programming and Consulting",
      gstRate: 0,
      bankAccountName: "DIGITIXLABS LLP",
      bankName: "IDFC FIRST",
      bankAccountNumber: "51903202550",
      bankIfsc: "IDFB0020102",
      bankSwift: "IDFBINBBMUM",
      bankMicr: "110751003",
      bankBranch: "New Friends Colony Branch, Delhi",
      bankBranchCode: "20102",
      bankCountry: "India",
      billToName: "PUREPROFILE LIMITED",
      billToAddress: "(ACN 167 522 901)\n263 Riley Street\nSurry Hills NSW 2010",
      etaWarningDays: 7,
      invoicePrefix: "PP/DXL",
      currency: "INR",
      logoUrl: "/logo.png",
    },
  });

  if ((await prisma.wnCurrency.count()) === 0) {
    await prisma.wnCurrency.createMany({ data: [...BUILT_IN_CURRENCIES] });
  }

  if ((await prisma.wnWorkTypeOption.count()) === 0) {
    await prisma.wnWorkTypeOption.createMany({ data: [...DEFAULT_WORK_TYPES] });
  }

  if ((await prisma.wnInvoiceService.count()) === 0) {
    await prisma.wnInvoiceService.createMany({
      data: DEFAULT_INVOICE_SERVICES.map((name) => ({ name })),
    });
  }

  if ((await prisma.wnClient.count()) === 0) {
    await prisma.wnClient.createMany({
      data: [
        {
          name: "Pureprofile",
          legalName: "PUREPROFILE LIMITED",
          address: "(ACN 167 522 901)\n263 Riley Street\nSurry Hills NSW 2010",
        },
      ],
    });
  }

  console.log("Worknest defaults seeded.");
}

main()
  .catch((error) => {
    console.error("Worknest seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
