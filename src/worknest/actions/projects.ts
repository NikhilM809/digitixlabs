"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WnProjectStatus } from "@prisma/client";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { splitEstimatedHours } from "@/worknest/lib/work-types";
import { nextProjectCode } from "@/worknest/lib/data";
import { getDefaultCurrency } from "@/worknest/lib/currency";
import { notifyAdmins, notifyManagersOfProject, notifyUsers } from "@/worknest/lib/notify";
import { ActionError, assertRole, requireUser } from "@/worknest/lib/permissions";
import { canSelectCancel, isInactiveStatus, statusesAvailable } from "@/worknest/lib/project-status";
import { PROJECT_STATUS_LABEL } from "@/worknest/lib/constants";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required."),
  code: z.string().trim().optional(),
  clientName: z.string().trim().min(2, "Client name is required."),
  description: z.string().optional(),
  managerId: z.string().min(1, "A project manager is required."),
  status: z.enum(["BID", "NEED_TO_START", "SCRIPT_WIP", "CHANGES", "LIVE", "HOLD", "CLOSE", "CANCEL"]),
  sellValue: z.coerce.number().min(0).optional(),
  estimatedHours: z.coerce.number().positive("Estimated hours are required."),
  startDate: z.string().optional(),
  eta: z.string().min(1, "ETA is required."),
  actualStartDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  selfAssignEnabled: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
  currencyId: z.string().optional(),
});

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formList(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function readHourSplit(formData: FormData, estimatedHours: number) {
  const auto = splitEstimatedHours(estimatedHours);
  const programmer = Number(formData.get("programmerHours"));
  const qa = Number(formData.get("qaHours"));
  const margin = Number(formData.get("marginHours"));
  return {
    programmerHours: Number.isFinite(programmer) && programmer >= 0 ? programmer : auto.programmer,
    qaHours: Number.isFinite(qa) && qa >= 0 ? qa : auto.qa,
    marginHours: Number.isFinite(margin) && margin >= 0 ? margin : auto.margin,
  };
}

function statusTransitionError(from: WnProjectStatus, to: WnProjectStatus) {
  if (to === "CANCEL" && !canSelectCancel(from)) {
    return "Cancelled is only available after initial bidding, while the project is still in Bid.";
  }
  if (!statusesAvailable(from).includes(to)) {
    return "That status change is not allowed.";
  }
  return null;
}

function statusPatch(from: WnProjectStatus, to: WnProjectStatus, userId: string, completion?: Date | null) {
  const now = new Date();
  const data: Record<string, unknown> = { status: to };
  if (to !== from) {
    data.statusChangedAt = now;
    data.statusChangedById = userId;
  }
  if (to === "CLOSE" && from !== "CLOSE") {
    data.actualCompletionDate = completion ?? now;
    data.billingStage = "PENDING";
  } else if (to === "CANCEL" && from !== "CANCEL") {
    data.actualCompletionDate = completion ?? now;
    data.billingStage = "NONE";
  } else if (!isInactiveStatus(to) && isInactiveStatus(from)) {
    data.actualCompletionDate = completion ?? null;
    data.billingStage = "NONE";
  } else if (completion !== undefined) {
    data.actualCompletionDate = completion;
  }
  return data;
}

async function recordStatusChange(
  projectId: string,
  from: WnProjectStatus,
  to: WnProjectStatus,
  userId: string,
  projectName: string,
) {
  if (from === to) return;
  await prisma.wnProjectStatusChange.create({
    data: { projectId, fromStatus: from, toStatus: to, changedById: userId },
  });
  await notifyManagersOfProject(projectId, {
    title: "Project status updated",
    message: `${projectName} moved to ${PROJECT_STATUS_LABEL[to]}.`,
    href: `/worknest/projects/${projectId}`,
  });
  if (to === "CLOSE") {
    await notifyAdmins({
      title: "Project closed",
      message: `${projectName} is closed and ready for billing.`,
      href: "/billing",
    });
  }
}

function revalidateProject(projectId: string) {
  revalidatePath(`/worknest/projects/${projectId}`);
  revalidatePath("/worknest/projects");
  revalidatePath("/worknest/closed");
  revalidatePath("/worknest/dashboard");
  revalidatePath("/worknest/my-projects");
}

export async function createProject(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    clientName: formData.get("clientName"),
    description: formData.get("description") ?? "",
    managerId: formData.get("managerId") || user.id,
    status: formData.get("status") || "BID",
    sellValue: formData.get("sellValue"),
    estimatedHours: formData.get("estimatedHours"),
    startDate: formData.get("startDate"),
    eta: formData.get("eta"),
    actualStartDate: formData.get("actualStartDate"),
    actualCompletionDate: formData.get("actualCompletionDate"),
    selfAssignEnabled: formData.get("selfAssignEnabled"),
    employeeIds: formList(formData, "employeeIds"),
    currencyId: formData.get("currencyId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  if (parsed.data.status === "CANCEL") {
    return { error: "Create the project in Bid first. Cancel is only for bids that do not go ahead." };
  }

  const eta = parseDate(parsed.data.eta);
  if (!eta) return { error: "A valid ETA is required." };

  const managerId = parsed.data.managerId;
  const manager = await prisma.user.findFirst({
    where: { id: managerId, role: { in: ["MANAGER", "ADMIN"] }, status: "ACTIVE" },
  });
  if (!manager) return { error: "Select a valid project manager." };

  const code = parsed.data.code?.trim() || (await nextProjectCode());
  const exists = await prisma.wnProject.findUnique({ where: { code } });
  if (exists) return { error: "That project ID is already in use." };

  const fallback = await getDefaultCurrency();
  const currencyId = parsed.data.currencyId || fallback.id;
  const currency = await prisma.wnCurrency.findFirst({
    where: { id: currencyId, active: true },
  });
  if (!currency) return { error: "Select a valid active currency." };
  if (parsed.data.sellValue === undefined || Number.isNaN(parsed.data.sellValue)) {
    return { error: "Project value is required." };
  }

  const sellValue = parsed.data.sellValue ?? 0;
  const split = readHourSplit(formData, parsed.data.estimatedHours);
  const now = new Date();
  const project = await prisma.wnProject.create({
    data: {
      code,
      name: parsed.data.name,
      clientName: parsed.data.clientName,
      description: parsed.data.description ?? "",
      managerId: manager.id,
      status: parsed.data.status,
      sellValue,
      initialSellValue: sellValue,
      programmerHours: split.programmerHours,
      qaHours: split.qaHours,
      marginHours: split.marginHours,
      initialEstimatedHours: parsed.data.estimatedHours,
      currencyId: currency.id,
      billingStage: parsed.data.status === "CLOSE" ? "PENDING" : "NONE",
      estimatedHours: parsed.data.estimatedHours,
      startDate: parseDate(parsed.data.startDate),
      eta,
      actualStartDate: parseDate(parsed.data.actualStartDate),
      actualCompletionDate: parseDate(parsed.data.actualCompletionDate),
      selfAssignEnabled: parsed.data.selfAssignEnabled === "on",
      statusChangedAt: now,
      statusChangedById: user.id,
    },
  });

  const employeeIds = parsed.data.employeeIds ?? [];
  if (employeeIds.length) {
    await prisma.wnProjectAssignment.createMany({
      data: employeeIds.map((employeeId) => ({
        projectId: project.id,
        employeeId,
        assignedById: user.id,
      })),
    });
    await notifyUsers(employeeIds, {
      title: "Assigned to a project",
      message: `You were assigned to ${project.name}.`,
      href: "/my-projects",
    });
  }

  revalidatePath("/worknest/projects");
  revalidatePath("/worknest/dashboard");
  redirect(`/worknest/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.wnProject.findUnique({ where: { id: projectId } });
  if (!existing) return { error: "Project not found." };

  if (user.role === "EMPLOYEE") {
    return { error: "Employees cannot edit projects. Use the status control to update status." };
  }

  const nextStatus = String(formData.get("status") || existing.status) as WnProjectStatus;
  const invalid = statusTransitionError(existing.status, nextStatus);
  if (invalid) return { error: invalid };

  const eta = parseDate(String(formData.get("eta") || "")) ?? existing.eta;
  const estimatedHours = Number(formData.get("estimatedHours") || existing.estimatedHours);
  if (!eta) return { error: "ETA is required." };
  if (!estimatedHours || estimatedHours <= 0) return { error: "Estimated hours are required." };

  const managerId = String(formData.get("managerId") || existing.managerId);
  if (!managerId) return { error: "A project manager is required." };

  const completion = parseDate(String(formData.get("actualCompletionDate") || ""));
  const data: Record<string, unknown> = {
    ...statusPatch(existing.status, nextStatus, user.id, completion),
    eta,
    estimatedHours,
    managerId,
    description: String(formData.get("description") ?? existing.description),
    selfAssignEnabled: formData.get("selfAssignEnabled") === "on",
    startDate: parseDate(String(formData.get("startDate") || "")) ?? existing.startDate,
    actualStartDate: parseDate(String(formData.get("actualStartDate") || "")) ?? existing.actualStartDate,
  };

  const name = String(formData.get("name") || existing.name).trim();
  const clientName = String(formData.get("clientName") || existing.clientName).trim();
  if (!name || !clientName) return { error: "Name and client are required." };
  data.name = name;
  data.clientName = clientName;

  if (user.role === "ADMIN") {
    const sellValue = Number(formData.get("sellValue") ?? existing.sellValue);
    data.sellValue = sellValue;
    const split = readHourSplit(formData, estimatedHours);
    data.programmerHours = split.programmerHours;
    data.qaHours = split.qaHours;
    data.marginHours = split.marginHours;
    const baselineValue = existing.initialSellValue > 0 ? existing.initialSellValue : existing.sellValue;
    if (existing.initialSellValue <= 0) data.initialSellValue = existing.sellValue;
    if (existing.initialEstimatedHours <= 0) data.initialEstimatedHours = existing.estimatedHours;
    const currencyId = String(formData.get("currencyId") || existing.currencyId || "");
    if (currencyId) {
      const currency = await prisma.wnCurrency.findFirst({ where: { id: currencyId, active: true } });
      if (!currency) return { error: "Select a valid active currency." };
      data.currencyId = currency.id;
    }
    const code = String(formData.get("code") || existing.code).trim();
    if (code !== existing.code) {
      const clash = await prisma.wnProject.findUnique({ where: { code } });
      if (clash) return { error: "That project ID is already in use." };
      data.code = code;
    }
    if (!existing.valueAlertSent && baselineValue > 0 && Math.abs(sellValue - baselineValue) / baselineValue > 0.2) {
      data.valueAlertSent = true;
      await notifyAdmins({
        title: "Project cost changed more than 20%",
        message: `${existing.name} (${existing.code}) is now ${sellValue} versus the initial ${baselineValue}.`,
        href: `/worknest/projects/${projectId}`,
      });
    }
  } else {
    data.managerId = existing.managerId;
  }

  await prisma.wnProject.update({ where: { id: projectId }, data });
  await recordStatusChange(projectId, existing.status, nextStatus, user.id, existing.name);

  const employeeIds = formList(formData, "employeeIds");
  if (user.role === "ADMIN" || user.role === "MANAGER") {
    const current = await prisma.wnProjectAssignment.findMany({ where: { projectId } });
    const currentIds = current.map((row) => row.employeeId);
    const toAdd = employeeIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !employeeIds.includes(id));
    if (toAdd.length) {
      await prisma.wnProjectAssignment.createMany({
        data: toAdd.map((employeeId) => ({
          projectId,
          employeeId,
          assignedById: user.id,
        })),
      });
      await notifyUsers(toAdd, {
        title: "Assigned to a project",
        message: `You were assigned to ${existing.name}.`,
        href: "/my-projects",
      });
    }
    if (toRemove.length) {
      await prisma.wnProjectAssignment.deleteMany({
        where: { projectId, employeeId: { in: toRemove } },
      });
    }
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function updateWnProjectStatus(projectId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.wnProject.findUnique({
    where: { id: projectId },
    include: { assignments: { select: { employeeId: true } } },
  });
  if (!existing) return { error: "Project not found." };

  if (user.role === "EMPLOYEE") {
    const assigned = existing.assignments.some((row) => row.employeeId === user.id);
    if (!assigned) return { error: "You can only update status on projects assigned to you." };
  }

  const nextStatus = String(formData.get("status") || existing.status) as WnProjectStatus;
  const invalid = statusTransitionError(existing.status, nextStatus);
  if (invalid) return { error: invalid };

  await prisma.wnProject.update({
    where: { id: projectId },
    data: statusPatch(existing.status, nextStatus, user.id),
  });
  await recordStatusChange(projectId, existing.status, nextStatus, user.id, existing.name);
  revalidateProject(projectId);
  return { ok: true };
}

export async function closeProject(projectId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN", "MANAGER"]);
  const project = await prisma.wnProject.findUnique({ where: { id: projectId } });
  if (!project) throw new ActionError("Project not found.");
  const invalid = statusTransitionError(project.status, "CLOSE");
  if (invalid) throw new ActionError(invalid);
  await prisma.wnProject.update({
    where: { id: projectId },
    data: statusPatch(project.status, "CLOSE", user.id),
  });
  await recordStatusChange(projectId, project.status, "CLOSE", user.id, project.name);
  revalidateProject(projectId);
}

export async function reopenProject(projectId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const project = await prisma.wnProject.findUnique({ where: { id: projectId } });
  if (!project) throw new ActionError("Project not found.");
  await prisma.wnProject.update({
    where: { id: projectId },
    data: statusPatch(project.status, "LIVE", user.id, null),
  });
  await recordStatusChange(projectId, project.status, "LIVE", user.id, project.name);
  revalidateProject(projectId);
}

export async function deleteProject(projectId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const project = await prisma.wnProject.findUnique({ where: { id: projectId } });
  if (!project) throw new ActionError("Project not found.");
  await prisma.wnProject.delete({ where: { id: projectId } });
  revalidatePath("/worknest/projects");
  revalidatePath("/worknest/closed");
  revalidatePath("/worknest/dashboard");
  revalidatePath("/worknest/billing");
  redirect("/worknest/projects");
}
