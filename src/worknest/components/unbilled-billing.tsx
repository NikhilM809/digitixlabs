"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markProjectsForBilling } from "@/worknest/actions/billing";
import { BillingBadge, StatusBadge } from "@/worknest/components/status";
import { Button } from "@/worknest/components/ui";
import { trackerWnProjectStatusLabel } from "@/worknest/lib/constants";
import { formatDate, formatHours, formatMoney } from "@/worknest/lib/format";
import type { WnProjectStatus } from "@prisma/client";

export type UnbilledRow = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  status: WnProjectStatus;
  managerName: string;
  currencyCode: string;
  sellValue: number;
  initialHours: number;
  changesHours: number;
  liveHours: number;
  totalHours: number;
  eta: Date | string;
  actualCompletionDate: Date | string | null;
  startDate: Date | string | null;
  createdAt: Date | string;
  description: string;
  closed: boolean;
  markedForBilling: boolean;
};

export function UnbilledBillingReport({
  month,
  year,
  rows,
}: {
  month: number;
  year: number;
  rows: UnbilledRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"hours" | "details">("hours");
  const [selected, setSelected] = useState<string[]>([]);
  const closedIds = useMemo(() => rows.filter((row) => row.closed).map((row) => row.id), [rows]);
  const selectedSet = new Set(selected);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function selectAll() {
    setSelected(allSelected ? [] : rows.map((row) => row.id));
  }

  function selectClosed() {
    setSelected(closedIds);
  }

  async function exportSelected() {
    const ids = selected.length ? selected : rows.map((row) => row.id);
    if (!ids.length) {
      toast.error("Nothing to export.");
      return;
    }
    const response = await fetch("/api/worknest/billing/efforts-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: ids, month, year }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not export the tracker.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    link.href = url;
    link.download = match?.[1] ?? "DigitiXLabs_Efforts_Tracker.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Efforts tracker exported. This does not create invoices.");
    router.refresh();
  }

  function markSelected() {
    if (!selected.length) {
      toast.error("Select the projects you want to bill.");
      return;
    }
    const open = rows.filter((row) => selected.includes(row.id) && !row.closed);
    if (open.length) {
      const ok = window.confirm(
        `${open.length} of the selected projects are not closed. You can still mark them for billing. Continue?`,
      );
      if (!ok) return;
    }
    const formData = new FormData();
    for (const id of selected) formData.append("projectIds", id);
    start(async () => {
      const result = await markProjectsForBilling(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const skipped = result?.skipped ?? 0;
      const openCount = result?.open ?? 0;
      toast.success(
        [
          `${result?.marked} project(s) marked for billing.`,
          openCount ? `${openCount} are not closed.` : "",
          skipped ? `${skipped} skipped (cancelled or already billed).` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      router.refresh();
    });
  }

  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const openSelected = selectedRows.filter((row) => !row.closed);
  const selectedAmount = selectedRows.reduce((sum, row) => sum + row.sellValue, 0);
  const selectedCurrency = selectedRows[0]?.currencyCode ?? rows[0]?.currencyCode ?? "";
  const totals = rows.reduce(
    (sum, row) => ({
      initial: sum.initial + row.initialHours,
      changes: sum.changes + row.changesHours,
      live: sum.live + row.liveHours,
      total: sum.total + row.totalHours,
    }),
    { initial: 0, changes: 0, live: 0, total: 0 },
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Unbilled projects</h2>
          <p className="mt-1 text-sm text-muted">
            Review hours here or in Excel, then pick what to bill. You can select any unbilled project; if it is not
            closed, you will get a warning first. Invoice amounts default to the overall project value.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={selectAll}>
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
          <Button type="button" variant="outline" onClick={selectClosed} disabled={!closedIds.length}>
            Select all closed
          </Button>
          <Button type="button" variant="outline" disabled={pending || !rows.length} onClick={() => void exportSelected()}>
            {selected.length ? `Export selected (${selected.length})` : "Export tracker"}
          </Button>
          <Button type="button" disabled={pending || !selected.length} onClick={markSelected}>
            {pending ? "Working..." : "Mark selected for billing"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${view === "hours" ? "bg-teal text-white" : "border border-line"}`}
          onClick={() => setView("hours")}
        >
          Hours report
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${view === "details" ? "bg-teal text-white" : "border border-line"}`}
          onClick={() => setView("details")}
        >
          Project billing details
        </button>
      </div>
      <p className="text-sm text-muted">
        {selected.length} selected · overall {formatMoney(selectedAmount, selectedCurrency)} ·{" "}
        {formatHours(totals.initial)} initial · {formatHours(totals.changes)} changes · {formatHours(totals.total)} total
        hours
      </p>
      {openSelected.length ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {openSelected.length} selected project(s) are not closed. You can still mark them for billing; you will be
          asked to confirm first.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No unbilled projects match these filters.</p>
      ) : view === "hours" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={selectAll} aria-label="Select all unbilled projects" />
                </th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Initial</th>
                <th className="px-4 py-3 text-right">Changes</th>
                <th className="px-4 py-3 text-right">Live</th>
                <th className="px-4 py-3 text-right">Total hours</th>
                <th className="px-4 py-3 text-right">Project value</th>
                <th className="px-4 py-3">ETA / closed</th>
                <th className="px-4 py-3">Billing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.name}`}
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
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right">{formatHours(row.initialHours)}</td>
                  <td className="px-4 py-3 text-right">{formatHours(row.changesHours)}</td>
                  <td className="px-4 py-3 text-right">{formatHours(row.liveHours)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatHours(row.totalHours)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.sellValue, row.currencyCode)}</td>
                  <td className="px-4 py-3">{formatDate(row.actualCompletionDate ?? row.eta)}</td>
                  <td className="px-4 py-3">
                    <BillingBadge status={row.markedForBilling ? "Approved" : "To be billed"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={selectAll} aria-label="Select all unbilled projects" />
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3 text-right">Total cost</th>
                <th className="px-4 py-3">Project receive date</th>
                <th className="px-4 py-3">Delivery date</th>
                <th className="px-4 py-3">Billed</th>
                <th className="px-4 py-3">Payment received</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">POC</th>
                <th className="px-4 py-3">Extra costs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">{trackerWnProjectStatusLabel(row.status)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/worknest/projects/${row.id}`} className="font-medium hover:text-teal">
                      {row.name} - {row.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.sellValue, row.currencyCode)}</td>
                  <td className="px-4 py-3">{formatDate(row.startDate ?? row.createdAt)}</td>
                  <td className="px-4 py-3">{formatDate(row.actualCompletionDate ?? row.eta)}</td>
                  <td className="px-4 py-3">No</td>
                  <td className="px-4 py-3">—</td>
                  <td className="max-w-xs truncate px-4 py-3" title={row.description}>
                    {row.description || "—"}
                  </td>
                  <td className="px-4 py-3">{row.managerName}</td>
                  <td className="px-4 py-3">{row.changesHours > 0 ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
