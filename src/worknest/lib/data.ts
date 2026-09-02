import { prisma } from "@/lib/prisma";
import { workTypeBucket } from "@/worknest/lib/work-types";

export async function nextProjectCode() {
  const latest = await prisma.wnProject.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const match = latest?.code.match(/(\d+)$/);
  const next = (match ? Number(match[1]) : 1000) + 1;
  return `DX-${next}`;
}

export async function nextInvoiceNumber(prefix: string) {
  const latest = await prisma.wnInvoice.findMany({ select: { invoiceNumber: true } });
  let max = 0;
  for (const row of latest) {
    const digits = Number(row.invoiceNumber.replace(/\D/g, ""));
    if (Number.isFinite(digits) && digits > max) max = digits;
  }
  return `${prefix}-${String(max + 1).padStart(5, "0")}`;
}

export function formatInvoiceNumber(prefix: string, sequence: number, year?: number) {
  if (year) return `${prefix.replace(/\/$/, "")}/${year}/${sequence}`;
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}

export function nextYearlyInvoiceSequence(invoiceNumbers: string[], year: number) {
  let max = 0;
  const pattern = new RegExp(`/${year}/(\\d+)$`);
  for (const invoiceNumber of invoiceNumbers) {
    const match = invoiceNumber.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export function maxInvoiceSequence(invoiceNumbers: string[]) {
  let max = 0;
  for (const invoiceNumber of invoiceNumbers) {
    const digits = Number(invoiceNumber.replace(/\D/g, ""));
    if (Number.isFinite(digits) && digits > max) max = digits;
  }
  return max;
}

export async function getSettings() {
  return prisma.worknestSetting.upsert({
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
      logoUrl: "/digitix-logo.png",
    },
  });
}

export function sumHours<T extends { hours: number }>(entries: T[]) {
  return entries.reduce((total, entry) => total + entry.hours, 0);
}

export function hoursByWorkType<T extends { hours: number; workType: string }>(entries: T[]) {
  let initial = 0;
  let changes = 0;
  let live = 0;
  let other = 0;
  for (const entry of entries) {
    const bucket = workTypeBucket(entry.workType);
    if (bucket === "initial") initial += entry.hours;
    else if (bucket === "changes") changes += entry.hours;
    else if (bucket === "live") live += entry.hours;
    else other += entry.hours;
  }
  return { initial, changes, live, other, total: initial + changes + live + other };
}

export function searchTokens(q: string) {
  return q
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function projectSearchWhere(q: string) {
  const tokens = searchTokens(q);
  if (!tokens.length) return {};
  return {
    OR: tokens.flatMap((token) => [
      { code: { contains: token } },
      { name: { contains: token } },
    ]),
  };
}
