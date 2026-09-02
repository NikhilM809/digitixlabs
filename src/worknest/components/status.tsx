import { WnProjectStatus, WnTaskStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/worknest/lib/constants";
import { formatHours, hoursProgress, isEtaSoon, isHoursExceeded, isOverdue } from "@/worknest/lib/format";

const statusTone: Record<WnProjectStatus, string> = {
  BID: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  NEED_TO_START: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  SCRIPT_WIP: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  CHANGES: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
  LIVE: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  HOLD: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  CLOSE: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-200",
  CANCEL: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
};

const taskTone: Record<WnTaskStatus, string> = {
  NOT_STARTED: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  IN_PROGRESS: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  BLOCKED: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  COMPLETED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
};

export function StatusBadge({ status }: { status: WnProjectStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone[status])}>
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

export function TaskBadge({ status }: { status: WnTaskStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", taskTone[status])}>
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

export function BillingBadge({ status }: { status: string }) {
  const label = status;
  const key = status.toLowerCase();
  const tone =
    key.includes("paid")
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
      : key.includes("generated")
        ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
        : key.includes("approved") && !key.includes("required")
          ? "bg-teal/15 text-teal"
          : key.includes("approval")
            ? "bg-orange-500/15 text-orange-800 dark:text-orange-200"
            : "bg-amber-500/15 text-amber-800 dark:text-amber-200";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

export function HoursBar({ actual, estimated }: { actual: number; estimated: number }) {
  const progress = hoursProgress(actual, estimated);
  const width = Math.min(100, progress.ratio * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{progress.label}</span>
        {progress.over ? (
          <span className="font-medium text-danger">{formatHours(progress.overBy)} hours over estimate</span>
        ) : (
          <span>{formatHours(progress.remaining)} remaining</span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full", progress.over ? "bg-danger" : "bg-teal")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function AlertPills({
  eta,
  status,
  actual,
  estimated,
  warningDays,
}: {
  eta: Date;
  status: WnProjectStatus;
  actual: number;
  estimated: number;
  warningDays: number;
}) {
  const pills: { label: string; tone: string }[] = [];
  if (isOverdue(eta, status)) pills.push({ label: "Overdue", tone: "bg-danger/15 text-danger" });
  else if (isEtaSoon(eta, warningDays, status)) pills.push({ label: "ETA approaching", tone: "bg-gold/15 text-gold" });
  if (isHoursExceeded(actual, estimated)) pills.push({ label: "Hours exceeded", tone: "bg-danger/15 text-danger" });
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span key={pill.label} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", pill.tone)}>
          {pill.label}
        </span>
      ))}
    </div>
  );
}
