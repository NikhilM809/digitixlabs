import { prisma } from "@/lib/prisma";

export const BUILT_IN_CURRENCIES = [
  { name: "Indian Rupee", code: "INR", symbol: "₹", isDefault: true },
  { name: "Australian Dollar", code: "AUD", symbol: "$", isDefault: false },
  { name: "US Dollar", code: "USD", symbol: "$", isDefault: false },
  { name: "British Pound", code: "GBP", symbol: "£", isDefault: false },
  { name: "Euro", code: "EUR", symbol: "€", isDefault: false },
] as const;

export async function ensureCurrencies() {
  const existing = await prisma.wnCurrency.findMany();
  if (existing.length === 0) {
    await prisma.wnCurrency.createMany({ data: [...BUILT_IN_CURRENCIES] });
  } else if (!existing.some((row) => row.isDefault)) {
    const inr = existing.find((row) => row.code === "INR") ?? existing[0];
    await prisma.wnCurrency.update({ where: { id: inr.id }, data: { isDefault: true } });
  }

  const fallback = await getDefaultCurrency();
  await prisma.wnProject.updateMany({
    where: { currencyId: null },
    data: { currencyId: fallback.id },
  });

  const closedUnbilled = await prisma.wnProject.findMany({
    where: { status: "CLOSE", billingStage: "NONE", invoices: { none: {} } },
    select: { id: true },
  });
  if (closedUnbilled.length) {
    await prisma.wnProject.updateMany({
      where: { id: { in: closedUnbilled.map((row) => row.id) } },
      data: { billingStage: "PENDING" },
    });
  }

  return prisma.wnCurrency.findMany({ orderBy: { code: "asc" } });
}

export async function getDefaultCurrency() {
  const found =
    (await prisma.wnCurrency.findFirst({ where: { isDefault: true } })) ??
    (await prisma.wnCurrency.findFirst({ where: { code: "INR" } })) ??
    (await prisma.wnCurrency.findFirst());
  if (found) return found;
  await prisma.wnCurrency.createMany({ data: [...BUILT_IN_CURRENCIES] });
  return prisma.wnCurrency.findFirstOrThrow({ where: { isDefault: true } });
}

export async function getActiveCurrencies() {
  await ensureCurrencies();
  return prisma.wnCurrency.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });
}

export async function getAllCurrencies() {
  await ensureCurrencies();
  return prisma.wnCurrency.findMany({ orderBy: [{ isDefault: "desc" }, { code: "asc" }] });
}

export function currencyCode(project: { currency?: { code: string } | null; currencyCode?: string | null }) {
  return project.currency?.code ?? project.currencyCode ?? "";
}
