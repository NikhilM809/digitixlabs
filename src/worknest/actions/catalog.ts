"use server";

import { revalidatePath } from "next/cache";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { slugWorkTypeCode } from "@/worknest/lib/work-types";
import { assertRole, requireUser } from "@/worknest/lib/permissions";

function revalidateCatalog() {
  revalidatePath("/worknest/settings");
  revalidatePath("/worknest/projects");
  revalidatePath("/worknest/projects/new");
  revalidatePath("/worknest/hours");
  revalidatePath("/worknest/billing");
  revalidatePath("/worknest/reports");
}

export async function addClient(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (name.length < 2) return { error: "Client name is required." };
  const exists = await prisma.wnClient.findFirst({ where: { name } });
  if (exists) return { error: "That client already exists." };
  await prisma.wnClient.create({
    data: { name, legalName: legalName || name, address },
  });
  revalidateCatalog();
  return { ok: true };
}

export async function saveClient(id: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const active = formData.get("active") === "on";
  if (name.length < 2) return { error: "Client name is required." };
  await prisma.wnClient.update({
    where: { id },
    data: { name, legalName, address, active },
  });
  revalidateCatalog();
  return { ok: true };
}

export async function addInvoiceService(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Service name is required." };
  const exists = await prisma.wnInvoiceService.findFirst({ where: { name } });
  if (exists) return { error: "That service already exists." };
  await prisma.wnInvoiceService.create({ data: { name } });
  revalidateCatalog();
  return { ok: true };
}

export async function addWorkType(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other") || "other";
  if (name.length < 2) return { error: "Work type name is required." };
  let code = slugWorkTypeCode(name);
  const clash = await prisma.wnWorkTypeOption.findUnique({ where: { code } });
  if (clash) code = `${code}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const last = await prisma.wnWorkTypeOption.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.wnWorkTypeOption.create({
    data: { name, code, category, sortOrder: (last?.sortOrder ?? 0) + 10 },
  });
  revalidateCatalog();
  return { ok: true };
}
