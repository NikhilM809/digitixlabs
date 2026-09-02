import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/worknest/lib/data";
import { findClientByName } from "@/worknest/lib/catalog";
import { buildInvoicePdf } from "@/worknest/lib/invoice-pdf";
import { requireApiRole } from "@/worknest/lib/permissions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireApiRole("ADMIN");
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const invoice = await prisma.wnInvoice.findUnique({
    where: { id },
    include: { project: { include: { currency: true } }, batch: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  if (invoice.batchId) {
    return NextResponse.redirect(new URL(`/api/worknest/invoices/batch/${invoice.batchId}/pdf`, _request.url));
  }
  const settings = await getSettings();
  const client = await findClientByName(invoice.batch?.clientName || invoice.project.clientName);
  const currency = invoice.currencyCode || invoice.project.currency?.code;
  if (!currency) {
    return NextResponse.json({ error: "This invoice has no currency assigned." }, { status: 400 });
  }
  const bytes = await buildInvoicePdf({
    companyName: settings.companyName,
    companyAddress: settings.companyAddress,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone,
    panNumber: settings.panNumber,
    tanNumber: settings.tanNumber,
    gstin: settings.gstin,
    lutNumber: settings.lutNumber,
    servicesDescription: invoice.batch?.servicesDescription || settings.servicesDescription,
    bankAccountName: settings.bankAccountName,
    bankName: settings.bankName,
    bankAccountNumber: settings.bankAccountNumber,
    bankIfsc: settings.bankIfsc,
    bankSwift: settings.bankSwift,
    bankMicr: settings.bankMicr,
    bankBranch: settings.bankBranch,
    bankBranchCode: settings.bankBranchCode,
    bankCountry: settings.bankCountry,
    logoUrl: settings.logoUrl,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    billingMonth: invoice.billingMonth,
    billingYear: invoice.billingYear,
    clientName: invoice.project.clientName,
    billToName: client?.legalName || settings.billToName,
    billToAddress: client?.address || settings.billToAddress,
    projectName: invoice.project.name,
    projectCode: invoice.project.code,
    description: invoice.project.description,
    amount: invoice.amount,
    currency,
    currencySymbol: invoice.currencySymbol || invoice.project.currency?.symbol || "",
    status: invoice.status === "PAID" ? "Paid" : "Due",
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
