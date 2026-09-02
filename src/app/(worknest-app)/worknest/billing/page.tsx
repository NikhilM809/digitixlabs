import Link from "next/link";
import { endOfMonth, startOfMonth } from "date-fns";
import { GenerateBillsForm } from "@/worknest/components/billing-form";
import { UnbilledBillingReport } from "@/worknest/components/unbilled-billing";
import { CurrencyTotals } from "@/worknest/components/currency-totals";
import { Card, Input, PageHeader, Select, StatCard } from "@/worknest/components/ui";
import { prisma } from "@/lib/prisma";
import { hoursByWorkType, getSettings, projectSearchWhere } from "@/worknest/lib/data";
import { ensureCurrencies } from "@/worknest/lib/currency";
import { getActiveClients, getActiveInvoiceServices } from "@/worknest/lib/catalog";
import { displayBillingStatus, totalsByCurrency } from "@/worknest/lib/finance";
import { formatHours, formatMonthYear } from "@/worknest/lib/format";
import { requireRole } from "@/worknest/lib/permissions";
import { userDisplayName } from "@/worknest/lib/user-adapter";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; client?: string; scope?: string; q?: string }>;
}) {
  await requireRole("ADMIN");
  await ensureCurrencies();
  const settings = await getSettings();
  const now = new Date();
  const params = await searchParams;
  const month = Number(params.month || now.getMonth() + 1);
  const year = Number(params.year || now.getFullYear());
  const client = String(params.client || "");
  const q = String(params.q || "").trim();
  const scope = params.scope === "month" ? "month" : "all";
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const unbilled = await prisma.wnProject.findMany({
    where: {
      status: { not: "CANCEL" },
      invoices: { none: {} },
      ...(client ? { clientName: client } : {}),
      AND: [
        ...(q ? [projectSearchWhere(q)] : []),
        ...(scope === "month"
          ? [
              {
                OR: [
                  { actualCompletionDate: { gte: monthStart, lte: monthEnd } },
                  { timeEntries: { some: { date: { gte: monthStart, lte: monthEnd } } } },
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      manager: true,
      currency: true,
      timeEntries: { select: { hours: true, workType: true } },
    },
    orderBy: [{ status: "asc" }, { eta: "asc" }],
  });

  const unbilledRows = unbilled.map((project) => {
    const hours = hoursByWorkType(project.timeEntries);
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      managerName: userDisplayName(project.manager),
      currencyCode: project.currency?.code ?? "",
      sellValue: project.sellValue,
      initialHours: hours.initial,
      changesHours: hours.changes,
      liveHours: hours.live,
      totalHours: hours.total,
      eta: project.eta,
      actualCompletionDate: project.actualCompletionDate,
      startDate: project.startDate,
      createdAt: project.createdAt,
      description: project.description,
      closed: project.status === "CLOSE",
      markedForBilling: project.billingStage === "APPROVED",
    };
  });

  const hourTotals = unbilledRows.reduce(
    (sum, row) => ({
      initial: sum.initial + row.initialHours,
      changes: sum.changes + row.changesHours,
      total: sum.total + row.totalHours,
    }),
    { initial: 0, changes: 0, total: 0 },
  );

  const ready = await prisma.wnProject.findMany({
    where: {
      status: { not: "CANCEL" },
      billingStage: "APPROVED",
      invoices: { none: {} },
      ...(client ? { clientName: client } : {}),
      ...projectSearchWhere(q),
    },
    include: { invoices: true, currency: true },
    orderBy: { actualCompletionDate: "desc" },
  });
  const readyRows = ready.map((project) => ({
    id: project.id,
    code: project.code,
    name: project.name,
    clientName: project.clientName,
    status: project.status,
    actualCompletionDate: project.actualCompletionDate,
    sellValue: project.sellValue,
    currencyCode: project.currency?.code ?? "",
    billingStatus: displayBillingStatus(project),
    billed: false,
    approved: true,
    closed: project.status === "CLOSE",
  }));

  const invoices = await prisma.wnInvoice.findMany({
    where: { billingMonth: month, billingYear: year },
  });
  const billedTotals = totalsByCurrency(invoices, (row) => row.amount);
  const paidTotals = totalsByCurrency(invoices.filter((row) => row.status === "PAID"), (row) => row.amount);
  const pendingTotals = totalsByCurrency(invoices.filter((row) => row.status === "GENERATED"), (row) => row.amount);
  const [catalogClients, invoiceServices] = await Promise.all([getActiveClients(), getActiveInvoiceServices()]);
  const clients = catalogClients.map((item) => item.name);
  const exports = await prisma.wnProjectExport.findMany({
    where: { billingMonth: month, billingYear: year, exportType: "EFFORTS_TRACKER" },
    include: { project: true, exportedBy: true },
    orderBy: { exportedAt: "desc" },
    take: 12,
  });

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Review unbilled work, then generate one client invoice. Amounts default to each project's overall value."
        actions={
          <Link href="/worknest/billing/history" className="text-sm text-teal">
            Billing history
          </Link>
        }
      />
      <form method="get" className="mb-4 grid gap-3 md:grid-cols-6">
        <Input name="q" placeholder="Project IDs, comma separated" defaultValue={q} />
        <Select name="month" defaultValue={String(month)}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {formatMonthYear(i + 1, year).split(" ")[0]}
            </option>
          ))}
        </Select>
        <Select name="year" defaultValue={String(year)}>
          {[year - 1, year, year + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select name="scope" defaultValue={scope}>
          <option value="all">All unbilled</option>
          <option value="month">Active in this month</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Run report</button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Unbilled projects" value={unbilledRows.length} />
        <StatCard label="Initial hours" value={formatHours(hourTotals.initial)} />
        <StatCard label="Changes hours" value={formatHours(hourTotals.changes)} />
        <StatCard label="Total hours" value={formatHours(hourTotals.total)} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <CurrencyTotals title="Billed this month" totals={billedTotals} />
        <CurrencyTotals title="Paid" totals={paidTotals} />
        <CurrencyTotals title="Pending payment" totals={pendingTotals} />
      </div>
      <Card className="p-6">
        <UnbilledBillingReport
          key={`${month}-${year}-${client}-${scope}-${q}`}
          month={month}
          year={year}
          rows={unbilledRows}
        />
      </Card>
      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-xl">Generate invoices · {formatMonthYear(month, year)}</h2>
        {readyRows.length === 0 ? (
          <p className="text-sm text-muted">
            Mark unbilled projects above. They will appear here so you can generate one client invoice. Amounts default
            to the overall project value.
          </p>
        ) : (
          <GenerateBillsForm
            key={readyRows.map((row) => row.id).join(",")}
            month={month}
            year={year}
            gstRate={settings.gstRate}
            rows={readyRows}
            clients={catalogClients}
            services={invoiceServices}
          />
        )}
      </Card>
      {exports.length > 0 ? (
        <Card className="mt-6 overflow-x-auto">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Tracker exports</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Exported by</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Period</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{row.project.name}</td>
                  <td className="px-5 py-3">{userDisplayName(row.exportedBy)}</td>
                  <td className="px-5 py-3">{row.exportedAt.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3">{formatMonthYear(row.billingMonth, row.billingYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
