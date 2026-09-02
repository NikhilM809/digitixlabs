"use server";

import { revalidatePath } from "next/cache";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { saveInvoicePdf } from "@/worknest/lib/invoice-files";
import { formatInvoiceNumber, getSettings, nextYearlyInvoiceSequence } from "@/worknest/lib/data";
import { getDefaultCurrency } from "@/worknest/lib/currency";
import { notifyAdmins } from "@/worknest/lib/notify";
import { ActionError, assertRole, requireUser } from "@/worknest/lib/permissions";

export async function approveForInvoice(projectId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const project = await prisma.wnProject.findUnique({
    where: { id: projectId },
    include: { invoices: true },
  });
  if (!project) return { error: "Project not found." };
  if (project.status === "CANCEL") return { error: "Cancelled projects cannot be billed." };
  if (project.invoices.length > 0) return { error: "This project already has an invoice." };
  await prisma.wnProject.update({
    where: { id: projectId },
    data: { billingStage: "APPROVED" },
  });
  revalidatePath("/worknest/billing");
  revalidatePath(`/worknest/projects/${projectId}`);
  return { ok: true, open: project.status !== "CLOSE" };
}

export async function markProjectsForBilling(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const projectIds = [...new Set(formData.getAll("projectIds").map(String).filter(Boolean))];
  if (!projectIds.length) return { error: "Select at least one project." };

  const projects = await prisma.wnProject.findMany({
    where: { id: { in: projectIds } },
    include: { invoices: true },
  });

  const ready = projects.filter((project) => project.status !== "CANCEL" && project.invoices.length === 0);
  if (!ready.length) {
    return { error: "None of the selected projects can be billed. Cancelled or already invoiced work was skipped." };
  }

  await prisma.wnProject.updateMany({
    where: { id: { in: ready.map((project) => project.id) } },
    data: { billingStage: "APPROVED" },
  });

  revalidatePath("/worknest/billing");
  revalidatePath("/worknest/closed");
  for (const project of ready) {
    revalidatePath(`/worknest/projects/${project.id}`);
  }
  const open = ready.filter((project) => project.status !== "CLOSE").length;
  return {
    ok: true,
    marked: ready.length,
    skipped: projectIds.length - ready.length,
    open,
  };
}

export async function generateInvoices(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const month = Number(formData.get("billingMonth"));
  const year = Number(formData.get("billingYear"));
  const invoiceDate = new Date(`${formData.get("invoiceDate")}T12:00:00`);
  const discount = Math.max(0, Number(formData.get("discount") || 0));
  const gstRate = Math.max(0, Number(formData.get("gstRate") || 0));
  const invoiceClientName = String(formData.get("invoiceClientName") || "").trim();
  const servicesDescription = String(formData.get("servicesDescription") || "").trim();
  const projectIds = [...new Set(formData.getAll("projectIds").map(String).filter(Boolean))];
  if (!month || !year) return { error: "Select a billing month." };
  if (!projectIds.length) return { error: "Select at least one project to invoice." };
  if (Number.isNaN(invoiceDate.getTime())) return { error: "Invoice date is required." };

  const settings = await getSettings();
  const fallback = await getDefaultCurrency();
  const projects = await prisma.wnProject.findMany({
    where: { id: { in: projectIds } },
    include: { currency: true, invoices: true },
  });
  if (projects.length !== projectIds.length) {
    return { error: "One or more selected projects were not found." };
  }

  const clients = new Set(projects.map((project) => project.clientName));
  if (clients.size > 1) {
    return { error: "Generate one invoice per client. Filter to a single client, then try again." };
  }
  const currencies = new Set(projects.map((project) => project.currency?.code ?? fallback.code));
  if (currencies.size > 1) {
    return { error: "Selected projects use more than one currency. Invoice them separately." };
  }

  const amounts = new Map<string, number>();
  const openNames: string[] = [];
  for (const project of projects) {
    if (project.status === "CANCEL") {
      return { error: `${project.name} is cancelled and cannot be invoiced.` };
    }
    if (project.billingStage !== "APPROVED") {
      return { error: `${project.name} must be marked for billing first.` };
    }
    if (project.invoices.length > 0) {
      return { error: `${project.name} already has an invoice.` };
    }
    const amountRaw = formData.get(`amount_${project.id}`);
    const amount = amountRaw === null || amountRaw === "" ? project.sellValue : Number(amountRaw);
    if (!amount || amount <= 0) return { error: `Enter a valid overall amount for ${project.name}.` };
    amounts.set(project.id, amount);
    if (project.status !== "CLOSE") openNames.push(project.name);
  }

  const currencyCode = projects[0].currency?.code ?? fallback.code;
  const currencySymbol = projects[0].currency?.symbol ?? fallback.symbol;
  let batchId = "";
  let invoiceNumber = "";

  try {
    await prisma.$transaction(async (tx) => {
      const existingBatches = await tx.wnInvoiceBatch.findMany({ select: { invoiceNumber: true } });
      const sequence = nextYearlyInvoiceSequence(
        existingBatches.map((row) => row.invoiceNumber),
        year,
      );
      invoiceNumber = formatInvoiceNumber(settings.invoicePrefix || "PP/DXL", sequence, year);
      const batch = await tx.wnInvoiceBatch.create({
        data: {
          invoiceNumber,
          clientName: invoiceClientName || projects[0].clientName,
          billingMonth: month,
          billingYear: year,
          invoiceDate,
          currencyCode,
          currencySymbol,
          discount,
          gstRate,
          status: "GENERATED",
          servicesDescription,
        },
      });
      batchId = batch.id;

      for (const [index, project] of projects.entries()) {
        const already = await tx.wnInvoice.findFirst({ where: { projectId: project.id } });
        if (already) {
          throw new ActionError(`${project.name} already has an invoice.`);
        }
        await tx.wnInvoice.create({
          data: {
            invoiceNumber: `${invoiceNumber}-${String(index + 1).padStart(2, "0")}`,
            projectId: project.id,
            batchId: batch.id,
            billingMonth: month,
            billingYear: year,
            invoiceDate,
            amount: amounts.get(project.id)!,
            currencyCode,
            currencySymbol,
            status: "GENERATED",
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not generate invoices. Please try again." };
  }

  await notifyAdmins({
    title: "Invoice generated",
    message: `${invoiceNumber} created for ${projects[0].clientName} (${projects.length} project${projects.length === 1 ? "" : "s"}).`,
    href: "/billing/history",
  });

  revalidatePath("/worknest/billing");
  revalidatePath("/worknest/billing/history");
  revalidatePath("/worknest/dashboard");
  revalidatePath("/worknest/closed");
  revalidatePath("/worknest/reports");
  for (const project of projects) {
    revalidatePath(`/worknest/projects/${project.id}`);
  }
  return {
    ok: true,
    count: projects.length,
    batchId,
    invoiceNumber,
    openCount: openNames.length,
  };
}

async function uniqueInvoiceNumber(invoiceNumber: string) {
  const [batch, invoice] = await Promise.all([
    prisma.wnInvoiceBatch.findUnique({ where: { invoiceNumber } }),
    prisma.wnInvoice.findUnique({ where: { invoiceNumber } }),
  ]);
  return !batch && !invoice;
}

export async function uploadHistoricalInvoice(formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const month = Number(formData.get("billingMonth"));
  const year = Number(formData.get("billingYear"));
  const invoiceDate = new Date(`${formData.get("invoiceDate")}T12:00:00`);
  const discount = Math.max(0, Number(formData.get("discount") || 0));
  const gstRate = Math.max(0, Number(formData.get("gstRate") || 0));
  const paid = formData.get("paid") === "on";
  const invoiceClientName = String(formData.get("invoiceClientName") || "").trim();
  const servicesDescription = String(formData.get("servicesDescription") || "").trim();
  const projectIds = [...new Set(formData.getAll("projectIds").map(String).filter(Boolean))];
  const file = formData.get("pdf") as File | null;

  if (!invoiceNumber) return { error: "Invoice number is required." };
  if (!month || !year) return { error: "Select the billing month." };
  if (Number.isNaN(invoiceDate.getTime())) return { error: "Invoice date is required." };
  if (!projectIds.length) return { error: "Select the projects that were on this invoice." };
  if (!(await uniqueInvoiceNumber(invoiceNumber))) {
    return { error: "That invoice number already exists." };
  }

  const fallback = await getDefaultCurrency();
  const projects = await prisma.wnProject.findMany({
    where: { id: { in: projectIds } },
    include: { currency: true, invoices: { include: { batch: true } } },
  });
  if (projects.length !== projectIds.length) {
    return { error: "One or more selected projects were not found." };
  }
  if (projects.some((project) => project.status === "CANCEL")) {
    return { error: "Cancelled projects cannot be billed." };
  }
  const clients = new Set(projects.map((project) => project.clientName));
  if (clients.size > 1) {
    return { error: "A historical invoice can only include one client." };
  }
  const currencies = new Set(projects.map((project) => project.currency?.code ?? fallback.code));
  if (currencies.size > 1) {
    return { error: "Selected projects use more than one currency." };
  }
  const alreadyBatched = projects.filter((project) => project.invoices.some((invoice) => invoice.batchId));
  if (alreadyBatched.length) {
    return {
      error: `${alreadyBatched[0].name} is already on another client invoice. Remove it from the selection.`,
    };
  }

  const batchId = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  const saved = file ? await saveInvoicePdf(batchId, file) : { error: "Choose a PDF invoice to upload." };
  if ("error" in saved) return { error: saved.error };

  const currencyCode = projects[0].currency?.code ?? fallback.code;
  const currencySymbol = projects[0].currency?.symbol ?? fallback.symbol;
  const status = paid ? "PAID" : "GENERATED";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.wnInvoiceBatch.create({
        data: {
          id: batchId,
          invoiceNumber,
          clientName: invoiceClientName || projects[0].clientName,
          billingMonth: month,
          billingYear: year,
          invoiceDate,
          currencyCode,
          currencySymbol,
          discount,
          gstRate,
          status,
          source: "UPLOADED",
          pdfPath: saved.path,
          servicesDescription,
        },
      });
      for (const [index, project] of projects.entries()) {
        if (project.invoices.length) {
          await tx.wnInvoice.updateMany({
            where: { id: { in: project.invoices.map((invoice) => invoice.id) } },
            data: { batchId, status },
          });
          continue;
        }
        const amountRaw = formData.get(`amount_${project.id}`);
        const amount = amountRaw === null || amountRaw === "" ? project.sellValue : Number(amountRaw);
        if (!amount || amount <= 0) {
          throw new ActionError(`Enter a valid overall amount for ${project.name}.`);
        }
        await tx.wnInvoice.create({
          data: {
            invoiceNumber: `${invoiceNumber}-${String(index + 1).padStart(2, "0")}`,
            projectId: project.id,
            batchId,
            billingMonth: month,
            billingYear: year,
            invoiceDate,
            amount,
            currencyCode,
            currencySymbol,
            status,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not save the historical invoice. Please try again." };
  }

  await notifyAdmins({
    title: "Historical invoice uploaded",
    message: `${invoiceNumber} recorded for ${projects[0].clientName} (${projects.length} project${projects.length === 1 ? "" : "s"}).`,
    href: "/billing/history",
  });
  revalidatePath("/worknest/billing");
  revalidatePath("/worknest/billing/history");
  revalidatePath("/worknest/dashboard");
  revalidatePath("/worknest/reports");
  for (const project of projects) revalidatePath(`/worknest/projects/${project.id}`);
  return { ok: true, invoiceNumber, count: projects.length };
}

export async function attachInvoicePdf(batchId: string, formData: FormData) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const file = formData.get("pdf") as File | null;
  if (!file) return { error: "Choose a PDF invoice to upload." };
  const batch = await prisma.wnInvoiceBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { error: "Invoice not found." };
  const saved = await saveInvoicePdf(batch.id, file);
  if ("error" in saved) return { error: saved.error };
  await prisma.wnInvoiceBatch.update({
    where: { id: batch.id },
    data: { pdfPath: saved.path, source: batch.source === "GENERATED" ? "GENERATED" : "UPLOADED" },
  });
  revalidatePath("/worknest/billing/history");
  return { ok: true };
}

export async function markInvoicePaid(invoiceId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const invoice = await prisma.wnInvoice.findUnique({
    where: { id: invoiceId },
    include: { project: true, batch: true },
  });
  if (!invoice) throw new ActionError("Invoice not found.");
  if (invoice.batchId) {
    await prisma.$transaction([
      prisma.wnInvoiceBatch.update({ where: { id: invoice.batchId }, data: { status: "PAID" } }),
      prisma.wnInvoice.updateMany({ where: { batchId: invoice.batchId }, data: { status: "PAID" } }),
    ]);
  } else {
    await prisma.wnInvoice.update({
      where: { id: invoiceId },
      data: { status: "PAID" },
    });
  }
  await notifyAdmins({
    title: "Bill marked as paid",
    message: `${invoice.batch?.invoiceNumber ?? invoice.invoiceNumber} for ${invoice.project.clientName} is paid.`,
    href: "/billing/history",
  });
  revalidatePath("/worknest/billing");
  revalidatePath("/worknest/billing/history");
  revalidatePath("/worknest/dashboard");
  revalidatePath(`/worknest/projects/${invoice.projectId}`);
}

export async function markBatchPaid(batchId: string) {
  const user = await requireUser();
  assertRole(user, ["ADMIN"]);
  const batch = await prisma.wnInvoiceBatch.findUnique({
    where: { id: batchId },
    include: { invoices: true },
  });
  if (!batch) throw new ActionError("Invoice not found.");
  await prisma.$transaction([
    prisma.wnInvoiceBatch.update({ where: { id: batchId }, data: { status: "PAID" } }),
    prisma.wnInvoice.updateMany({ where: { batchId }, data: { status: "PAID" } }),
  ]);
  await notifyAdmins({
    title: "Bill marked as paid",
    message: `${batch.invoiceNumber} for ${batch.clientName} is paid.`,
    href: "/billing/history",
  });
  revalidatePath("/worknest/billing");
  revalidatePath("/worknest/billing/history");
  revalidatePath("/worknest/dashboard");
  for (const invoice of batch.invoices) {
    revalidatePath(`/worknest/projects/${invoice.projectId}`);
  }
}
