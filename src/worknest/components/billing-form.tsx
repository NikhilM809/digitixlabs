"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateInvoices } from "@/worknest/actions/billing";
import { BillingBadge, StatusBadge } from "@/worknest/components/status";
import { Button, Field, Input, Select } from "@/worknest/components/ui";
import { formatMoney } from "@/worknest/lib/format";
import type { WnProjectStatus } from "@prisma/client";

type Row = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  status: WnProjectStatus;
  actualCompletionDate: Date | string | null;
  sellValue: number;
  currencyCode: string;
  billingStatus: string;
  billed: boolean;
  approved: boolean;
  closed: boolean;
};

export function GenerateBillsForm({
  month,
  year,
  gstRate,
  rows,
  clients,
  services,
}: {
  month: number;
  year: number;
  gstRate: number;
  rows: Row[];
  clients: { id: string; name: string; legalName: string }[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const billable = useMemo(() => rows.filter((row) => row.approved && !row.billed), [rows]);
  const [checked, setChecked] = useState<string[]>(() => billable.map((row) => row.id));
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(billable.map((row) => [row.id, row.sellValue])),
  );
  const allChecked = billable.length > 0 && billable.every((row) => checked.includes(row.id));
  const selectedRows = billable.filter((row) => checked.includes(row.id));
  const openSelected = selectedRows.filter((row) => !row.closed);
  const subtotal = selectedRows.reduce((sum, row) => sum + (amounts[row.id] ?? row.sellValue), 0);
  const currency = selectedRows[0]?.currencyCode ?? billable[0]?.currencyCode ?? "";

  function toggle(id: string) {
    setChecked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function toggleAll() {
    setChecked(allChecked ? [] : billable.map((row) => row.id));
  }

  function onSubmit(formData: FormData) {
    if (openSelected.length) {
      const ok = window.confirm(
        `${openSelected.length} selected project(s) are not closed. You can still invoice them, but the work may not be finished. Continue?`,
      );
      if (!ok) return;
    }
    for (const id of checked) formData.append("projectIds", id);
    start(async () => {
      const result = await generateInvoices(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result?.openCount
          ? `Invoice ${result.invoiceNumber} created for ${result.count} project(s), including ${result.openCount} that are not closed.`
          : `Invoice ${result?.invoiceNumber} created for ${result?.count ?? 0} project(s).`,
      );
      setChecked([]);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4">
      <input type="hidden" name="billingMonth" value={month} />
      <input type="hidden" name="billingYear" value={year} />
      <p className="text-sm text-muted">
        Each line starts with the project&apos;s overall value. Selected projects become one client invoice PDF, like the
        monthly efforts bill.
      </p>
      {openSelected.length ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {openSelected.length} selected project(s) are not closed. You can invoice them, but please confirm they should
          be billed now.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Client name">
          <Select name="invoiceClientName" defaultValue={billable[0]?.clientName || clients[0]?.name || ""}>
            {clients.map((item) => (
              <option key={item.id} value={item.name}>
                {item.legalName ? `${item.name} · ${item.legalName}` : item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Services on invoice">
          <Select name="servicesDescription" defaultValue={services[0]?.name || ""}>
            {services.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice date">
          <Input name="invoiceDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Discount">
          <Input name="discount" type="number" min="0" step="0.01" defaultValue={0} />
        </Field>
        <Field label="GST rate (%)">
          <Input name="gstRate" type="number" min="0" step="0.01" defaultValue={gstRate} />
        </Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  disabled={!billable.length}
                  onChange={toggleAll}
                  aria-label="Select all projects ready to invoice"
                />
              </th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Overall amount</th>
              <th className="px-4 py-3 text-right">Invoice amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={checked.includes(row.id)}
                    disabled={!row.approved || row.billed}
                    onChange={() => toggle(row.id)}
                    aria-label={`Invoice ${row.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/worknest/projects/${row.id}`} className="font-medium hover:text-teal">
                    {row.name}
                  </Link>
                  <p className="text-xs text-muted">{row.code}</p>
                </td>
                <td className="px-4 py-3">{row.clientName}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={row.status} />
                    <BillingBadge status={row.billingStatus} />
                  </div>
                  {!row.closed ? <p className="mt-1 text-xs text-amber-700">Not closed</p> : null}
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(row.sellValue, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <Input
                    name={`amount_${row.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={amounts[row.id] ?? row.sellValue}
                    disabled={row.billed || !row.approved}
                    className="h-9 w-36 text-right"
                    onChange={(event) =>
                      setAmounts((current) => ({ ...current, [row.id]: Number(event.target.value) }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={pending || !checked.length}>
          {pending ? "Working..." : "Generate invoice"}
        </Button>
        <p className="text-sm text-muted">
          {checked.length
            ? `${checked.length} project(s) · overall ${formatMoney(subtotal, currency)}`
            : "Mark projects above, then select them here."}
        </p>
      </div>
    </form>
  );
}
