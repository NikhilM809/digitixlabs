"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { WnProjectStatus } from "@prisma/client";
import { updateWnProjectStatus } from "@/worknest/actions/projects";
import { Select } from "@/worknest/components/ui";
import { PROJECT_STATUS_LABEL } from "@/worknest/lib/constants";
import { formatDate } from "@/worknest/lib/format";
import { statusesAvailable } from "@/worknest/lib/project-status";

export function WnProjectStatusForm({
  projectId,
  status,
  changedByName,
  changedAt,
  compact = false,
}: {
  projectId: string;
  status: WnProjectStatus;
  changedByName?: string | null;
  changedAt?: Date | string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = statusesAvailable(status);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as WnProjectStatus;
    if (next === status) return;
    const formData = new FormData();
    formData.set("status", next);
    start(async () => {
      const result = await updateWnProjectStatus(projectId, formData);
      if (result?.error) {
        toast.error(result.error);
        event.target.value = status;
        return;
      }
      toast.success("Project status updated.");
      router.refresh();
    });
  }

  return (
    <div className={compact ? "grid gap-1" : "grid gap-1.5"}>
      <Select key={status} name="status" defaultValue={status} disabled={pending} onChange={onChange} className={compact ? "h-9 min-w-[10rem]" : undefined}>
        {options.map((value) => (
          <option key={value} value={value}>
            {PROJECT_STATUS_LABEL[value]}
          </option>
        ))}
      </Select>
      <p className="text-[11px] text-muted">
        {changedByName && changedAt
          ? `Last changed by ${changedByName} on ${formatDate(changedAt)}`
          : "Not changed yet"}
      </p>
    </div>
  );
}
