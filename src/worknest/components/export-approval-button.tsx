"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/worknest/components/ui";

export function ExportApprovalButton({
  projectId,
  month,
  year,
  label = "Export Project Details for Approval",
}: {
  projectId: string;
  month?: number;
  year?: number;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", String(month));
      if (year) params.set("year", String(year));
      const query = params.toString();
      const response = await fetch(
        `/api/worknest/projects/${projectId}/approval-export${query ? `?${query}` : ""}`,
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Could not export the project.");
        return;
      }
      const contentType = response.headers.get("Content-Type") ?? "";
      if (!contentType.includes("spreadsheet") && !contentType.includes("octet-stream")) {
        toast.error("Could not export the project.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      link.href = url;
      link.download = match?.[1] ?? "project-approval.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel exported. This does not generate an invoice.");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={onClick}>
      {pending ? "Exporting..." : label}
    </Button>
  );
}
