"use server";

import { revalidatePath } from "next/cache";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { hoursByWorkType } from "@/worknest/lib/data";
import { ensureCatalog } from "@/worknest/lib/catalog";
import { notifyAdmins, notifyUsers } from "@/worknest/lib/notify";
import { ActionError, assertRole, requireUser } from "@/worknest/lib/permissions";
import { isInactiveStatus } from "@/worknest/lib/project-status";

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function addHours(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") || "") || null;
  const workType = String(formData.get("workType") ?? "").trim();
  const hours = Number(formData.get("hours"));
  const date = parseDate(String(formData.get("date") || ""));
  const notes = String(formData.get("notes") ?? "");

  if (!projectId) return { error: "Select a project." };
  if (!date) return { error: "Date is required." };
  await ensureCatalog();
  const workTypeOption = await prisma.wnWorkTypeOption.findFirst({
    where: { code: workType, active: true },
  });
  if (!workType || !workTypeOption) {
    return { error: "Select a work type." };
  }
  if (!hours || hours <= 0 || hours > 24) return { error: "Enter hours between 0 and 24." };

  const project = await prisma.wnProject.findUnique({
    where: { id: projectId },
    include: { assignments: true, timeEntries: { select: { hours: true, workType: true } } },
  });
  if (!project) return { error: "Project not found." };
  if (isInactiveStatus(project.status)) {
    return { error: "Hours cannot be logged on a closed or cancelled project." };
  }

  if (user.role === "EMPLOYEE") {
    const assigned = project.assignments.some((row) => row.employeeId === user.id);
    if (!assigned) return { error: "You can only log hours on assigned projects." };
  }

  const employeeId =
    user.role === "EMPLOYEE" ? user.id : String(formData.get("employeeId") || user.id);
  if (user.role !== "EMPLOYEE" && employeeId !== user.id) {
    const employee = await prisma.user.findFirst({
      where: { id: employeeId, role: "EMPLOYEE", status: "ACTIVE" },
    });
    if (!employee) return { error: "Select a valid employee." };
  }

  if (taskId) {
    const task = await prisma.wnTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) return { error: "Select a valid task." };
    if (user.role === "EMPLOYEE" && task.assignedEmployeeId && task.assignedEmployeeId !== user.id) {
      return { error: "You can only log hours on your tasks." };
    }
  }

  await prisma.wnTimeEntry.create({
    data: {
      projectId,
      taskId,
      employeeId,
      date,
      workType,
      hours,
      notes,
    },
  });

  const allHours = hoursByWorkType([...project.timeEntries, { hours, workType }]);
  if (allHours.total > project.estimatedHours && project.timeEntries.reduce((s, e) => s + e.hours, 0) <= project.estimatedHours) {
    await notifyUsers([project.managerId], {
      title: "Hours exceeded estimate",
      message: `${project.name} is now ${allHours.total - project.estimatedHours} hours over estimate.`,
      href: `/worknest/projects/${project.id}`,
    });
  }
  const initialHours = project.initialEstimatedHours > 0 ? project.initialEstimatedHours : project.estimatedHours;
  if (!project.changesAlertSent && initialHours > 0 && allHours.changes > initialHours * 0.2) {
    await prisma.wnProject.update({
      where: { id: project.id },
      data: { changesAlertSent: true },
    });
    await notifyAdmins({
      title: "Changes exceeded 20% of initial hours",
      message: `${project.name} (${project.code}) has ${allHours.changes} change hours versus ${initialHours} hours estimated at creation.`,
      href: `/worknest/projects/${project.id}`,
    });
  }

  revalidatePath("/worknest/dashboard");
  revalidatePath("/worknest/my-hours");
  revalidatePath("/worknest/hours");
  revalidatePath(`/worknest/projects/${projectId}`);
  return { ok: true };
}

export async function reviewHours(entryId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN", "MANAGER"]);
  const entry = await prisma.wnTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new ActionError("Entry not found.");
  await prisma.wnTimeEntry.update({
    where: { id: entryId },
    data: { status: "REVIEWED", reviewedById: user.id },
  });
  revalidatePath("/worknest/hours");
  revalidatePath(`/worknest/projects/${entry.projectId}`);
}
