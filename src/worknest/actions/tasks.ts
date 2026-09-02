"use server";

import { revalidatePath } from "next/cache";
import { WnTaskStatus } from "@prisma/client";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/worknest/lib/notify";
import { ActionError, assertRole, requireUser } from "@/worknest/lib/permissions";
import { isInactiveStatus } from "@/worknest/lib/project-status";

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureAssignment(projectId: string, employeeId: string, assignedById: string) {
  await prisma.wnProjectAssignment.upsert({
    where: { projectId_employeeId: { projectId, employeeId } },
    update: {},
    create: { projectId, employeeId, assignedById },
  });
}

export async function createTask(projectId: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN", "MANAGER"]);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Task name is required." };

  const assignedEmployeeId = String(formData.get("assignedEmployeeId") || "") || null;
  const task = await prisma.wnTask.create({
    data: {
      projectId,
      name,
      description: String(formData.get("description") ?? ""),
      assignedEmployeeId,
      assignedById: assignedEmployeeId ? user.id : null,
      assignedAt: assignedEmployeeId ? new Date() : null,
      estimatedHours: Number(formData.get("estimatedHours") || 0),
      startDate: parseDate(String(formData.get("startDate") || "")),
      dueDate: parseDate(String(formData.get("dueDate") || "")),
      status: (String(formData.get("status") || "NOT_STARTED") as WnTaskStatus) || "NOT_STARTED",
      notes: String(formData.get("notes") ?? ""),
      selfAssignEnabled: formData.get("selfAssignEnabled") === "on",
    },
  });

  if (assignedEmployeeId) {
    await ensureAssignment(projectId, assignedEmployeeId, user.id);
    const project = await prisma.wnProject.findUnique({ where: { id: projectId } });
    await notifyUsers([assignedEmployeeId], {
      title: "Task assigned",
      message: `${task.name} on ${project?.name ?? "a project"}.`,
      href: "/my-tasks",
    });
  }

  revalidatePath(`/worknest/projects/${projectId}`);
  revalidatePath("/worknest/my-tasks");
  return { ok: true };
}

export async function updateTask(taskId: string, formData: FormData) {
  const user = await requireUser();
  const task = await prisma.wnTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return { error: "Task not found." };

  if (user.role === "EMPLOYEE") {
    if (task.assignedEmployeeId !== user.id) {
      return { error: "You can only update your own tasks." };
    }
    const status = String(formData.get("status") || task.status) as WnTaskStatus;
    const notes = String(formData.get("notes") ?? task.notes);
    await prisma.wnTask.update({
      where: { id: taskId },
      data: { status, notes },
    });
    if (status === "COMPLETED" && task.status !== "COMPLETED") {
      await notifyUsers([task.project.managerId], {
        title: "Task completed",
        message: `${user.name} completed ${task.name} on ${task.project.name}.`,
        href: `/worknest/projects/${task.projectId}`,
      });
    }
    revalidatePath(`/worknest/projects/${task.projectId}`);
    revalidatePath("/worknest/my-tasks");
    return { ok: true };
  }

  assertRole(user, ["ADMIN", "MANAGER"]);
  const assignedEmployeeId = String(formData.get("assignedEmployeeId") || "") || null;
  const previousAssignee = task.assignedEmployeeId;
  await prisma.wnTask.update({
    where: { id: taskId },
    data: {
      name: String(formData.get("name") || task.name).trim(),
      description: String(formData.get("description") ?? task.description),
      assignedEmployeeId,
      assignedById: assignedEmployeeId ? user.id : task.assignedById,
      assignedAt: assignedEmployeeId ? new Date() : null,
      estimatedHours: Number(formData.get("estimatedHours") || task.estimatedHours),
      startDate: parseDate(String(formData.get("startDate") || "")),
      dueDate: parseDate(String(formData.get("dueDate") || "")),
      status: String(formData.get("status") || task.status) as WnTaskStatus,
      notes: String(formData.get("notes") ?? task.notes),
      selfAssignEnabled: formData.get("selfAssignEnabled") === "on",
    },
  });

  if (assignedEmployeeId && assignedEmployeeId !== previousAssignee) {
    await ensureAssignment(task.projectId, assignedEmployeeId, user.id);
    await notifyUsers([assignedEmployeeId], {
      title: previousAssignee ? "Task reassigned" : "Task assigned",
      message: `${task.name} on ${task.project.name}.`,
      href: "/my-tasks",
    });
    if (previousAssignee) {
      await notifyUsers([previousAssignee], {
        title: "Assignment changed",
        message: `${task.name} was reassigned.`,
        href: "/my-tasks",
      });
    }
  }

  revalidatePath(`/worknest/projects/${task.projectId}`);
  revalidatePath("/worknest/my-tasks");
  return { ok: true };
}

export async function selfAssignTask(taskId: string) {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") {
    throw new ActionError("Only employees can self-assign tasks.");
  }
  const task = await prisma.wnTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) throw new ActionError("Task not found.");
  if (isInactiveStatus(task.project.status)) {
    throw new ActionError("This project is closed or cancelled.");
  }
  if (task.assignedEmployeeId) throw new ActionError("This task is already assigned.");
  if (!task.project.selfAssignEnabled && !task.selfAssignEnabled) {
    throw new ActionError("Self-assignment is not enabled.");
  }

  await ensureAssignment(task.projectId, user.id, user.id);
  await prisma.wnTask.update({
    where: { id: taskId },
    data: {
      assignedEmployeeId: user.id,
      assignedById: user.id,
      assignedAt: new Date(),
      status: task.status === "NOT_STARTED" ? "IN_PROGRESS" : task.status,
    },
  });
  await notifyUsers([task.project.managerId], {
    title: "Task self-assigned",
    message: `${user.name} picked up ${task.name} on ${task.project.name}.`,
    href: `/worknest/projects/${task.projectId}`,
  });
  revalidatePath(`/worknest/projects/${task.projectId}`);
  revalidatePath("/worknest/my-tasks");
  revalidatePath("/worknest/my-projects");
}
