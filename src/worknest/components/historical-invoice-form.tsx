"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { attachInvoicePdf, uploadHistoricalInvoice } from "@/worknest/actions/billing";
import { Button, Field, Input, Select } from "@/worknest/components/ui";
import { formatMoney, formatMonthYear } from "@/worknest/lib/format";
import type { WnProjectStatus } from "@prisma/client";

export type HistoricalProject = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  status: WnProjectStatus;
  sellValue: number;
  currencyCode: string;
  billed: boolean;
  batched: boolean;
};

export function HistoricalInvoiceUpload({
  gstRate,
  projects,
  clients: catalogClients,
  services,
}: {
  gstRate: number;
  projects: HistoricalProject[];
  clients: { id: string; name: string; legalName: string }[];
  services: { id: string; name: string }[];
}) {
  const routerRefresh = () => window.location.reload();
  const [pending, start] = useTransition();
  const clients = useMemo(
    () => [...new Set([...catalogClients.map((item) => item.name), ...projects.map((row) => row.clientName)])].sort(),
    [catalogClients, projects],
  );
  const [client, setClient] = useState(clients[0] ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = projects.filter((row) => row.clientName === client && !row.batched);
  const selectedRows = visible.filter((row) => selected.includes(row.id));
  const billedSelected = selectedRows.filter((row) => row.billed);
  const currency = selectedRows[0]?.currencyCode ?? visible[0]?.currencyCode ?? "";
  const subtotal = selectedRows.reduce((sum, row) => sum + row.sellValue, 0);
  const now = new Date();

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function onClientChange(next: string) {
    setClient(next);
    setSelected([]);
  }

  function onSubmit(formData: FormData) {
    for (const id of selected) formData.append("projectIds", id);
    start(async () => {
      const result = await uploadHistoricalInvoice(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Invoice ${result?.invoiceNumber} saved for ${result?.count ?? 0} project(s).`);
      setSelected([]);
      routerRefresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4">
      <p className="text-sm text-muted">
        Use this for invoices you already sent outside this system. Upload the PDF, pick the projects that were on it,
        and they will show as billed. Amounts default to each project&apos;s overall value.
      </p>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Invoice number">
          <Input name="invoiceNumber" required placeholder="PP/DXL/2026/5" />
        </Field>
        <Field label="Invoice date">
          <Input name="invoiceDate" type="date" required defaultValue={now.toISOString().slice(0, 10)} />
        </Field>
        <Field label="Billing month">
          <Select name="billingMonth" defaultValue={String(now.getMonth() + 1)}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {formatMonthYear(i + 1, now.getFullYear()).split(" ")[0]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Billing year">
          <Select name="billingYear" defaultValue={String(now.getFullYear())}>
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client">
          <Select name="invoiceClientName" value={client} onChange={(event) => onClientChange(event.target.value)}>
            {clients.map((name) => (
              <option key={name} value={name}>
                {name}
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
        <Field label="Discount">
          <Input name="discount" type="number" min="0" step="0.01" defaultValue={0} />
        </Field>
        <Field label="GST rate (%)">
          <Input name="gstRate" type="number" min="0" step="0.01" defaultValue={gstRate} />
        </Field>
        <Field label="Invoice PDF">
          <Input name="pdf" type="file" accept="application/pdf" required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="paid" />
        This invoice is already paid
      </label>
      {billedSelected.length ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {billedSelected.length} selected project(s) already have a bill in the system. They will be grouped onto this
          uploaded invoice instead of being billed twice.
        </p>
      ) : null}
      <div className="max-h-72 overflow-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={visible.length > 0 && visible.every((row) => selected.includes(row.id))}
                  onChange={() => setSelected(visible.every((row) => selected.includes(row.id)) ? [] : visible.map((row) => row.id))}
                  aria-label="Select all projects for this client"
                />
              </th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Billing</th>
              <th className="px-3 py-2 text-right">Overall amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-muted" colSpan={4}>
                  No projects left to attach for this client.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Include ${row.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted">{row.code}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{row.billed ? "Already billed" : "Unbilled"}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.sellValue, row.currencyCode)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={pending || !selected.length}>
          {pending ? "Saving..." : "Save historical invoice"}
        </Button>
        <p className="text-sm text-muted">
          {selected.length
            ? `${selected.length} project(s) · overall ${formatMoney(subtotal, currency)}`
            : "Select the projects that were on the uploaded invoice."}
        </p>
      </div>
    </form>
  );
}

export function AttachInvoicePdf({ batchId }: { batchId: string }) {
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await attachInvoicePdf(batchId, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("PDF attached.");
      window.location.reload();
    });
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      <input name="pdf" type="file" accept="application/pdf" required className="max-w-40 text-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Attach PDF"}
      </Button>
    </form>
  );
}
