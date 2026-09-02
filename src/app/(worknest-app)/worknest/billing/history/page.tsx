import { markBatchPaid, markInvoicePaid } from "@/worknest/actions/billing";
import { AttachInvoicePdf, HistoricalInvoiceUpload } from "@/worknest/components/historical-invoice-form";
import { BillingBadge } from "@/worknest/components/status";
import { ConfirmForm } from "@/worknest/components/confirm-form";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/worknest/components/ui";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/worknest/lib/data";
import { getActiveClients, getActiveInvoiceServices } from "@/worknest/lib/catalog";
import { formatDate, formatMoney, formatMonthYear } from "@/worknest/lib/format";
import { requireRole } from "@/worknest/lib/permissions";

export default async function BillingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; client?: string; month?: string; year?: string }>;
}) {
  await requireRole("ADMIN");
  const { q = "", status = "", client = "", month = "", year = "" } = await searchParams;
  const settings = await getSettings();
  const [catalogClients, invoiceServices] = await Promise.all([getActiveClients(), getActiveInvoiceServices()]);
  const batches = await prisma.wnInvoiceBatch.findMany({
    where: {
      ...(status ? { status: status as "PAID" } : {}),
      ...(month ? { billingMonth: Number(month) } : {}),
      ...(year ? { billingYear: Number(year) } : {}),
      ...(client ? { clientName: client } : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q } },
              { clientName: { contains: q } },
              { invoices: { some: { project: { name: { contains: q } } } } },
            ],
          }
        : {}),
    },
    include: { invoices: { include: { project: true } } },
    orderBy: { invoiceDate: "desc" },
  });
  const loose = await prisma.wnInvoice.findMany({
    where: {
      batchId: null,
      ...(status ? { status: status as "PAID" } : {}),
      ...(month ? { billingMonth: Number(month) } : {}),
      ...(year ? { billingYear: Number(year) } : {}),
      ...(client ? { project: { clientName: client } } : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q } },
              { project: { name: { contains: q } } },
              { project: { clientName: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { project: true },
    orderBy: { invoiceDate: "desc" },
  });
  const clients = catalogClients.map((item) => item.name);
  const uploadProjects = await prisma.wnProject.findMany({
    where: { status: { not: "CANCEL" } },
    include: { currency: true, invoices: { select: { batchId: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Billing history" description="Each client invoice lists every billed project and the overall amount due." />
      <Card className="mb-6 p-6">
        <h2 className="mb-1 font-display text-xl">Upload a historical invoice</h2>
        <HistoricalInvoiceUpload
          gstRate={settings.gstRate}
          clients={catalogClients}
          services={invoiceServices}
          projects={uploadProjects.map((project) => ({
            id: project.id,
            code: project.code,
            name: project.name,
            clientName: project.clientName,
            status: project.status,
            sellValue: project.sellValue,
            currencyCode: project.currency?.code ?? "",
            billed: project.invoices.length > 0,
            batched: project.invoices.some((invoice) => invoice.batchId),
          }))}
        />
      </Card>
      <form className="mb-4 grid gap-3 md:grid-cols-6">
        <Input name="q" placeholder="Invoice, project, client" defaultValue={q} />
        <Select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="GENERATED">Generated</option>
          <option value="PAID">Paid</option>
        </Select>
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select name="month" defaultValue={month}>
          <option value="">Any month</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {formatMonthYear(i + 1, 2026).split(" ")[0]}
            </option>
          ))}
        </Select>
        <Select name="year" defaultValue={year}>
          <option value="">Any year</option>
          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <Card className="overflow-x-auto">
        {batches.length === 0 && loose.length === 0 ? (
          <EmptyState title="No bills yet" description="Generate bills from the Billing page or upload a past invoice above." />
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Projects</th>
                <th className="px-5 py-3">Invoice date</th>
                <th className="px-5 py-3 text-right">Amount due</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const subtotal = batch.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
                const taxable = Math.max(0, subtotal - batch.discount);
                const due = taxable + taxable * (batch.gstRate / 100);
                return (
                  <tr key={batch.id} className="border-t border-line">
                    <td className="px-5 py-3 font-medium">
                      {batch.invoiceNumber}
                      {batch.source === "UPLOADED" ? (
                        <p className="text-xs text-muted">Uploaded PDF</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">{formatMonthYear(batch.billingMonth, batch.billingYear)}</td>
                    <td className="px-5 py-3">{batch.clientName}</td>
                    <td className="px-5 py-3">{batch.invoices.length}</td>
                    <td className="px-5 py-3">{formatDate(batch.invoiceDate)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(due, batch.currencyCode)}</td>
                    <td className="px-5 py-3">
                      <BillingBadge status={batch.status === "PAID" ? "Paid" : "Invoice Generated"} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex gap-2">
                          <a href={`/api/worknest/invoices/batch/${batch.id}/pdf`} className="text-sm text-teal">
                            PDF
                          </a>
                          {batch.status !== "PAID" ? (
                            <ConfirmForm message="Mark this invoice as paid?" action={markBatchPaid.bind(null, batch.id)}>
                              <Button size="sm" variant="outline">
                                Mark paid
                              </Button>
                            </ConfirmForm>
                          ) : null}
                        </div>
                        {!batch.pdfPath ? <AttachInvoicePdf batchId={batch.id} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loose.map((invoice) => (
                <tr key={invoice.id} className="border-t border-line">
                  <td className="px-5 py-3 font-medium">{invoice.invoiceNumber}</td>
                  <td className="px-5 py-3">{formatMonthYear(invoice.billingMonth, invoice.billingYear)}</td>
                  <td className="px-5 py-3">{invoice.project.clientName}</td>
                  <td className="px-5 py-3">{invoice.project.name}</td>
                  <td className="px-5 py-3">{formatDate(invoice.invoiceDate)}</td>
                  <td className="px-5 py-3 text-right">{formatMoney(invoice.amount, invoice.currencyCode)}</td>
                  <td className="px-5 py-3">
                    <BillingBadge status={invoice.status === "PAID" ? "Paid" : "Invoice Generated"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <a href={`/api/worknest/invoices/${invoice.id}/pdf`} className="text-sm text-teal">
                        PDF
                      </a>
                      {invoice.status !== "PAID" ? (
                        <ConfirmForm message="Mark this bill as paid?" action={markInvoicePaid.bind(null, invoice.id)}>
                          <Button size="sm" variant="outline">
                            Mark paid
                          </Button>
                        </ConfirmForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
