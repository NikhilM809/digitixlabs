import { getQuarter } from "date-fns";
import { SimpleBarChart } from "@/worknest/components/chart";
import { CurrencyTotals } from "@/worknest/components/currency-totals";
import { Card, PageHeader, Select, StatCard } from "@/worknest/components/ui";
import { prisma } from "@/lib/prisma";
import { getAllCurrencies } from "@/worknest/lib/currency";
import { isCurrentOrPastPeriod, periodSortKey, remainingByCurrency, totalsByCurrency } from "@/worknest/lib/finance";
import { formatHours, formatMonthYear } from "@/worknest/lib/format";
import { requireRole } from "@/worknest/lib/permissions";
import { getActiveClients } from "@/worknest/lib/catalog";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; currency?: string; client?: string }>;
}) {
  await requireRole("ADMIN");
  const { view = "monthly", currency = "", client = "" } = await searchParams;
  const [currencies, clients] = await Promise.all([getAllCurrencies(), getActiveClients()]);
  const now = new Date();
  const projects = await prisma.wnProject.findMany({
    where: {
      status: { not: "CANCEL" },
      ...(currency ? { currency: { code: currency } } : {}),
      ...(client ? { clientName: client } : {}),
    },
    include: { currency: true, invoices: true },
  });
  const invoices = await prisma.wnInvoice.findMany({
    where: {
      ...(currency ? { currencyCode: currency } : {}),
      ...(client ? { project: { clientName: client } } : {}),
    },
  });
  const valueTotals = totalsByCurrency(projects, (row) => row.sellValue);
  const billedTotals = totalsByCurrency(invoices, (row) => row.amount);
  const paidTotals = totalsByCurrency(
    invoices.filter((row) => row.status === "PAID"),
    (row) => row.amount,
  );
  const pendingTotals = remainingByCurrency(valueTotals, billedTotals);

  const chartCode = currency || billedTotals[0]?.[0] || valueTotals[0]?.[0] || "";
  const chartInvoices = invoices.filter(
    (row) => row.currencyCode === chartCode && isCurrentOrPastPeriod(row.billingMonth, row.billingYear, now),
  );
  const buckets = new Map<string, { label: string; sort: number; value: number }>();
  for (const invoice of chartInvoices) {
    if (!isCurrentOrPastPeriod(invoice.billingMonth, invoice.billingYear, now)) continue;
    const date = new Date(invoice.billingYear, invoice.billingMonth - 1, 1);
    let label = `${invoice.billingYear}`;
    let sort = invoice.billingYear;
    if (view === "monthly") {
      label = `${date.toLocaleString("en-IN", { month: "short" })} ${invoice.billingYear}`;
      sort = periodSortKey(invoice.billingMonth, invoice.billingYear);
    }
    if (view === "quarterly") {
      label = `Q${getQuarter(date)} ${invoice.billingYear}`;
      sort = invoice.billingYear * 4 + getQuarter(date);
    }
    const current = buckets.get(label) ?? { label, sort, value: 0 };
    current.value += invoice.amount;
    buckets.set(label, current);
  }
  const chart = [...buckets.values()].sort((a, b) => a.sort - b.sort).map(({ label, value }) => ({ label, value }));
  const hours = await prisma.wnTimeEntry.aggregate({ _sum: { hours: true } });

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Billing through ${formatMonthYear(now.getMonth() + 1, now.getFullYear())}. Pending is project value minus billed. Amounts are never mixed across currencies.`}
      />
      <form className="mb-4 flex flex-wrap gap-3">
        <Select name="view" defaultValue={view}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </Select>
        <Select name="currency" defaultValue={currency}>
          <option value="">All currencies (separate totals)</option>
          {currencies.map((item) => (
            <option key={item.id} value={item.code}>
              {item.code}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Apply</button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CurrencyTotals title="Project value" totals={valueTotals} />
        <CurrencyTotals title="Billed" totals={billedTotals} />
        <CurrencyTotals title="Pending billing" totals={pendingTotals} />
        <CurrencyTotals title="Paid" totals={paidTotals} />
      </div>
      <Card className="p-6">
        <h2 className="mb-2 font-display text-xl">Billed amount ({chartCode || "no currency"})</h2>
        <p className="mb-4 text-sm text-muted">
          Only months through {formatMonthYear(now.getMonth() + 1, now.getFullYear())} are charted. Later delivery dates
          from imported tracker bills are left off this graph. Recorded hours: {formatHours(hours._sum.hours ?? 0)}
        </p>
        <SimpleBarChart data={chart} />
      </Card>
    </div>
  );
}
