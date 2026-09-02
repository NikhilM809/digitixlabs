"use server";

import { revalidatePath } from "next/cache";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { assertRole, requireUser } from "@/worknest/lib/permissions";

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export async function createCurrency(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const symbol = String(formData.get("symbol") ?? "").trim();
  if (!name || !code || !symbol) return { error: "Name, code, and symbol are required." };
  const exists = await prisma.wnCurrency.findUnique({ where: { code } });
  if (exists) return { error: "That currency code already exists." };
  const count = await prisma.wnCurrency.count();
  await prisma.wnCurrency.create({
    data: { name, code, symbol, active: true, isDefault: count === 0 },
  });
  revalidatePath("/worknest/settings");
  return { ok: true };
}

export async function updateCurrency(currencyId: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const symbol = String(formData.get("symbol") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name || !code || !symbol) return { error: "Name, code, and symbol are required." };
  const current = await prisma.wnCurrency.findUnique({ where: { id: currencyId } });
  if (!current) return { error: "Currency not found." };
  if (current.isDefault && !active) return { error: "The default currency cannot be deactivated." };
  const clash = await prisma.wnCurrency.findFirst({ where: { code, NOT: { id: currencyId } } });
  if (clash) return { error: "That currency code already exists." };
  await prisma.wnCurrency.update({
    where: { id: currencyId },
    data: { name, code, symbol, active },
  });
  revalidatePath("/worknest/settings");
  revalidatePath("/worknest/projects");
  return { ok: true };
}

export async function setDefaultCurrency(currencyId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const currency = await prisma.wnCurrency.findUnique({ where: { id: currencyId } });
  if (!currency) return { error: "Currency not found." };
  if (!currency.active) return { error: "Activate the currency before making it default." };
  await prisma.$transaction([
    prisma.wnCurrency.updateMany({ data: { isDefault: false } }),
    prisma.wnCurrency.update({ where: { id: currencyId }, data: { isDefault: true, active: true } }),
    prisma.worknestSetting.updateMany({ data: { currency: currency.code } }),
  ]);
  revalidatePath("/worknest/settings");
  return { ok: true };
}
