"use server";

import { revalidatePath } from "next/cache";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/worknest/lib/notify";
import { assertRole, requireUser } from "@/worknest/lib/permissions";

export async function addProjectNote(projectId: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN", "MANAGER"]);
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Write a note first." };
  const project = await prisma.wnProject.findUnique({
    where: { id: projectId },
    include: { assignments: true },
  });
  if (!project) return { error: "Project not found." };
  await prisma.wnProjectNote.create({
    data: { projectId, authorId: user.id, content },
  });
  await notifyUsers(
    project.assignments.map((row) => row.employeeId),
    {
      title: "New project note",
      message: `${user.name} added a note on ${project.name}.`,
      href: `/worknest/projects/${projectId}`,
    },
  );
  revalidatePath(`/worknest/projects/${projectId}`);
  return { ok: true };
}

export async function saveSettings(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const data = {
    companyName: String(formData.get("companyName") ?? "Digitix Labs"),
    companyAddress: String(formData.get("companyAddress") ?? ""),
    companyEmail: String(formData.get("companyEmail") ?? ""),
    companyPhone: String(formData.get("companyPhone") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    panNumber: String(formData.get("panNumber") ?? ""),
    tanNumber: String(formData.get("tanNumber") ?? ""),
    gstin: String(formData.get("gstin") ?? ""),
    lutNumber: String(formData.get("lutNumber") ?? ""),
    gstRate: Number(formData.get("gstRate") || 0),
    bankAccountName: String(formData.get("bankAccountName") ?? ""),
    bankName: String(formData.get("bankName") ?? ""),
    bankAccountNumber: String(formData.get("bankAccountNumber") ?? ""),
    bankIfsc: String(formData.get("bankIfsc") ?? ""),
    bankSwift: String(formData.get("bankSwift") ?? ""),
    bankMicr: String(formData.get("bankMicr") ?? ""),
    bankBranch: String(formData.get("bankBranch") ?? ""),
    bankBranchCode: String(formData.get("bankBranchCode") ?? ""),
    bankCountry: String(formData.get("bankCountry") ?? "India"),
    etaWarningDays: Number(formData.get("etaWarningDays") || 7),
    invoicePrefix: String(formData.get("invoicePrefix") ?? "PP/DXL"),
  };
  await prisma.worknestSetting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  revalidatePath("/worknest/settings");
  revalidatePath("/worknest/billing");
  return { ok: true };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.worknestNotification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  revalidatePath("/worknest/dashboard");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.worknestNotification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/worknest/dashboard");
}
