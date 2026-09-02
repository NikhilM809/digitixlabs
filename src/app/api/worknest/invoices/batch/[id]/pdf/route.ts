import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/worknest/lib/data";
import { findClientByName } from "@/worknest/lib/catalog";
import { readInvoicePdf } from "@/worknest/lib/invoice-files";
import { buildClientInvoicePdf } from "@/worknest/lib/invoice-pdf";
import { requireApiRole } from "@/worknest/lib/permissions";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authz = await requireApiRole("ADMIN");
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const batch = await prisma.wnInvoiceBatch.findUnique({
    where: { id },
    include: {
      invoices: { include: { project: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!batch) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const uploaded = await readInvoicePdf(batch.pdfPath);
  if (uploaded) {
    return new NextResponse(uploaded, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${batch.invoiceNumber.replaceAll("/", "-")}.pdf"`,
      },
    });
  }

  const settings = await getSettings();
  const client = await findClientByName(batch.clientName);
  const bytes = await buildClientInvoicePdf({
    companyName: settings.companyName,
    companyAddress: settings.companyAddress,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone,
    panNumber: settings.panNumber,
    tanNumber: settings.tanNumber,
    gstin: settings.gstin,
    lutNumber: settings.lutNumber,
    servicesDescription: batch.servicesDescription || settings.servicesDescription,
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
    invoiceNumber: batch.invoiceNumber,
    invoiceDate: batch.invoiceDate,
    billingMonth: batch.billingMonth,
    billingYear: batch.billingYear,
    clientName: batch.clientName,
    billToName: client?.legalName || settings.billToName,
    billToAddress: client?.address || settings.billToAddress,
    currency: batch.currencyCode,
    status: batch.status === "PAID" ? "Paid" : "Due",
    discount: batch.discount,
    gstRate: batch.gstRate,
    lines: batch.invoices.map((invoice) => ({
      code: invoice.project.code,
      name: invoice.project.name,
      amount: invoice.amount,
    })),
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${batch.invoiceNumber.replaceAll("/", "-")}.pdf"`,
    },
  });
}
